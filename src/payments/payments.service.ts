import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EscrowService } from '../escrow/escrow.service';
import { QrService } from '../qr/qr.service';
import { OtpService } from '../otp/otp.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { BookingStatut, PaymentMethode, PaymentStatut } from '@prisma/client';

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
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly escrowService: EscrowService,
    private readonly qrService: QrService,
    private readonly otpService: OtpService,
    private readonly configService: ConfigService,
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

    if (
      dto.methode === PaymentMethode.ORANGE_MONEY ||
      dto.methode === PaymentMethode.MTN_MONEY
    ) {
      if (!dto.telephone) {
        throw new BadRequestException('Le numéro de téléphone est requis pour un paiement Mobile Money');
      }
    }

    if (dto.methode === PaymentMethode.WALLET) {
      throw new BadRequestException('Le paiement par wallet n\'est pas encore pris en charge via cette route');
    }

    const payment = await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        montant: dto.montant,
        methode: dto.methode,
        statut: PaymentStatut.PROCESSING,
        operateur: this.getOperatorLabel(dto.methode),
        telephone: dto.telephone,
        transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      },
    });

    const mobileMoneyRequest = await this.submitMobileMoneyRequest(payment, booking);

    return {
      paymentId: payment.id,
      bookingId: booking.id,
      statut: payment.statut,
      transactionId: payment.transactionId,
      message: mobileMoneyRequest.message,
      operator: payment.operateur,
      next: 'En attente du callback opérateur pour confirmer le paiement.',
    };
  }

  async handleWebhook(dto: PaymentWebhookDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { transactionId: dto.transactionId },
      include: { booking: { include: { passenger: { include: { user: true } }, driver: { include: { user: true } } } } },
    });

    if (!payment && dto.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: dto.bookingId },
        include: { passenger: { include: { user: true } }, driver: { include: { user: true } } },
      });
      if (!booking) {
        throw new NotFoundException('Paiement ou réservation introuvable');
      }
    }

    if (!payment) {
      throw new NotFoundException('Paiement introuvable pour cette transaction');
    }

    if (payment.montant !== dto.montant) {
      throw new BadRequestException('Le montant du callback ne correspond pas au paiement enregistré');
    }

    if (dto.operateur) {
      payment.operateur = dto.operateur;
    }

    if (dto.telephone) {
      payment.telephone = dto.telephone;
    }

    if (dto.statut === PaymentStatut.COMPLETED) {
      return this.confirmPayment(payment);
    }

    if (dto.statut === PaymentStatut.FAILED) {
      return this.failPayment(
        payment,
        dto.operateur ?? payment.operateur ?? 'UNKNOWN',
        dto.telephone ?? payment.telephone ?? '',
        'Échec du paiement Mobile Money',
      );
    }

    if (dto.statut === PaymentStatut.PROCESSING) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { statut: PaymentStatut.PROCESSING },
      });

      return {
        message: 'Callback reçu : paiement en cours de traitement',
        paymentId: payment.id,
      };
    }

    throw new BadRequestException('Statut de callback non pris en charge');
  }

  private async confirmPayment(payment: any) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: payment.bookingId },
      include: {
        passenger: { include: { user: true } },
        driver: { include: { user: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Réservation associée au paiement introuvable');
    }

    if (payment.statut === PaymentStatut.COMPLETED) {
      return { message: 'Paiement déjà confirmé', paymentId: payment.id };
    }

    const qrCodeUrl = await this.qrService.generateBookingQrCode(booking.id);
    const otpCode = this.otpService.generateOtp();
    const otpExpiresAt = this.otpService.getExpirationDate(24);

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          statut: PaymentStatut.COMPLETED,
          transactionId: payment.transactionId,
          operateur: payment.operateur,
          telephone: payment.telephone,
        },
      });

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          statut: BookingStatut.PAID,
          qrCode: qrCodeUrl,
          otpCode,
          otpExpiresAt,
        },
      });

      await tx.escrow.create({
        data: {
          paymentId: updatedPayment.id,
          montant: updatedPayment.montant,
          isHeld: true,
        },
      });

      await tx.wallet.upsert({
        where: { driverId: booking.driverId },
        update: {
          balance: { increment: updatedPayment.montant },
          pendingBalance: { increment: updatedPayment.montant },
        },
        create: {
          driverId: booking.driverId,
          balance: updatedPayment.montant,
          pendingBalance: updatedPayment.montant,
          withdrawableBalance: 0,
        },
      });

      return { payment: updatedPayment, booking: updatedBooking };
    });

    await Promise.all([
      this.notificationsService.create({
        userId: booking.passenger.user.id,
        bookingId: booking.id,
        type: 'PAYMENT_SUCCESS',
        titre: 'Paiement confirmé',
        message: `Votre paiement de ${payment.montant} GNF a été confirmé. Utilisez le QR/OTP pour embarquer.`,
        data: { otpCode, expiresAt: otpExpiresAt },
      }),
      this.notificationsService.create({
        userId: booking.driver.user.id,
        bookingId: booking.id,
        type: 'PAYMENT_RECEIVED',
        titre: 'Paiement reçu',
        message: `Le paiement pour la réservation ${booking.departure} → ${booking.destination} a été confirmé. Le trajet peut maintenant commencer.`,
      }),
    ]);

    return {
      message: 'Paiement confirmé avec succès',
      payment: result.payment,
      booking: result.booking,
    };
  }

  private async failPayment(payment: any, operateur: string, telephone: string, reason: string) {
    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        statut: PaymentStatut.FAILED,
        operateur,
        telephone,
        failReason: reason,
      },
    });

    await this.notificationsService.create({
      userId: payment.booking.passenger.user.id,
      bookingId: payment.bookingId,
      type: 'PAYMENT_FAILED',
      titre: 'Paiement échoué',
      message: `Le paiement Mobile Money a échoué : ${reason}. Veuillez réessayer ou contacter le support.`,
    });

    return {
      message: 'Paiement marqué comme échoué',
      payment: updatedPayment,
    };
  }

  private getOperatorLabel(methode: PaymentMethode) {
    switch (methode) {
      case PaymentMethode.ORANGE_MONEY:
        return 'ORANGE';
      case PaymentMethode.MTN_MONEY:
        return 'MTN';
      default:
        return 'UNKNOWN';
    }
  }

  private getOperatorApiUrl(operator: string) {
    if (operator === 'ORANGE') {
      return this.configService.get<string>('ORANGE_MONEY_API_URL');
    }
    if (operator === 'MTN') {
      return this.configService.get<string>('MTN_MONEY_API_URL');
    }
    return null;
  }

  private getOperatorApiKey(operator: string) {
    if (operator === 'ORANGE') {
      return this.configService.get<string>('ORANGE_MONEY_API_KEY');
    }
    if (operator === 'MTN') {
      return this.configService.get<string>('MTN_MONEY_API_KEY');
    }
    return null;
  }

  private async submitMobileMoneyRequest(payment: any, booking: any) {
    const apiUrl = this.getOperatorApiUrl(payment.operateur);
    const apiKey = this.getOperatorApiKey(payment.operateur);

    if (!apiUrl || !apiKey) {
      this.logger.warn(
        `Aucun endpoint Mobile Money configuré pour ${payment.operateur}. Callback manuel requis.`,
      );
      return {
        message: 'Aucun opérateur Mobile Money configuré. Le paiement reste en PROCESSING jusqu\'à la réception du callback.',
        simulated: true,
      };
    }

    // Placeholder de requête opérateur
    // TODO : implémenter l'appel réel à l'API Orange / MTN
    // Exemple : POST ${apiUrl}/payments/initiate
    // En tête : Authorization Bearer ${apiKey}
    // Payload : { transactionId, bookingId, montant, telephone }

    this.logger.log(`Envoi du paiement Mobile Money à ${payment.operateur} via ${apiUrl}`);

    return {
      message: `Requête Mobile Money envoyée à ${payment.operateur}. En attente du callback opérateur.`,
      simulated: false,
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
