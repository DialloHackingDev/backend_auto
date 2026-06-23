import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { DisputeStatut, BookingStatut, Role } from '@prisma/client';

/**
 * DisputesService
 *
 * Responsabilités :
 * - Ouvrir un litige sur une réservation (passager ou chauffeur)
 * - Lister les litiges (filtrés selon le rôle)
 * - Résoudre ou rejeter un litige (ADMIN uniquement)
 *
 * Règles métier :
 * - Un litige ne peut être ouvert que si la réservation est dans un état valide (non PENDING)
 * - Un seul litige actif (OUVERT / EN_COURS) par réservation à la fois
 * - Seul un acteur de la réservation (passager ou chauffeur) peut ouvrir un litige
 * - Seul l'ADMIN peut résoudre/rejeter
 */
@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateDisputeDto) {
    // 1. Vérifier que la réservation existe et que l'utilisateur y est lié
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

    const isPassenger = booking.passenger.user.id === userId;
    const isDriver = booking.driver.user.id === userId;

    if (!isPassenger && !isDriver) {
      throw new ForbiddenException(
        'Vous devez être impliqué dans cette réservation pour ouvrir un litige',
      );
    }

    // 2. Vérifier qu'il n'y a pas déjà un litige actif sur cette réservation
    const existingDispute = await this.prisma.dispute.findFirst({
      where: {
        bookingId: dto.bookingId,
        statut: { in: [DisputeStatut.OUVERT, DisputeStatut.EN_COURS] },
      },
    });

    if (existingDispute) {
      throw new ConflictException(
        'Un litige est déjà ouvert pour cette réservation',
      );
    }

    // 3. Créer le litige et passer la réservation en DISPUTE
    const [dispute] = await this.prisma.$transaction([
      this.prisma.dispute.create({
        data: {
          bookingId: dto.bookingId,
          userId,
          description: dto.description,
          statut: DisputeStatut.OUVERT,
        },
      }),
      this.prisma.booking.update({
        where: { id: dto.bookingId },
        data: { statut: BookingStatut.DISPUTE },
      }),
    ]);

    // 4. Notifier l'autre partie du litige
    const otherUserId = isPassenger
      ? booking.driver.user.id
      : booking.passenger.user.id;

    await this.notificationsService.create({
      userId: otherUserId,
      bookingId: dto.bookingId,
      type: 'DISPUTE_OPENED',
      titre: 'Litige ouvert',
      message: `Un litige a été ouvert sur votre réservation ${booking.departure} → ${booking.destination}.`,
    });

    return dispute;
  }

  /**
   * Liste les litiges selon le rôle de l'utilisateur :
   * - ADMIN : tous les litiges
   * - PASSAGER / CHAUFFEUR : seulement ses propres litiges
   */
  async findAll(userId: string, role: string) {
    if (role === Role.ADMIN) {
      return this.prisma.dispute.findMany({
        include: {
          booking: { select: { departure: true, destination: true, prix: true } },
          user: { select: { nom: true, telephone: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.dispute.findMany({
      where: { userId },
      include: {
        booking: { select: { departure: true, destination: true, prix: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, role: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        booking: true,
        user: { select: { nom: true, telephone: true, role: true } },
      },
    });

    if (!dispute) {
      throw new NotFoundException('Litige introuvable');
    }

    // Un non-admin ne peut voir que ses propres litiges
    if (role !== Role.ADMIN && dispute.userId !== userId) {
      throw new NotFoundException('Litige introuvable');
    }

    return dispute;
  }

  /**
   * Résoudre ou rejeter un litige — ADMIN uniquement.
   * Notifie les deux parties de la décision.
   */
  async resolve(id: string, adminId: string, dto: ResolveDisputeDto) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            passenger: { include: { user: true } },
            driver: { include: { user: true } },
          },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException('Litige introuvable');
    }

    if (
      dispute.statut === DisputeStatut.RESOLU ||
      dispute.statut === DisputeStatut.REJETE
    ) {
      throw new ConflictException('Ce litige est déjà clôturé');
    }

    const updatedDispute = await this.prisma.dispute.update({
      where: { id },
      data: {
        statut: dto.statut,
        resolution: dto.resolution,
        resolvedBy: adminId,
        resolvedAt: new Date(),
      },
    });

    // Notifier les deux parties (passager + chauffeur)
    const statusLabel =
      dto.statut === DisputeStatut.RESOLU ? 'résolu' : 'rejeté';

    const notifPayload = {
      bookingId: dispute.bookingId,
      type: 'DISPUTE_RESOLVED',
      titre: `Litige ${statusLabel}`,
      message: `Votre litige a été ${statusLabel}. Décision : ${dto.resolution}`,
    };

    await Promise.all([
      this.notificationsService.create({
        ...notifPayload,
        userId: dispute.booking.passenger.user.id,
      }),
      this.notificationsService.create({
        ...notifPayload,
        userId: dispute.booking.driver.user.id,
      }),
    ]);

    return updatedDispute;
  }
}
