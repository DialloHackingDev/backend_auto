import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatut } from '@prisma/client';

export class UpdateBookingStatusDto {
  @ApiProperty({ enum: BookingStatut, example: BookingStatut.CANCELLED })
  @IsEnum(BookingStatut)
  statut: BookingStatut;

  @ApiPropertyOptional({ example: 'Passager absent', description: 'Motif de l\'annulation' })
  @IsString()
  @IsOptional()
  cancelReason?: string;
}
