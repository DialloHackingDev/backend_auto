import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GpsService } from '../gps/gps.service';
import { OtpService } from '../otp/otp.service';
import { EscrowService } from '../escrow/escrow.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { StartBookingDto } from './dto/start-booking.dto';
import { BookingStatut, PaymentStatut, Role } from '@prisma/client';

/**
 * BookingsService
 *
 * Gère l'intégralité du cycle de vie d'une réservation :
 * PENDING → CONFIRMED → PAID → BOARDING → IN_PROGRESS → COMPLETED → FUNDS_RELEASED
 *
 * Chaque transition d'état déclenche automatiquement une notification
 * vers l'autre acteur (passager ↔ chauffeur).
 */
@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly gpsService: GpsService,
    private readonly otpService: OtpService,
    private readonly escrowService: EscrowService,
  ) {}

  // ─────────────────────────────────────────────────
  // CRÉATION — Passager crée une réservation
  // ─────────────────────────────────────────────────

  async create(userId: string, dto: CreateBookingDto) {
    const passenger = await this.prisma.passenger.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!passenger) {
      throw new ForbiddenException('Seul un passager peut effectuer une réservation');
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
      include: { driver: { include: { user: true } } },
    });

    if (!vehicle) {
      throw new NotFoundException('Véhicule introuvable');
    }

    if (vehicle.statut !== 'ACTIF' || !vehicle.driver.isAvailable) {
      throw new BadRequestException(
        'Ce véhicule ou son chauffeur n\'est pas disponible',
      );
    }

    if (vehicle.placesDisponibles < dto.places) {
      throw new BadRequestException(
        `Pas assez de places disponibles. Restant : ${vehicle.placesDisponibles}`,
      );
    }

    // TODO Sprint 2: Remplacer par une table de tarifs dynamique
    const prixUnitaire = 100_000; // 100 000 GNF par place (MVP)
    const prixTotal = prixUnitaire * dto.places;

    const booking = await this.prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          passengerId: passenger.id,
          driverId: vehicle.driver.id,
          vehicleId: vehicle.id,
          departure: dto.departure,
          destination: dto.destination,
          places: dto.places,
          prix: prixTotal,
          statut: BookingStatut.PENDING,
        },
      });

      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: { placesDisponibles: { decrement: dto.places } },
      });

      return created;
    });

    // Notifier le chauffeur d'une nouvelle demande
    const notifyingDriver = this.notificationsService.create({
      userId: vehicle.driver.user.id,
      bookingId: booking.id,
      type: 'BOOKING_NEW',
      titre: 'Nouvelle réservation',
      message: `Vous avez reçu une demande de réservation de ${dto.departure} vers ${dto.destination}.`,
      data: { bookingId: booking.id, places: dto.places, prix: prixTotal },
    });

    // Notifier le passager que sa réservation est en attente de confirmation
    const notifyingPassenger = this.notificationsService.create({
      userId: passenger.user.id,
      bookingId: booking.id,
      type: 'BOOKING_PENDING',
      titre: 'Réservation en attente',
      message: `Votre réservation ${dto.departure} → ${dto.destination} est enregistrée. En attente de confirmation par le chauffeur.`,
      data: { bookingId: booking.id, places: dto.places, prix: prixTotal },
    });

    await Promise.all([notifyingDriver, notifyingPassenger]);

    return booking;
  }

  // ─────────────────────────────────────────────────
  // LECTURE
  // ─────────────────────────────────────────────────

  async findAllForUser(userId: string, role: string) {
    if (role === Role.PASSAGER) {
      const passenger = await this.prisma.passenger.findUnique({ where: { userId } });
      if (!passenger) return [];
      return this.prisma.booking.findMany({
        where: { passengerId: passenger.id },
        include: {
          vehicle: true,
          driver: { include: { user: { select: { nom: true, telephone: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (role === Role.CHAUFFEUR) {
      const driver = await this.prisma.driver.findUnique({ where: { userId } });
      if (!driver) return [];
      return this.prisma.booking.findMany({
        where: { driverId: driver.id },
        include: {
          vehicle: true,
          passenger: { include: { user: { select: { nom: true, telephone: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // ADMIN — toutes les réservations
    return this.prisma.booking.findMany({
      include: { vehicle: true, passenger: true, driver: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, role: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        vehicle: true,
        passenger: { include: { user: { select: { nom: true, telephone: true, id: true } } } },
        driver: { include: { user: { select: { nom: true, telephone: true, id: true } } } },
        payment: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Réservation ${id} introuvable`);
    }

    if (
      role !== Role.ADMIN &&
      booking.passenger.user.id !== userId &&
      booking.driver.user.id !== userId
    ) {
      throw new ForbiddenException('Vous n\'avez pas accès à cette réservation');
    }

    return booking;
  }

  // ─────────────────────────────────────────────────
  // MISE À JOUR STATUT — Machine à états simplifiée (MVP)
  // ─────────────────────────────────────────────────

  async updateStatus(
    id: string,
    userId: string,
    role: string,
    dto: UpdateBookingStatusDto,
  ) {
    const booking = await this.findOne(id, userId, role);

    // ── Annulation ──────────────────────────────────
    if (booking.statut === BookingStatut.CANCELLED) {
      throw new BadRequestException('Cette réservation a déjà été annulée');
    }

    if (dto.statut === BookingStatut.CANCELLED) {
      if (
        booking.statut === BookingStatut.COMPLETED ||
        booking.statut === BookingStatut.IN_PROGRESS
      ) {
        throw new BadRequestException('Impossible d\'annuler un trajet en cours ou terminé');
      }

      const cancelledByPassenger = booking.passenger.user.id === userId;
      const cancelledByDriver = booking.driver.user.id === userId;

      if (!cancelledByPassenger && !cancelledByDriver && role !== Role.ADMIN) {
        throw new ForbiddenException('Vous ne pouvez pas annuler cette réservation');
      }

      const cancellationReason = dto.cancelReason
        ? dto.cancelReason
        : cancelledByPassenger
        ? 'Annulation passager'
        : 'Annulation chauffeur';

      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.booking.update({
          where: { id },
          data: {
            statut: BookingStatut.CANCELLED,
            cancelledAt: new Date(),
            cancelReason: cancellationReason,
          },
        });

        await tx.vehicle.update({
          where: { id: booking.vehicleId },
          data: { placesDisponibles: { increment: booking.places } },
        });

          if (booking.payment && booking.payment.statut === PaymentStatut.COMPLETED) {
          const policy = this.getCancellationPolicy(booking, cancelledByPassenger);
          if (policy.action === 'refund') {
            await this.escrowService.refundFunds(booking.id, policy.reason);
          }
        }

        return result;
      });

      const otherUserId = cancelledByPassenger
        ? booking.driver.user.id
        : booking.passenger.user.id;

      await this.notificationsService.create({
        userId: otherUserId,
        bookingId: id,
        type: 'RESERVATION_CANCELLED',
        titre: 'Réservation annulée',
        message: `La réservation ${booking.departure} → ${booking.destination} a été annulée.`,
      });

      return updated;
    }

    // ── Confirmation par le chauffeur ───────────────
    if (dto.statut === BookingStatut.CONFIRMED) {
      if (role !== Role.CHAUFFEUR) {
        throw new ForbiddenException('Seul le chauffeur peut confirmer la réservation');
      }
      if (booking.statut !== BookingStatut.PENDING) {
        throw new BadRequestException('La réservation doit être en attente pour être confirmée');
      }

      const updated = await this.prisma.booking.update({
        where: { id },
        data: { statut: BookingStatut.CONFIRMED },
      });

      await this.notificationsService.create({
        userId: booking.passenger.user.id,
        bookingId: id,
        type: 'RESERVATION_CONFIRMED',
        titre: 'Réservation confirmée',
        message: `Votre chauffeur a confirmé votre réservation ${booking.departure} → ${booking.destination}. Procédez au paiement.`,
      });

      return updated;
    }

    // ── Trajet terminé par le chauffeur ────────────
    if (dto.statut === BookingStatut.COMPLETED) {
      if (role !== Role.CHAUFFEUR) {
        throw new ForbiddenException('Seul le chauffeur peut terminer le trajet');
      }
      if (booking.statut !== BookingStatut.IN_PROGRESS) {
        throw new BadRequestException('Le trajet doit être en cours pour être terminé');
      }

      const completed = await this.prisma.booking.update({
        where: { id },
        data: { statut: BookingStatut.COMPLETED, completedAt: new Date() },
      });

      const released = await this.escrowService.releaseFunds(id);

      await this.notificationsService.create({
        userId: booking.passenger.user.id,
        bookingId: id,
        type: 'TRIP_COMPLETED',
        titre: 'Trajet terminé',
        message: `Votre trajet ${booking.departure} → ${booking.destination} est terminé. Les fonds sont en cours de libération pour le chauffeur.`,
      });

      return released;
    }

    // Par défaut (ADMIN ou cas non couverts ci-dessus)
    return this.prisma.booking.update({
      where: { id },
      data: { statut: dto.statut },
    });
  }

  private getCancellationPolicy(booking: any, cancelledByPassenger: boolean) {
    if (!booking.payment || booking.payment.statut !== PaymentStatut.COMPLETED) {
      return { action: 'no_refund', reason: 'Aucun paiement à rembourser' };
    }

    const isEarlyCancellation = booking.scheduledAt
      ? new Date(booking.scheduledAt).getTime() - Date.now() >= 2 * 60 * 60 * 1000
      : true;

    if (!cancelledByPassenger) {
      return { action: 'refund', reason: 'Annulation par le chauffeur - remboursement intégral' };
    }

    if (isEarlyCancellation) {
      return { action: 'refund', reason: 'Annulation client > 2h avant le départ - remboursement intégral' };
    }

    return { action: 'refund', reason: 'Annulation client tardive - remboursement partiel (flux de remboursement à implémenter)' };
  }

  // ─────────────────────────────────────────────────
  // DÉMARRAGE DU TRAJET — Validation GPS + OTP/QR
  // ─────────────────────────────────────────────────

  async startTrip(id: string, userId: string, role: string, dto: StartBookingDto) {
    if (role !== Role.CHAUFFEUR) {
      throw new ForbiddenException('Seul le chauffeur peut démarrer le trajet');
    }

    const booking = await this.findOne(id, userId, role);

    if (booking.statut !== BookingStatut.PAID) {
      throw new BadRequestException(
        'La réservation doit être payée avant de démarrer le trajet',
      );
    }

    // 1. Validation GPS — vérifie que chauffeur et passager sont proches
    this.gpsService.verifyProximity(
      dto.driverLatitude,
      dto.driverLongitude,
      dto.passengerLatitude,
      dto.passengerLongitude,
    );

    // 2. Validation OTP ou QR Code — au moins un des deux est requis
    let isValidated = false;

    if (dto.otp) {
      isValidated = this.otpService.verifyOtp(
        dto.otp,
        booking.otpCode,
        booking.otpExpiresAt,
      );
      if (!isValidated) {
        throw new BadRequestException('Code OTP invalide ou expiré');
      }
    } else if (dto.qrData) {
      try {
        const parsedData = JSON.parse(dto.qrData) as { bookingId: string };
        if (parsedData.bookingId !== booking.id) {
          throw new BadRequestException('QR Code invalide pour cette réservation');
        }
        isValidated = true;
      } catch {
        throw new BadRequestException('Données QR Code mal formées');
      }
    } else {
      throw new BadRequestException(
        'Vous devez fournir un OTP ou un QR Code scanné pour valider le trajet',
      );
    }

    // 3. Mettre à jour la réservation
    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        statut: BookingStatut.IN_PROGRESS,
        startedAt: new Date(),
        gpsValidated: true,
        otpVerified: !!dto.otp && isValidated,
        qrCodeScanned: !!dto.qrData && isValidated,
        otpCode: null,       // Invalider l'OTP après utilisation
        otpExpiresAt: null,
      },
    });

    // 4. Notifier le passager
    await this.notificationsService.create({
      userId: booking.passenger.user.id,
      bookingId: id,
      type: 'TRIP_STARTED',
      titre: 'Trajet démarré',
      message: `Votre trajet vers ${booking.destination} a démarré !`,
    });

    return updated;
  }
}
