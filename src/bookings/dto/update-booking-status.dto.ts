import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BookingStatut } from '@prisma/client';

export class UpdateBookingStatusDto {
  @ApiProperty({ enum: BookingStatut, example: BookingStatut.CANCELLED })
  @IsEnum(BookingStatut)
  statut: BookingStatut;
}
