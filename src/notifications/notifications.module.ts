import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

/**
 * NotificationsModule
 *
 * Export de NotificationsService pour qu'il puisse être injecté
 * dans les autres modules (Bookings, Payments, Withdrawals…).
 *
 * PrismaService est disponible globalement via PrismaModule (@Global),
 * donc pas besoin de l'importer ici.
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService], // ← Permet l'injection dans d'autres modules
})
export class NotificationsModule {}
