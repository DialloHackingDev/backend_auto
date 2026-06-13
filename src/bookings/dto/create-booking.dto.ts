import { IsString, IsInt, IsEnum, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  vehicleId: string;

  @ApiProperty({ example: 'Conakry' })
  @IsString()
  departure: string;

  @ApiProperty({ example: 'Labé' })
  @IsString()
  destination: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  places: number;
}
