import { Module } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * DisputesModule
 *
 * Importe NotificationsModule pour pouvoir envoyer des notifications
 * lors de l'ouverture et de la résolution d'un litige.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
