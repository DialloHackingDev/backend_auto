import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EscrowService } from '../escrow/escrow.service';
import { QrService } from '../qr/qr.service';
import { OtpService } from '../otp/otp.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { BookingStatut, PaymentStatut } from '@prisma/client';

/**
 * PaymentsService
 *
 * Gère la création d'un paiement pour une réservation confirmée :
 * 1. Valide la réservation et le montant
 * 2. Simule le paiement Mobile Money (MVP — à remplacer par un vrai webhook en Sprint 4)
 * 3. Crée l'entrée Escrow (fonds bloqués)
 * 4. Génère le QR Code et l'OTP
 * 5. Met à jour le Wallet du chauffeur (pendingBalance)
 * 6. Envoie les notifications aux deux parties
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly escrowService: EscrowService,
    private readonly qrService: QrService,
    private readonly otpService: OtpService,
  ) {}

  async create(dto: CreatePaymentDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: {
        passenger: { include: { user: true } },
        driver: { include: { user: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Réservation introuvable');
    }

    // Le paiement n'est possible que pour les réservations PENDING ou CONFIRMED
    if (
      booking.statut !== BookingStatut.PENDING &&
      booking.statut !== BookingStatut.CONFIRMED
    ) {
      throw new BadRequestException('Cette réservation ne peut plus être payée');
    }

    if (booking.prix !== dto.montant) {
      throw new BadRequestException(
        `Le montant (${dto.montant} GNF) ne correspond pas au prix de la réservation (${booking.prix} GNF)`,
      );
    }

    // ── MVP : Simulation du paiement Mobile Money ───────────────────────────
    // En production (Sprint 4) :
    // 1. On crée le paiement en statut PROCESSING
    // 2. On appelle l'API Orange/MTN
    // 3. On attend le webhook de confirmation
    // 4. On exécute la suite du flow dans le handler du webhook
    // ────────────────────────────────────────────────────────────────────────

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Créer le paiement (simulation succès immédiat)
      const payment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          montant: dto.montant,
          methode: dto.methode,
          statut: PaymentStatut.COMPLETED,
          operateur: dto.methode.toString(),
          telephone: dto.telephone,
          // Référence simulée — en prod, retournée par l'opérateur
          transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        },
      });

      // 2. Bloquer les fonds dans l'Escrow
      await this.escrowService.holdFunds(payment.id, payment.montant);

      // 3. Générer le QR Code et l'OTP (envoyés au passager)
      const qrCodeUrl = await this.qrService.generateBookingQrCode(booking.id);
      const otpCode = this.otpService.generateOtp();
      const otpExpiresAt = this.otpService.getExpirationDate(24); // 24h

      // 4. Passer la réservation en PAID + enregistrer les codes
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          statut: BookingStatut.PAID,
          qrCode: qrCodeUrl,
          otpCode,
          otpExpiresAt,
        },
      });

      // 5. Créditer le pendingBalance du wallet chauffeur
      const wallet = await tx.wallet.findUnique({
        where: { driverId: booking.driverId },
      });

      if (wallet) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: payment.montant },
            pendingBalance: { increment: payment.montant },
          },
        });
      }

      return { payment, qrCodeUrl, otpCode, otpExpiresAt };
    });

    // 6. Notifications (hors transaction pour ne pas la bloquer)
    await Promise.all([
      // Notifier le passager avec son QR et OTP
      this.notificationsService.create({
        userId: booking.passenger.user.id,
        bookingId: booking.id,
        type: 'PAYMENT_SUCCESS',
        titre: 'Paiement confirmé',
        message: `Votre paiement de ${dto.montant} GNF a été reçu. Voici votre OTP : ${result.otpCode}. Présentez-le à votre chauffeur.`,
        data: { otpCode: result.otpCode, expiresAt: result.otpExpiresAt },
      }),
      // Notifier le chauffeur du paiement
      this.notificationsService.create({
        userId: booking.driver.user.id,
        bookingId: booking.id,
        type: 'PAYMENT_RECEIVED',
        titre: 'Paiement reçu',
        message: `Le passager a payé pour la réservation ${booking.departure} → ${booking.destination}. Le trajet peut commencer après validation OTP/QR.`,
      }),
    ]);

    return {
      payment: result.payment,
      validation: {
        qrCodeUrl: result.qrCodeUrl,
        otpCode: result.otpCode,
        expiresAt: result.otpExpiresAt,
      },
    };
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { escrow: true },
    });

    if (!payment) {
      throw new NotFoundException('Paiement introuvable');
    }

    return payment;
  }
}
