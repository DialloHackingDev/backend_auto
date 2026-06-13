import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethode } from '@prisma/client';

export class CreatePaymentDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  bookingId: string;

  @ApiProperty({ example: 100000 })
  @IsNumber()
  montant: number;

  @ApiProperty({ enum: PaymentMethode, example: PaymentMethode.ORANGE_MONEY })
  @IsEnum(PaymentMethode)
  methode: PaymentMethode;

  @ApiProperty({ example: '+224620000000', required: false })
  @IsString()
  @IsOptional()
  telephone?: string;
}
