import { Body, Controller, Get, Param, ParseIntPipe, Post, Patch, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { BaseCrudController } from '../../common/crud/base-crud.controller';
import { CreateNewsDto, UpdateNewsDto } from './dto/news.dto';
import { NewsEntity } from './entities/news.entity';
import { NewsService } from './news.service';

@ApiTags('news')
@ApiBearerAuth()
@Controller('news')
@CrudResource('news')
export class NewsController extends BaseCrudController<NewsEntity> {
  constructor(protected readonly service: NewsService) {
    super();
  }

  @Get('authors/:authorId/stats')
  @ApiOperation({ summary: 'Statistiques d’un auteur' })
  authorStats(@Param('authorId') authorId: string) {
    return this.service.statsByAuthor(authorId);
  }

  @Post()
  override create(@Body() dto: CreateNewsDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<NewsEntity>, actor);
  }

  @Patch(':id')
  override update(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() body: any,
    @Actor() actor: ActorContext,
  ) {
    console.log('[NewsController.update] Raw body received:', JSON.stringify(body, null, 2));
    return this.service.update(id, body as Partial<NewsEntity>, actor);
  }
}
