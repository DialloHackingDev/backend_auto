import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStationDto {
  @ApiProperty({ example: 'Gare Routière de Bambéto' })
  @IsString()
  nom: string;

  @ApiProperty({ example: 'Conakry' })
  @IsString()
  ville: string;

  @ApiProperty({ example: 'Commune de Ratoma, Conakry' })
  @IsString()
  adresse: string;

  @ApiProperty({ example: 9.6191, required: false })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({ example: -13.6067, required: false })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
