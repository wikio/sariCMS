import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PRISMA_MODEL_FIELDS } from './model-fields';

/**
 * Thin wrapper around PrismaClient loaded lazily so the JSON driver
 * can boot without a generated client or a running SQL server.
 */

/**
 * Modèles déclarés au schéma que le client généré ne sait pas encore servir.
 *
 * Fonction séparée parce que c'est là qu'est le jugement — comparaison insensible
 * à la casse, délégations ignorées (`$connect`, `_internal`) — et non dans le
 * branchement de `onModuleInit`.
 *
 * Le cas est banal et il est moche à diagnostiquer : `postinstall` lance
 * `prisma generate || true`, donc un échec de génération (verrou de fichier sous
 * Windows, binaire non téléchargé hors ligne) ne se voit pas ; l'API démarre ;
 * et c'est l'écran d'administration qui répond 500, des heures plus tard, avec un
 * message qu'il faut lire jusqu'au bout pour comprendre. Mieux vaut le dire au
 * démarrage, une fois, en nommant les modèles.
 *
 * Hypothèse assumée : tout modèle du schéma devient une délégation du client —
 * c'est faux si `@@ignore` apparaît un jour, et il n'y en a aucun (contrôlé par
 * le test).
 */
export function stalePrismaModels(client: unknown, declared: readonly string[]): string[] {
  if (!client || typeof client !== 'object') return [];
  const known = new Set(
    Object.keys(client)
      .filter((key) => !key.startsWith('$') && !key.startsWith('_'))
      .map((key) => key.toLowerCase()),
  );
  // Le map généré écrit les noms tout en minuscules (`paymentrecord`), la
  // délégation Prisma est en camelCase (`paymentRecord`) : comparer les deux
  // bruts donnerait une alerte pour chaque modèle du schéma.
  return declared.filter((model) => !known.has(model.toLowerCase()));
}
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private client: any;

  get raw(): any {
    if (!this.client) {
      throw new Error('Prisma client is not initialized. Set DB_DRIVER=mysql|postgres and generate the client.');
    }
    return this.client;
  }

  async onModuleInit(): Promise<void> {
    const driver = (process.env.DB_DRIVER || 'json').toLowerCase();
    if (driver !== 'mysql' && driver !== 'postgres' && driver !== 'postgresql') {
      this.logger.log('Prisma skipped (DB_DRIVER is not mysql/postgres)');
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaClient } = require('@prisma/client');
      this.client = new PrismaClient();
      // Le contrôle passe AVANT la connexion : les délégations existent sur
      // l'instance sans qu'aucun serveur ne réponde, et un client périmé mérite
      // d'être nommé même quand la base est injoignable par ailleurs — sinon
      // l'installateur ne voit que l'échec de connexion, et le 500 de l'écran
      // arrivera plus tard, sans rapport avec ce qu'il vient de réparer.
      const stale = stalePrismaModels(this.client, Object.keys(PRISMA_MODEL_FIELDS));
      if (stale.length) {
        this.logger.warn(
          `${stale.length} modèle(s) du schéma absents du client Prisma généré : ${stale.join(', ')}. ` +
            `Lancez « npx prisma generate » dans backend/ puis redémarrez — sans cela, chaque écran qui lit ` +
            `l'un d'eux répond 500. Et si la table n'a pas été créée non plus, la migration du même nom est à jouer.`,
        );
      }
      await this.client.$connect();
      this.logger.log(`Prisma connected (${driver})`);
    } catch (err) {
      this.logger.error(`Prisma init failed: ${(err as Error).message}`);
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) await this.client.$disconnect();
  }

  delegate(model: string): any {
    const d = this.raw[model];
    if (!d) {
      // Cas courant : le modèle existe bien dans `schema.prisma`, mais le
      // client généré dans node_modules date d'avant son ajout. Le message
      // brut « Unknown Prisma model » n'orientait pas vers la commande à
      // lancer, alors que c'est presque toujours la cause.
      const known = Object.keys(this.raw)
        .filter((k) => !k.startsWith('$') && !k.startsWith('_'))
        .sort();
      throw new Error(
        `Modèle Prisma « ${model} » introuvable dans le client généré. ` +
          `Si le modèle figure bien dans prisma/schema.prisma, le client est périmé : ` +
          `lancez « npx prisma generate » dans backend/ puis redémarrez l'API. ` +
          `Modèles connus : ${known.join(', ') || '(aucun)'}.`,
      );
    }
    return d;
  }
}
