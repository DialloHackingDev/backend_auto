import { Module } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsController } from './withdrawals.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
})
export class WithdrawalsModule {}
