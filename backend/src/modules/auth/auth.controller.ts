import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { EnableTotpDto, LoginDto, RefreshDto, TwoFaLoginDto, VerifyTotpDto } from './dto/auth.dto';
import { ChangePasswordDto } from '../users/dto/user.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
