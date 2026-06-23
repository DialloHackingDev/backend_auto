import { IsNumber, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LogGpsDto {
  @ApiProperty({ description: 'ID de la réservation concernée', example: 'uuid-v4' })
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @ApiProperty({ description: 'Latitude actuelle du chauffeur', example: 9.509167 })
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({ description: 'Longitude actuelle du chauffeur', example: -13.712222 })
  @IsNumber()
  @IsNotEmpty()
  longitude: number;
}
