import { Module } from '@nestjs/common';
import { GedController } from './ged.controller';
import { GedService } from './ged.service';

/**
 * Le module GED.
 *
 * Aucune dépendance à Prisma : la GED est un système de fichiers, et l'ajouter à la
 * base n'apporterait qu'une manière de plus d'être incohérent. `exports: [GedService]`
 * permet à un autre module (par exemple l'export de page, ou un job de purge) de range
 * ses visuels avec la même politique de noms.
 */
@Module({
  controllers: [GedController],
  providers: [GedService],
  exports: [GedService],
})
export class GedModule {}
