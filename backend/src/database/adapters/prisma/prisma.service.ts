import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

/**
 * Thin wrapper around PrismaClient loaded lazily so the JSON driver
 * can boot without a generated client or a running SQL server.
 */
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
