import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateContactInfoDto {
  @ApiPropertyOptional({ default: 'fr' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  locale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tagline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  hours?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logo?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'string' } })
  @IsOptional()
  @IsObject()
  social?: Record<string, string>;

  @ApiPropertyOptional({ type: 'object' })
  @IsOptional()
  @IsObject()
  extras?: Record<string, unknown>;
}

export class UpdateContactInfoDto extends PartialType(CreateContactInfoDto) {}

export class CreateContactMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  subject?: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  message!: string;
}

export class UpdateContactMessageDto {
  @ApiPropertyOptional({ enum: ['new', 'read', 'archived'] })
  @IsOptional()
  @IsIn(['new', 'read', 'archived'])
  status?: string;
}
