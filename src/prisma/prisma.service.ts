import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * PrismaService — Compatible Prisma v7
 * Utilise @prisma/adapter-pg pour la connexion PostgreSQL
 * DATABASE_URL depuis ConfigService (.env)
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const databaseUrl = configService.get<string>('DATABASE_URL');

    if (!databaseUrl) {
      throw new Error('DATABASE_URL est manquant dans les variables d\'environnement');
    }

    // Prisma v7 : connexion via driver adapter pg
    const pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

    // On garde la référence au pool pour le fermer proprement
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    (this as any)._pool = pool;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('✅ Connexion PostgreSQL établie via Prisma v7 + adapter-pg');
    } catch (error) {
      this.logger.error('❌ Échec de connexion à la base de données', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('🔌 Déconnexion de la base de données');
  }

  /**
   * Nettoie toutes les tables — Tests E2E uniquement
   */
  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase() ne peut être appelé qu\'en environnement de test');
    }
    const tables = [
      'freight', 'disputes', 'notifications', 'gps_logs',
      'withdrawals', 'wallets', 'escrow', 'payments',
      'bookings', 'vehicles', 'drivers', 'passengers', 'stations', 'users',
    ];
    for (const table of tables) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    }
  }
}
