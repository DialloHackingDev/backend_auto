import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';

@Injectable()
export class WithdrawalsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createWithdrawalDto: CreateWithdrawalDto) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) {
      throw new NotFoundException('Profil chauffeur introuvable');
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: { driverId: driver.id },
    });

    if (!wallet) {
      throw new NotFoundException('Portefeuille introuvable');
    }

    if (wallet.withdrawableBalance < createWithdrawalDto.montant) {
      throw new BadRequestException('Solde insuffisant pour ce retrait');
    }

    const commission = createWithdrawalDto.montant * 0.10; // 10% commission plateforme
    const montantNet = createWithdrawalDto.montant - commission;

    return this.prisma.$transaction(async (prisma) => {
      // 1. Déduire le montant du portefeuille
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          withdrawableBalance: { decrement: createWithdrawalDto.montant },
          balance: { decrement: createWithdrawalDto.montant },
        },
      });

      // 2. Créer l'entrée de retrait
      const withdrawal = await prisma.withdrawal.create({
        data: {
          walletId: wallet.id,
          montant: createWithdrawalDto.montant,
          commission,
          montantNet,
          operateur: createWithdrawalDto.operateur,
          telephone: createWithdrawalDto.telephone,
        },
      });

      // TODO: Appeler l'API de paiement (ex: Orange Money) pour effectuer le transfert réel

      return withdrawal;
    });
  }
}
