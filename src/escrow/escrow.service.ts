import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatut, PaymentStatut } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
        data: {
          statut: BookingStatut.FUNDS_RELEASED,
          completedAt: booking.completedAt ?? new Date(),
        },
      });
    });
  }

  async refundFunds(bookingId: string, reason: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payment: {
          include: { escrow: true },
        },
      },
    });

    if (!booking || !booking.payment || !booking.payment.escrow) {
      throw new NotFoundException('Aucun paiement sous séquestre trouvé pour cette réservation');
    }

    const { escrow, montant, id: paymentId } = booking.payment;

    if (escrow.isReleased) {
      throw new BadRequestException('Les fonds ont déjà été libérés ou remboursés');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.escrow.update({
        where: { id: escrow.id },
        data: {
          isHeld: false,
          isReleased: true,
          releasedAt: new Date(),
        },
      });

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          statut: PaymentStatut.REFUNDED,
          failReason: reason,
        },
      });

      const wallet = await tx.wallet.findUnique({
        where: { driverId: booking.driverId },
      });

      if (wallet) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { decrement: montant },
            pendingBalance: { decrement: montant },
          },
        });
      }

      return {
        message: 'Remboursement initié',
        bookingId,
        amount: montant,
        reason,
      };
    });
  }
}
