import { IsString, IsPhoneNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: '+224620000000' })
  @IsPhoneNumber()
  telephone: string;

  @ApiProperty({ example: 'Password123' })
  @IsString()
  motDePasse: string;
}
