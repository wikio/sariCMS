import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { perm } from '../../common/constants/permissions';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { ActorContext } from '../../common/crud/base-crud.service';
import { QueryDto } from '../../common/crud/dto/query.dto';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { UserEntity } from './entities/user.entity';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@CrudResource('users')
export class UsersController extends BaseCrudController<UserEntity> {
  constructor(protected readonly service: UsersService) {
    super();
  }

  @Post()
  @RequirePermissions(perm('users', 'create'))
  @ApiOperation({ summary: 'Créer un utilisateur' })
  override create(@Body() dto: CreateUserDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<UserEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() dto: UpdateUserDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<UserEntity>, actor);
  }

  @Get()
  @ApiOperation({ summary: 'Liste des utilisateurs' })
  override findAll(@Query() query: QueryDto) {
    return this.service.findAll(query);
  }

  @Post(':id/temp-password')
  @RequirePermissions(perm('users', 'admin'))
  @ApiOperation({ summary: 'Générer un mot de passe temporaire' })
  tempPassword(
    @Param('id', new ParseIntPipe()) id: number,
    @Actor() actor: ActorContext,
  ) {
    return this.service.generateTempPassword(id, actor);
  }

  @Post(':id/partner-code')
  @RequirePermissions(perm('users', 'admin'))
  @ApiOperation({ summary: 'Générer code partenaire + clé secrète' })
  partnerCode(
    @Param('id', new ParseIntPipe()) id: number,
    @Actor() actor: ActorContext,
  ) {
    return this.service.generatePartnerCredentials(id, actor);
  }
}
