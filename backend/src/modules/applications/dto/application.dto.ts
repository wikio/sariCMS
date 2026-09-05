import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { HistoryEntryDto } from '../../orders/dto/order.dto';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const APPLICATION_STATUSES = [
  'new',
  'reviewed',
  'interview',
  'accepted',
  'rejected',
] as const;

export class CreateApplicationDto {
  @ApiPropertyOptional({ example: 'CAND-2026-00001' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  reference?: string;

  @ApiPropertyOptional({ description: 'Compte candidat rattaché (users.id)' })
  @IsOptional()
  @IsInt()
  userId?: number;

  @ApiPropertyOptional({ description: "Offre visée (careers.id)" })
  @IsOptional()
  @IsInt()
  careerId?: number;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  candidate!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(180)
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
  jobTitle?: string;

  @ApiPropertyOptional({ enum: APPLICATION_STATUSES, default: 'new' })
  @IsOptional()
  @IsIn(APPLICATION_STATUSES as unknown as string[])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  experience?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  motivation?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'URL du CV' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cv?: string;

  @ApiPropertyOptional({ description: 'URL de la lettre de motivation' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  lm?: string;

  @ApiPropertyOptional({ type: [HistoryEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HistoryEntryDto)
  history?: HistoryEntryDto[];

  @ApiPropertyOptional({ description: 'Date de candidature (ISO)' })
  @IsOptional()
  @IsString()
  date?: string;
}

export class UpdateApplicationDto extends PartialType(CreateApplicationDto) {}
