import { Global, Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { AppCacheService } from './cache.service';

@Global()
@Module({
  imports: [
    NestCacheModule.register({
      ttl: Number(process.env.CACHE_TTL_SECONDS ?? 60) * 1000,
      max: 1_000,
      isGlobal: true,
    }),
  ],
  providers: [AppCacheService],
  exports: [AppCacheService, NestCacheModule],
})
export class AppCacheModule {}
