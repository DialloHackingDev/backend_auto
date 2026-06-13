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
    // PrismaService disponible dans tous les modules
    // ─────────────────────────────────
    PrismaModule,

    // ─────────────────────────────────
    // Rate Limiting — Protection DDoS / Brute Force
    // 100 requêtes par minute par IP
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
    // Modules Métier
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
    // OtpModule,         ← Phase 4
    // QrModule,          ← Phase 4
    // GpsModule,         ← Phase 4
    // NotificationsModule, ← Phase 5
    // DisputesModule,    ← Phase 6
    // AdminModule,       ← Phase 6
    // FreightModule,     ← Phase 6
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
