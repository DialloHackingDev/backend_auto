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

    return wallet;
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

    // In a full implementation, history would also include completed bookings 
    // where funds were released to this wallet.
    const bookings = await this.prisma.booking.findMany({
      where: { driverId: driver.id, statut: 'FUNDS_RELEASED' },
      include: { payment: true },
      orderBy: { completedAt: 'desc' },
    });

    return {
      wallet,
      history: {
        withdrawals: wallet.withdrawals,
        earnings: bookings.map(b => ({
          bookingId: b.id,
          amount: b.payment?.montant,
          date: b.completedAt,
        })),
      }
    };
  }
}
