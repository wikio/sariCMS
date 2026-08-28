import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../common/decorators/actor.decorator';
import { CrudResource } from '../../common/decorators/crud-resource.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ActorContext } from '../../common/crud/base-crud.service';
import { AutocompleteQueryDto, QueryDto } from '../../common/crud/dto/query.dto';
import { CreateContactInfoDto, UpdateContactInfoDto } from './dto/contact.dto';
import { ContactInfoEntity } from './entities/contact.entity';
import { ContactInfoService } from './contact-info.service';

@ApiTags('contact')
@ApiBearerAuth()
@Controller('contact/info')
@CrudResource('contact')
export class ContactInfoController {
  constructor(private readonly service: ContactInfoService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des fiches contact (par locale)' })
  list(@Query() query: QueryDto) {
    return this.service.findAll(query);
  }

  @Get('autocomplete')
  autocomplete(@Query() query: AutocompleteQueryDto) {
    return this.service.autocomplete(query);
  }

  @Post()
  create(@Body() dto: CreateContactInfoDto, @Actor() actor: ActorContext) {
    return this.service.create(dto as unknown as Partial<ContactInfoEntity>, actor);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() dto: UpdateContactInfoDto,
    @Actor() actor: ActorContext,
  ) {
    return this.service.update(id, dto as unknown as Partial<ContactInfoEntity>, actor);
  }
}

@ApiTags('public')
@Public()
@Controller('public/contact')
export class PublicContactController {
  constructor(private readonly info: ContactInfoService) {}

  @Get()
  @ApiOperation({ summary: 'Coordonnées publiques' })
  async current(@Query('locale') locale?: string) {
    return (await this.info.findByLocale(locale || 'fr')) ?? {};
  }
}
