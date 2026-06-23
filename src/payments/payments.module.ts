import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { EscrowModule } from '../escrow/escrow.module';
import { QrModule } from '../qr/qr.module';
import { OtpModule } from '../otp/otp.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [EscrowModule, QrModule, OtpModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}

