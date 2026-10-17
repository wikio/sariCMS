import { Body, Controller, Param, ParseUUIDPipe, Post, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CreateHeroDto, UpdateHeroDto } from './dto/hero.dto';
import { HeroEntity } from './entities/hero.entity';
import { HeroService } from './hero.service';

@ApiTags('hero')
@ApiBearerAuth()
@Controller('hero')
@CrudResource('hero')
export class HeroController extends BaseCrudController<HeroEntity> {
  constructor(protected readonly service: HeroService) {
    super();
  }

  @Post()
  override create(@Body() dto: CreateHeroDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<HeroEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateHeroDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<HeroEntity>, actor);
  }
}
