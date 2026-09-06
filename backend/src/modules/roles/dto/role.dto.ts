import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsEntityId } from '../../../common/validation/entity-id';

export class CreateRoleDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'editor' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  @MaxLength(60)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    type: [String],
    description: "Ids de permissions : entiers (MySQL) ou UUID (driver JSON)",
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEntityId({ each: true })
  permissionIds?: Array<string | number>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}

export class CreatePermissionDto {
  @ApiProperty({ example: 'pages' })
  @IsString()
  @MaxLength(60)
  resource!: string;

  @ApiProperty({ example: 'update' })
  @IsString()
  @MaxLength(40)
  action!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class UpdatePermissionDto extends PartialType(CreatePermissionDto) {}
