import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

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
}
