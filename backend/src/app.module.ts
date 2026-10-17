import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AcceptLanguageResolver, HeaderResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import * as path from 'path';
import { AppCacheModule } from './common/cache/cache.module';
import { AuditModule } from './common/audit/audit.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { PagesModule } from './modules/pages/pages.module';
import { FaqsModule } from './modules/faqs/faqs.module';
import { TestimonialsModule } from './modules/testimonials/testimonials.module';
import { MenusModule } from './modules/menus/menus.module';
import { ContactModule } from './modules/contact/contact.module';
import { TranslationsModule } from './modules/translations/translations.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { NewsModule } from './modules/news/news.module';
import { EventsModule } from './modules/events/events.module';
import { ProductsModule } from './modules/products/products.module';
import { ServicesModule } from './modules/services/services.module';
import { PartnersModule } from './modules/partners/partners.module';
import { CareersModule } from './modules/careers/careers.module';
import { SolutionsModule } from './modules/solutions/solutions.module';
import { HeroModule } from './modules/hero/hero.module';
import { HealthModule } from './modules/health/health.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    I18nModule.forRoot({
      fallbackLanguage: process.env.FALLBACK_LANGUAGE || 'fr',
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'),
        watch: process.env.NODE_ENV !== 'production',
      },
      resolvers: [
        { use: QueryResolver, options: ['lang', 'locale'] },
        new HeaderResolver(['x-lang', 'x-locale']),
        AcceptLanguageResolver,
      ],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: Number(config.get('THROTTLE_TTL_SECONDS') ?? 60) * 1000,
          limit: Number(config.get('THROTTLE_LIMIT') ?? 120),
        },
      ],
    }),
    ScheduleModule.forRoot(),
    AppCacheModule,
    DatabaseModule,
    AuditModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    PagesModule,
    FaqsModule,
    TestimonialsModule,
    MenusModule,
    ContactModule,
    TranslationsModule,
    AuditLogsModule,
    NewsModule,
    EventsModule,
    ProductsModule,
    ServicesModule,
    PartnersModule,
    CareersModule,
    SolutionsModule,
    HeroModule,
    HealthModule,
    SettingsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
