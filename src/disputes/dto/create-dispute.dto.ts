import { IsString, IsUUID, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDisputeDto {
  @ApiProperty({
    description: 'ID de la réservation concernée par le litige',
    example: 'uuid-v4',
  })
  @IsUUID()
  bookingId: string;

  @ApiProperty({
    description: 'Description détaillée du litige',
    example: 'Le chauffeur ne s\'est pas présenté au point de rendez-vous.',
    minLength: 20,
  })
  @IsString()
  @MinLength(20, { message: 'La description doit contenir au moins 20 caractères' })
  description: string;
}
