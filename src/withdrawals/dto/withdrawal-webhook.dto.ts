import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WithdrawalStatut } from '@prisma/client';

export class WithdrawalWebhookDto {
  @ApiProperty({ example: 'b8cba9f7-45de-4c14-951a-f76cc3d7b1f2', required: false })
  @IsString()
  @IsOptional()
  withdrawalId?: string;

  @ApiProperty({ example: 'REFW-1680000000000-ABC123', required: false })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiProperty({ enum: WithdrawalStatut, example: WithdrawalStatut.COMPLETED })
  @IsEnum(WithdrawalStatut)
  statut: WithdrawalStatut;

  @ApiProperty({ example: 'Référence opérateur 123', required: false })
  @IsString()
  @IsOptional()
  operatorReference?: string;

  @ApiProperty({ example: 'Montant incorrect', required: false })
  @IsString()
  @IsOptional()
  failReason?: string;
}
