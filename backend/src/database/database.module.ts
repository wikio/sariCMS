import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mongoose from 'mongoose';
import {
  AUDIT_LOG_REPOSITORY,
  COLLECTIONS,
  CONTACT_INFO_REPOSITORY,
  CONTACT_MESSAGE_REPOSITORY,
  CAREER_REPOSITORY,
  EVENT_REPOSITORY,
  FAQ_REPOSITORY,
  HERO_REPOSITORY,
  MENU_REPOSITORY,
  NEWS_REPOSITORY,
  PAGE_REPOSITORY,
  PARTNER_REPOSITORY,
  PERMISSION_REPOSITORY,
  PRISMA_MODEL_BY_COLLECTION,
  PRODUCT_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  REPOSITORY_FACTORY,
  ROLE_REPOSITORY,
  SERVICE_REPOSITORY,
  SETTING_REPOSITORY,
  SOLUTION_REPOSITORY,
  TESTIMONIAL_REPOSITORY,
  TRANSLATION_REPOSITORY,
  USER_REPOSITORY,
} from '../common/constants/tokens';
import { BaseEntity, ICrudRepository, RepositoryFactory } from '../common/crud/interfaces/repository.interface';
import { JsonRepository } from './adapters/json/json-repository';
import { JsonStore } from './adapters/json/json-store';
import { MongoRepository } from './adapters/mongodb/mongo-repository';
import { PrismaRepository } from './adapters/prisma/prisma-repository';
import { PrismaService } from './adapters/prisma/prisma.service';

const TOKEN_BY_COLLECTION: Record<string, symbol> = {
  [COLLECTIONS.users]: USER_REPOSITORY,
  [COLLECTIONS.roles]: ROLE_REPOSITORY,
  [COLLECTIONS.permissions]: PERMISSION_REPOSITORY,
  [COLLECTIONS.refreshTokens]: REFRESH_TOKEN_REPOSITORY,
  [COLLECTIONS.pages]: PAGE_REPOSITORY,
  [COLLECTIONS.faqs]: FAQ_REPOSITORY,
  [COLLECTIONS.testimonials]: TESTIMONIAL_REPOSITORY,
  [COLLECTIONS.menus]: MENU_REPOSITORY,
  [COLLECTIONS.contactInfo]: CONTACT_INFO_REPOSITORY,
  [COLLECTIONS.contactMessages]: CONTACT_MESSAGE_REPOSITORY,
  [COLLECTIONS.translations]: TRANSLATION_REPOSITORY,
  [COLLECTIONS.auditLogs]: AUDIT_LOG_REPOSITORY,
  [COLLECTIONS.settings]: SETTING_REPOSITORY,
  [COLLECTIONS.news]: NEWS_REPOSITORY,
  [COLLECTIONS.events]: EVENT_REPOSITORY,
  [COLLECTIONS.products]: PRODUCT_REPOSITORY,
  [COLLECTIONS.services]: SERVICE_REPOSITORY,
  [COLLECTIONS.partners]: PARTNER_REPOSITORY,
  [COLLECTIONS.careers]: CAREER_REPOSITORY,
  [COLLECTIONS.solutions]: SOLUTION_REPOSITORY,
  [COLLECTIONS.hero]: HERO_REPOSITORY,
};

const genericSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
  },
  { strict: false, timestamps: false },
);

export function createRepositoryFactory(
  driver: string,
  jsonStore: JsonStore,
  prisma: PrismaService,
): RepositoryFactory {
  const normalized = driver.toLowerCase();
  const mongoModels = new Map<string, mongoose.Model<any>>();

  return <T extends BaseEntity>(collection: string): ICrudRepository<T> => {
    if (normalized === 'json') {
      return new JsonRepository<T>(collection, jsonStore);
    }
    if (normalized === 'mysql' || normalized === 'postgres' || normalized === 'postgresql') {
      const model = PRISMA_MODEL_BY_COLLECTION[collection];
      if (!model) throw new Error(`No Prisma model mapped for collection "${collection}"`);
      return new PrismaRepository<T>(collection, prisma, model);
    }
    if (normalized === 'mongodb' || normalized === 'mongo') {
      if (!mongoModels.has(collection)) {
        mongoModels.set(
          collection,
          mongoose.models[collection] || mongoose.model(collection, genericSchema, collection),
        );
      }
      return new MongoRepository<T>(collection, mongoModels.get(collection)!);
    }
    throw new Error(`Unsupported DB_DRIVER="${driver}". Use json | mysql | postgres | mongodb.`);
  };
}

const repositoryProviders = Object.entries(TOKEN_BY_COLLECTION).map(([collection, token]) => ({
  provide: token,
  useFactory: (factory: RepositoryFactory) => factory(collection),
  inject: [REPOSITORY_FACTORY],
}));

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: JsonStore,
      useFactory: (config: ConfigService) =>
        new JsonStore(config.get<string>('JSON_STORE_PATH') || './storage/json'),
      inject: [ConfigService],
    },
    {
      provide: REPOSITORY_FACTORY,
      useFactory: (config: ConfigService, store: JsonStore, prisma: PrismaService) =>
        createRepositoryFactory(config.get<string>('DB_DRIVER') || 'json', store, prisma),
      inject: [ConfigService, JsonStore, PrismaService],
    },
    ...repositoryProviders,
  ],
  exports: [REPOSITORY_FACTORY, PrismaService, JsonStore, ...repositoryProviders.map((p) => p.provide)],
})
export class DatabaseModule implements OnModuleInit {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const driver = (this.config.get<string>('DB_DRIVER') || 'json').toLowerCase();
    this.logger.log(`Database driver: ${driver}`);
    if (driver === 'mongodb' || driver === 'mongo') {
      const uri = this.config.get<string>('MONGODB_URI');
      if (!uri) throw new Error('MONGODB_URI is required when DB_DRIVER=mongodb');
      await mongoose.connect(uri);
      this.logger.log('Mongoose connected');
    }
  }
}
