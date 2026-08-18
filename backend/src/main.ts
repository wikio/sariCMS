import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);

  const prefix = config.get<string>('API_PREFIX') || 'api/v1';
  app.setGlobalPrefix(prefix);

  const origins = String(config.get('CORS_ORIGINS') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (origins.includes(origin)) return cb(null, true);
      if (/\.e2b\.app$/.test(origin) || /\.vercel\.app$/.test(origin)) return cb(null, true);
      if ((config.get('NODE_ENV') || 'development') !== 'production') return cb(null, true);
      return cb(new Error(`CORS blocked for origin ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language', 'x-lang', 'x-locale'],
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('SARI CMS API')
    .setDescription(
      'Backend NestJS du CMS SARI Système. Multi-driver (MySQL / PostgreSQL / MongoDB / JSON), ' +
        'RBAC, 2FA TOTP optionnelle, soft-delete + corbeille, journal d’audit.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('auth', 'Authentification JWT + 2FA')
    .addTag('users', 'Utilisateurs')
    .addTag('roles', 'Rôles')
    .addTag('permissions', 'Permissions')
    .addTag('pages', 'Pages légales / à propos / génériques')
    .addTag('faqs', 'FAQ')
    .addTag('testimonials', 'Témoignages')
    .addTag('menus', 'Menus de navigation')
    .addTag('contact', 'Coordonnées et messages')
    .addTag('translations', 'Traductions de contenu')
    .addTag('audit', 'Journal d’activité')
    .addTag('news', 'Actualités')
    .addTag('events', 'Événements')
    .addTag('products', 'Catalogue produits')
    .addTag('public', 'Endpoints publics vitrine')
    .addTag('health', 'Santé')
    .build();

  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup(`${prefix}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = Number(config.get('PORT') || process.env.PORT || 3001);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`SARI CMS API listening on http://0.0.0.0:${port}/${prefix}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger UI → http://0.0.0.0:${port}/${prefix}/docs`);
}

bootstrap();
