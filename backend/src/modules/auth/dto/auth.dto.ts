import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';

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
