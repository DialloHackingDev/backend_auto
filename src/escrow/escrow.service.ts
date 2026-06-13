import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatut } from '@prisma/client';

@Injectable()
export class EscrowService {
  constructor(private prisma: PrismaService) {}

  async holdFunds(paymentId: string, montant: number) {
    return this.prisma.escrow.create({
      data: {
        paymentId,
        montant,
        isHeld: true,
      },
    });
  }

  async releaseFunds(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payment: {
          include: { escrow: true },
        },
      },
    });

    if (!booking || !booking.payment || !booking.payment.escrow) {
      throw new NotFoundException('Fonds sous séquestre introuvables pour cette réservation');
    }

    if (booking.payment.escrow.isReleased) {
      throw new BadRequestException('Les fonds ont déjà été libérés');
    }

    // Libérer les fonds (transaction)
    return this.prisma.$transaction(async (prisma) => {
      // 1. Mettre à jour l'Escrow
      await prisma.escrow.update({
        where: { id: booking.payment!.escrow!.id },
        data: { isHeld: false, isReleased: true, releasedAt: new Date() },
      });

      // 2. Mettre à jour le Wallet du chauffeur
      // On retire de pendingBalance et on ajoute à withdrawableBalance
      const wallet = await prisma.wallet.findUnique({
          where: { driverId: booking.driverId }
      });

      if (wallet) {
          await prisma.wallet.update({
            where: { id: wallet.id },
            data: {
              pendingBalance: { decrement: booking.payment!.montant },
              withdrawableBalance: { increment: booking.payment!.montant },
            },
          });
      }

      // 3. Mettre à jour la réservation
      return prisma.booking.update({
        where: { id: bookingId },
        data: { statut: 'FUNDS_RELEASED' },
      });
    });
  }
}
