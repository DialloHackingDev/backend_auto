import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatut } from '@prisma/client';

export class PaymentWebhookDto {
  @ApiProperty({ example: 'TXN-1680000000000-ABC123' })
  @IsString()
  transactionId: string;

  @ApiProperty({ enum: PaymentStatut, example: PaymentStatut.COMPLETED })
  @IsEnum(PaymentStatut)
  statut: PaymentStatut;

  @ApiProperty({ example: 100000 })
  @IsNumber()
  montant: number;

  @ApiProperty({ example: 'ORANGE', required: false })
  @IsString()
  @IsOptional()
  operateur?: string;

  @ApiProperty({ example: '+224620000000', required: false })
  @IsString()
  @IsOptional()
  telephone?: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsString()
  @IsOptional()
  bookingId?: string;
}
