import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EscrowService } from '../escrow/escrow.service';

@Injectable()
export class WalletService {
  constructor(
    private prisma: PrismaService,
    private escrowService: EscrowService,
  ) {}

  async initWallet(driverId: string) {
    const existingWallet = await this.prisma.wallet.findUnique({
      where: { driverId },
    });

    if (existingWallet) {
      return existingWallet;
    }

    return this.prisma.wallet.create({
      data: {
        driverId,
        balance: 0,
        pendingBalance: 0,
        withdrawableBalance: 0,
      },
    });
  }

  async releaseFromEscrow(bookingId: string) {
    // Délègue la logique complexe à EscrowService
    return this.escrowService.releaseFunds(bookingId);
  }

  async getBalance(userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    
    if (!driver) {
      throw new NotFoundException('Profil chauffeur introuvable');
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: { driverId: driver.id },
      include: {
        withdrawals: {
          orderBy: { createdAt: 'desc' },
          take: 5, // Les 5 derniers retraits
        },
      },
    });

    if (!wallet) {
      throw new NotFoundException('Portefeuille introuvable');
    }

    const totalCommissionPaid = wallet.withdrawals.reduce(
      (total, withdrawal) => total + withdrawal.commission,
      0,
    );

    const totalWithdrawalsRequested = wallet.withdrawals.reduce(
      (total, withdrawal) => total + withdrawal.montant,
      0,
    );

    return {
      balance: wallet.balance,
      withdrawableBalance: wallet.withdrawableBalance,
      pendingBalance: wallet.pendingBalance,
      totalWithdrawalsRequested,
      totalCommissionPaid,
      recentWithdrawals: wallet.withdrawals,
    };
  }

  async getHistory(userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    
    if (!driver) {
      throw new NotFoundException('Profil chauffeur introuvable');
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: { driverId: driver.id },
      include: {
        withdrawals: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!wallet) {
      throw new NotFoundException('Portefeuille introuvable');
    }

    const bookings = await this.prisma.booking.findMany({
      where: { driverId: driver.id, statut: 'FUNDS_RELEASED' },
      include: { payment: true },
      orderBy: { completedAt: 'desc' },
    });

    const totalCommissionPaid = wallet.withdrawals.reduce(
      (total, withdrawal) => total + withdrawal.commission,
      0,
    );

    const totalWithdrawalsRequested = wallet.withdrawals.reduce(
      (total, withdrawal) => total + withdrawal.montant,
      0,
    );

    return {
      wallet: {
        balance: wallet.balance,
        pendingBalance: wallet.pendingBalance,
        withdrawableBalance: wallet.withdrawableBalance,
        totalWithdrawalsRequested,
        totalCommissionPaid,
        withdrawals: wallet.withdrawals,
      },
      history: {
        withdrawals: wallet.withdrawals.map((withdrawal) => ({
          id: withdrawal.id,
          montant: withdrawal.montant,
          commission: withdrawal.commission,
          montantNet: withdrawal.montantNet,
          operateur: withdrawal.operateur,
          telephone: withdrawal.telephone,
          statut: withdrawal.statut,
          reference: withdrawal.reference,
          createdAt: withdrawal.createdAt,
          updatedAt: withdrawal.updatedAt,
        })),
        earnings: bookings.map((b) => ({
          bookingId: b.id,
          amount: b.payment?.montant,
          date: b.completedAt,
        })),
      },
    };
  }
}
