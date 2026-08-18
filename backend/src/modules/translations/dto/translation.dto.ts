import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTranslationDto {
  @ApiProperty({ example: 'pages' })
  @IsString()
  @MaxLength(60)
  entityType!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  entityId!: string;

  @ApiProperty({ example: 'en' })
  @IsString()
  @MinLength(2)
  @MaxLength(8)
  locale!: string;

  @ApiProperty({ example: 'title' })
  @IsString()
  @MaxLength(80)
  field!: string;

  @ApiProperty()
  @IsString()
  value!: string;
}

export class UpdateTranslationDto extends PartialType(CreateTranslationDto) {}
