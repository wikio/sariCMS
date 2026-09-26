import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@sarisysteme.com' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ description: 'Code TOTP si le compte a activé la 2FA' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string;
}

/**
 * Inscription en libre-service, depuis la vitrine.
 *
 * Volontairement **sans champ `type`** : le compte créé est toujours un
 * `client`. `POST /users` reste réservé à qui détient la permission
 * `users:create` — c'est la seule façon d'ouvrir un compte administrateur ou
 * partenaire. Les règles de mot de passe sont celles de `CreateUserDto`, pour
 * qu'un formulaire accepté ici ne soit pas refusé plus bas.
 */
export class RegisterDto {
  @ApiProperty({ example: 'client@sarisysteme.com' })
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @ApiProperty({ minLength: 10, example: 'ChangeMe_Sari2026!' })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  @Matches(/[A-Z]/, { message: 'password must contain an uppercase letter' })
  @Matches(/[a-z]/, { message: 'password must contain a lowercase letter' })
  @Matches(/[0-9]/, { message: 'password must contain a digit' })
  password!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  company?: string;

  @ApiPropertyOptional({ enum: ['fr', 'en', 'ar'] })
  @IsOptional()
  @IsIn(['fr', 'en', 'ar'])
  locale?: string;
}

/**
 * Demande de réinitialisation. Appelée par le serveur Next.js uniquement — voir
 * `AuthController.requestReset` pour pourquoi ce point d'entrée n'est pas public.
 */
export class ForgotPasswordDto {
  @ApiProperty({ example: 'client@sarisysteme.com' })
  @IsEmail()
  @MaxLength(180)
  email!: string;
}

/** Nouveau mot de passe, présenté avec le jeton reçu par email. */
export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token!: string;

  @ApiProperty({ minLength: 10, example: 'ChangeMe_Sari2026!' })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  @Matches(/[A-Z]/, { message: 'password must contain an uppercase letter' })
  @Matches(/[a-z]/, { message: 'password must contain a lowercase letter' })
  @Matches(/[0-9]/, { message: 'password must contain a digit' })
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class VerifyTotpDto {
  @ApiProperty()
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class EnableTotpDto {
  @ApiProperty()
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class TwoFaLoginDto {
  @ApiProperty({ description: 'Jeton temporaire renvoyé par /auth/login' })
  @IsString()
  @IsNotEmpty()
  challengeToken!: string;

  @ApiProperty()
  @IsString()
  @Length(6, 6)
  code!: string;
}
