import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartBookingDto {
  @ApiProperty({ example: 9.6191 })
  @IsNumber()
  driverLatitude: number;

  @ApiProperty({ example: -13.6067 })
  @IsNumber()
  driverLongitude: number;

  @ApiProperty({ example: 9.6192 })
  @IsNumber()
  passengerLatitude: number;

  @ApiProperty({ example: -13.6068 })
  @IsNumber()
  passengerLongitude: number;

  @ApiProperty({ example: '123456', required: false, description: 'Le code OTP donné par le passager' })
  @IsString()
  @IsOptional()
  otp?: string;

  @ApiProperty({ example: '{"bookingId":"123e4567-e89b..."}', required: false, description: 'Le contenu brut lu par le scan QR' })
  @IsString()
  @IsOptional()
  qrData?: string;
}
