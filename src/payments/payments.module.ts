import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { EscrowModule } from '../escrow/escrow.module';
import { QrModule } from '../qr/qr.module';
import { OtpModule } from '../otp/otp.module';

@Module({
  imports: [EscrowModule, QrModule, OtpModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
