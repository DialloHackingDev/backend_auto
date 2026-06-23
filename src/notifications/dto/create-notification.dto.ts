import { IsString, IsOptional, IsUUID, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({ description: 'ID de l\'utilisateur destinataire', example: 'uuid-v4' })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ description: 'ID de la réservation liée (optionnel)', example: 'uuid-v4' })
  @IsUUID()
  @IsOptional()
  bookingId?: string;

  @ApiProperty({
    description: 'Type de notification — utilisé côté client pour l\'affichage',
    example: 'RESERVATION_CONFIRMED',
    enum: [
      'RESERVATION_CONFIRMED',
      'RESERVATION_CANCELLED',
      'PAYMENT_SUCCESS',
      'PAYMENT_FAILED',
      'TRIP_STARTED',
      'TRIP_COMPLETED',
      'WITHDRAWAL_PROCESSED',
      'DISPUTE_OPENED',
      'DISPUTE_RESOLVED',
      'DRIVER_ARRIVED',
    ],
  })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Titre court de la notification', example: 'Réservation confirmée' })
  @IsString()
  titre: string;

  @ApiProperty({
    description: 'Corps du message',
    example: 'Votre réservation pour Conakry → Labé a été confirmée.',
  })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'Données JSON additionnelles (ex: coordonnées, montant…)',
    example: { montant: 100000 },
  })
  @IsObject()
  @IsOptional()
  data?: Record<string, unknown>;
}
