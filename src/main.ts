import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Logger Winston sera configuré dans app.module.ts
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // ─────────────────────────────────
  // Sécurité HTTP Headers — Helmet
  // ─────────────────────────────────
  app.use(helmet());

  // ─────────────────────────────────
  // CORS
  // ─────────────────────────────────
  const corsOrigins = configService.get<string>('CORS_ORIGINS', '');
  app.enableCors({
    origin: corsOrigins ? corsOrigins.split(',') : ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  // ─────────────────────────────────
  // Préfixe global API
  // ─────────────────────────────────
  const apiVersion = configService.get<string>('API_VERSION', 'v1');
  app.setGlobalPrefix(`api/${apiVersion}`);

  // ─────────────────────────────────
  // Validation globale des DTOs
  // ─────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // Supprime les champs non définis dans le DTO
      forbidNonWhitelisted: true, // Erreur si des champs non autorisés sont envoyés
      transform: true,          // Transforme automatiquement les types
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ─────────────────────────────────
  // Filtre d'exceptions global
  // ─────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ─────────────────────────────────
  // Interceptor de logging global
  // ─────────────────────────────────
  app.useGlobalInterceptors(new LoggingInterceptor());

  // ─────────────────────────────────
  // Documentation Swagger
  // ─────────────────────────────────
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('🚗 AutoConnect API')
      .setDescription(
        `API officielle de la plateforme AutoConnect — Réservation de transport routier en Guinée.
        
**Environnement**: ${nodeEnv}

**Authentification**: Utiliser le bouton "Authorize" avec le token JWT sous la forme: \`Bearer <token>\``,
      )
      .setVersion('1.0')
      .setContact('AutoConnect', 'https://autoconnect.gn', 'api@autoconnect.gn')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Entrez votre JWT token ici',
        },
        'JWT-Auth',
      )
      .addTag('Auth', 'Authentification et gestion des tokens')
      .addTag('Users', 'Gestion des profils utilisateurs')
      .addTag('Drivers', 'Gestion des chauffeurs')
      .addTag('Vehicles', 'Gestion des véhicules')
      .addTag('Stations', 'Gestion des gares routières')
      .addTag('Bookings', 'Réservations de trajets')
      .addTag('Payments', 'Paiements Mobile Money')
      .addTag('Wallet', 'Portefeuille chauffeur')
      .addTag('Withdrawals', 'Retraits et commissions')
      .addTag('Escrow', 'Gestion du compte séquestre')
      .addTag('OTP', 'Codes de vérification à usage unique')
      .addTag('QR', 'Génération et vérification QR Code')
      .addTag('GPS', 'Suivi GPS en temps réel')
      .addTag('Notifications', 'Notifications utilisateurs')
      .addTag('Disputes', 'Gestion des litiges')
      .addTag('Freight', 'Gestion du fret')
      .addTag('Admin', 'Administration de la plateforme')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
      },
    });

    logger.log('📚 Swagger disponible sur: http://localhost:' + configService.get('PORT', 3000) + '/api/docs');
  }

  // ─────────────────────────────────
  // Démarrage du serveur
  // ─────────────────────────────────
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  logger.log(`🚀 AutoConnect API démarré sur: http://localhost:${port}/api/${apiVersion}`);
  logger.log(`🌍 Environnement: ${nodeEnv}`);
}

bootstrap();
