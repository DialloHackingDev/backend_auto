import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { EscrowService } from '../escrow/escrow.service';
import { BookingStatut, PaymentStatut } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private escrowService: EscrowService,
  ) {}

  async create(createPaymentDto: CreatePaymentDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: createPaymentDto.bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Réservation introuvable');
    }

    if (booking.statut !== BookingStatut.PENDING && booking.statut !== BookingStatut.CONFIRMED) {
      throw new BadRequestException('Cette réservation ne peut plus être payée');
    }

    if (booking.prix !== createPaymentDto.montant) {
        throw new BadRequestException(`Le montant du paiement (${createPaymentDto.montant}) ne correspond pas au prix de la réservation (${booking.prix})`);
    }

    // MVP: On simule le succès du paiement immédiatement.
    // En réalité, on appellerait l'API Orange Money / MTN ici,
    // on créerait le paiement en statut PROCESSING, et on écouterait un webhook.

    return this.prisma.$transaction(async (prisma) => {
      // 1. Créer le paiement (Mock succès)
      const payment = await prisma.payment.create({
        data: {
          bookingId: booking.id,
          montant: createPaymentDto.montant,
          methode: createPaymentDto.methode,
          statut: PaymentStatut.COMPLETED, // Simulation succès
          operateur: createPaymentDto.methode.toString(),
          telephone: createPaymentDto.telephone,
          transactionId: `TXN-${Math.random().toString(36).substring(7).toUpperCase()}`, // Mock
        },
      });

      // 2. Bloquer les fonds dans l'Escrow
      await this.escrowService.holdFunds(payment.id, payment.montant);

      // 3. Mettre à jour le statut de la réservation
      await prisma.booking.update({
        where: { id: booking.id },
        data: { statut: BookingStatut.PAID },
      });

      // 4. Mettre à jour le Wallet du chauffeur (pending)
      const wallet = await prisma.wallet.findUnique({
          where: { driverId: booking.driverId }
      });
      if (wallet) {
          await prisma.wallet.update({
              where: { id: wallet.id },
              data: {
                  balance: { increment: payment.montant },
                  pendingBalance: { increment: payment.montant }
              }
          });
      }

      // TODO: Générer QR et OTP

      return payment;
    });
  }

  async findOne(id: string) {
    return this.prisma.payment.findUnique({
      where: { id },
    });
  }
}
