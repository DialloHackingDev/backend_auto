import { Module } from '@nestjs/common';
import { GpsService } from './gps.service';

@Module({
  providers: [GpsService],
  exports: [GpsService],
})
export class GpsModule {}
