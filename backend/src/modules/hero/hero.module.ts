import { Module } from '@nestjs/common';
import { PublicHeroController } from './public-hero.controller';
import { HeroController } from './hero.controller';
import { HeroService } from './hero.service';

@Module({
  controllers: [PublicHeroController, HeroController],
  providers: [HeroService],
  exports: [HeroService],
})
export class HeroModule {}
