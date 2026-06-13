import { IsString, IsInt, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VehicleStatut } from '@prisma/client';

export class CreateVehicleDto {
  @ApiProperty({ example: 'Toyota' })
  @IsString()
  marque: string;

  @ApiProperty({ example: 'Corolla' })
  @IsString()
  modele: string;

  @ApiProperty({ example: 'RC-1234-GN' })
  @IsString()
  immatriculation: string;

  @ApiProperty({ example: 7 })
  @IsInt()
  @Min(1)
  capacite: number;

  @ApiProperty({ enum: VehicleStatut, example: VehicleStatut.ACTIF, required: false })
  @IsEnum(VehicleStatut)
  statut?: VehicleStatut;
}
