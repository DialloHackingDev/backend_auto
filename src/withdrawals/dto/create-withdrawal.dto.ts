import { IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWithdrawalDto {
  @ApiProperty({ example: 50000 })
  @IsNumber()
  @Min(10000, { message: 'Le retrait minimum est de 10 000 GNF' })
  montant: number;

  @ApiProperty({ example: 'ORANGE' })
  @IsString()
  operateur: string;

  @ApiProperty({ example: '+224620000000' })
  @IsString()
  telephone: string;
}
