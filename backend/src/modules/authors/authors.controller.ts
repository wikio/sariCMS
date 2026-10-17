import { Body, Controller, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CreateAuthorDto, UpdateAuthorDto } from './dto/author.dto';
import { AuthorEntity } from './entities/author.entity';
import { AuthorsService } from './authors.service';

@ApiTags('authors')
@ApiBearerAuth()
@Controller('authors')
@CrudResource('authors')
export class AuthorsController extends BaseCrudController<AuthorEntity> {
  constructor(protected readonly service: AuthorsService) {
    super();
  }

  @Post()
  override create(@Body() dto: CreateAuthorDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<AuthorEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() dto: UpdateAuthorDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<AuthorEntity>, actor);
  }
}
