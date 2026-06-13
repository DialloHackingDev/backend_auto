import { IsString, IsPhoneNumber, IsEnum, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'Ousmane Diallo' })
  @IsString()
  nom: string;

  @ApiProperty({ example: '+224620000000' })
  @IsPhoneNumber()
  telephone: string;

  @ApiProperty({ example: 'Password123' })
  @IsString()
  @MinLength(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' })
  motDePasse: string;

  @ApiProperty({ enum: Role, example: Role.PASSAGER })
  @IsEnum(Role)
  role: Role;

  @ApiProperty({ example: 'GN-123456', required: false, description: 'Requis si le rôle est CHAUFFEUR' })
  @IsString()
  @IsOptional()
  numeroPermis?: string;
}
