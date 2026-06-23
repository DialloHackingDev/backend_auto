import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StationsModule } from './stations/stations.module';
import { DriversModule } from './drivers/drivers.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { BookingsModule } from './bookings/bookings.module';
import { EscrowModule } from './escrow/escrow.module';
import { PaymentsModule } from './payments/payments.module';
import { WalletModule } from './wallet/wallet.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { OtpModule } from './otp/otp.module';
import { QrModule } from './qr/qr.module';
import { GpsModule } from './gps/gps.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DisputesModule } from './disputes/disputes.module';
import { FreightModule } from './freight/freight.module';

@Module({
  imports: [
    // ─────────────────────────────────
    // Variables d'environnement (.env)
    // Disponible globalement dans toute l'app
    // ─────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ─────────────────────────────────
    // Base de données Prisma (global)
    // PrismaService disponible dans tous les modules sans import explicite
    // ─────────────────────────────────
    PrismaModule,

    // ─────────────────────────────────
    // Rate Limiting — Protection DDoS / Brute Force
    // 100 requêtes par minute par IP (configurable via .env)
    // ─────────────────────────────────
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('THROTTLE_TTL', 60000),
          limit: configService.get<number>('THROTTLE_LIMIT', 100),
        },
      ],
    }),

    // ─────────────────────────────────
    // Modules Métier — Phase 2 (Core)
    // ─────────────────────────────────
    AuthModule,
    UsersModule,
    StationsModule,
    DriversModule,
    VehiclesModule,
    BookingsModule,
    PaymentsModule,
    EscrowModule,
    WalletModule,
    WithdrawalsModule,

    // ─────────────────────────────────
    // Modules Utilitaires — Validation anti-fraude
    // ─────────────────────────────────
    OtpModule,
    QrModule,
    GpsModule,

    // ─────────────────────────────────
    // Modules Métier — Sprint 1
    // ─────────────────────────────────
    NotificationsModule,
    DisputesModule,
    FreightModule,

    // À activer dans les sprints suivants :
    // AdminModule,    ← Sprint 3
    // RealtimeModule, ← Sprint 3 (Socket.io)
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
