import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import {
  EnableTotpDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  TwoFaLoginDto,
  VerifyTotpDto,
} from './dto/auth.dto';
import { ChangePasswordDto } from '../users/dto/user.dto';
import { UsersService } from '../users/users.service';
import { isInternalKey } from '../../common/security/internal-key';
import { UserEntity } from '../users/entities/user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Inscription en libre-service depuis la vitrine.
   *
   * La page d'inscription appelait `POST /users`, qui exige la permission
   * `users:create` : l'appel échouait en 401 et le navigateur retombait en
   * silence sur un registre local. Aucun compte n'était donc jamais créé —
   * et aucun message de bienvenue ne pouvait partir.
   *
   * Le type est forcé à `client` : ouvrir un compte administrateur ou
   * partenaire reste réservé à `POST /users`. Débit limité, et l'appelant
   * (route Next `/api/register`) ajoute captcha et piège à pourriels.
   */
  /**
   * Demande de jeton de réinitialisation — **réservée au serveur Next.js**.
   *
   * La réponse contient le jeton, qui servira à construire le lien envoyé par
   * email. Un point d'entrée public ici laisserait n'importe qui obtenir le
   * jeton de n'importe quelle adresse et réinitialiser son mot de passe : il est
   * donc fermé par `MAIL_INTERNAL_KEY`, la même clé partagée que
   * `POST /mail/internal/send`, que seul le processus Next connaît.
   *
   * C'est la route Next `/api/forgot-password` qui renvoie au visiteur le même
   * message que le compte existe ou non.
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Émettre un jeton de réinitialisation (serveur Next.js)' })
  async requestReset(
    @Headers('x-mail-internal-key') key: string,
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
  ) {
    const expected = String(this.config.get<string>('MAIL_INTERNAL_KEY') || '');
    if (!isInternalKey(key, expected)) {
      throw new UnauthorizedException('Clé interne absente ou invalide');
    }
    return this.auth.requestPasswordReset(dto.email, { ip: req.ip });
  }

  /**
   * Pose le nouveau mot de passe.
   *
   * Celui-là est réellement public — le visiteur arrive ici par le lien reçu par
   * email, sans session. Le jeton est à usage unique et expire ; la validation
   * du mot de passe est celle de `CreateUserDto`.
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Réinitialiser le mot de passe avec le jeton reçu par email' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Créer un compte client depuis la vitrine' })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.users.create(
      {
        email: dto.email,
        password: dto.password,
        firstName: dto.firstName,
        lastName: dto.lastName || '',
        phone: dto.phone,
        company: dto.company,
        locale: dto.locale || 'fr',
        type: 'client',
        // Le schéma Prisma donne `pending` par défaut, et le pilote JSON
        // n'applique aucun défaut : sans cette ligne le compte fraîchement créé
        // était refusé à la connexion (« Account is not active ») alors même que
        // l'email de bienvenue venait de partir. La vitrine n'a pas d'étape de
        // confirmation par email, le compte est donc actif tout de suite.
        status: 'active',
      } as unknown as Partial<UserEntity>,
      { ip: req.ip, userAgent: req.headers['user-agent'] },
    );
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Connexion email + mot de passe (2FA challenge si activée)' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Public()
  @Post('2fa/challenge')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Valider le challenge 2FA et obtenir les jetons' })
  verifyChallenge(@Body() dto: TwoFaLoginDto, @Req() req: Request) {
    return this.auth.verifyTwoFactor(dto, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renouveler la session via refresh token (rotation)' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Révoquer le refresh token' })
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profil de l’utilisateur authentifié + permissions' })
  me(@CurrentUser('id') id: number) {
    return this.auth.me(id);
  }

  /**
   * Changement de mot de passe par la personne elle-même.
   *
   * Distinct de `PATCH /users/:id`, réservé aux administrateurs : ici
   * l'ancien mot de passe est exigé, ce qui empêche un jeton volé de
   * verrouiller le compte de sa victime. La limitation de débit protège
   * contre la recherche du mot de passe actuel par essais successifs.
   */
  @Post('change-password')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Changer son propre mot de passe' })
  changePassword(@CurrentUser('id') id: number, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(id, dto);
  }

  @Post('2fa/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Générer un secret TOTP + QR (pas encore activé)' })
  setup(@CurrentUser('id') id: number) {
    return this.auth.setupTotp(id);
  }

  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirmer le secret TOTP avec un code pour activer la 2FA' })
  enable(@CurrentUser('id') id: number, @Body() dto: EnableTotpDto) {
    return this.auth.enableTotp(id, dto.code);
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Désactiver la 2FA (code TOTP requis)' })
  disable(@CurrentUser('id') id: number, @Body() dto: VerifyTotpDto) {
    return this.auth.disableTotp(id, dto.code);
  }
}
