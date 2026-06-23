import { IsString, IsEnum, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DisputeStatut } from '@prisma/client';

export class ResolveDisputeDto {
  @ApiProperty({
    description: 'Décision finale de l\'administrateur sur le litige',
    example: 'Remboursement accordé suite à vérification GPS.',
    minLength: 10,
  })
  @IsString()
  @MinLength(10, { message: 'La résolution doit contenir au moins 10 caractères' })
  resolution: string;

  @ApiProperty({
    description: 'Statut de résolution',
    enum: [DisputeStatut.RESOLU, DisputeStatut.REJETE],
    example: DisputeStatut.RESOLU,
  })
  @IsEnum(['RESOLU', 'REJETE'], {
    message: 'Le statut doit être RESOLU ou REJETE',
  })
  statut: 'RESOLU' | 'REJETE';
}
