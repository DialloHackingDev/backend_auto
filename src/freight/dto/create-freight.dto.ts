import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFreightDto {
  @ApiProperty({ example: 200, description: 'Poids en kilogrammes' })
  @IsNumber()
  @Min(1)
  poids: number;

  @ApiPropertyOptional({ example: 'Sacs de riz', description: 'Type de marchandise' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({ example: 'Conakry', description: 'Destination du fret' })
  @IsString()
  destination: string;

  @ApiPropertyOptional({ example: 'Transport de marchandises volumineuses', description: 'Description complémentaire' })
  @IsString()
  @IsOptional()
  description?: string;
}
