import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { GpsModule } from '../gps/gps.module';
import { OtpModule } from '../otp/otp.module';

@Module({
  imports: [GpsModule, OtpModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
