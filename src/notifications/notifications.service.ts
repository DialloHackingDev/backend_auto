import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

/**
 * NotificationsService
 *
 * Responsabilités :
 * - Créer des notifications lors d'événements métier (réservation, paiement, retrait…)
 * - Lister les notifications d'un utilisateur (avec filtre lu/non-lu)
 * - Marquer une ou toutes les notifications comme lues
 *
 * Ce service est conçu pour être injecté dans les autres services métier
 * (BookingsService, PaymentsService, WithdrawalsService…) sans dépendance circulaire,
 * car il ne dépend que de PrismaService.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crée une notification en base de données.
   * Appelé en interne par les services métier — jamais directement par le client.
   */
  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        bookingId: dto.bookingId,
        type: dto.type,
        titre: dto.titre,
        message: dto.message,
        data: dto.data as any,
      },
    });
  }

  /**
   * Retourne toutes les notifications de l'utilisateur connecté.
   * Par défaut : toutes (lues + non lues), triées par date décroissante.
   */
  async findAllForUser(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limite raisonnable pour la pagination future
    });
  }

  /**
   * Marque une notification spécifique comme lue.
   * Vérifie que la notification appartient bien à l'utilisateur (sécurité).
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification introuvable');
    }

    // Sécurité : un utilisateur ne peut marquer que SES notifications
    if (notification.userId !== userId) {
      throw new NotFoundException('Notification introuvable');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  /**
   * Marque toutes les notifications non lues de l'utilisateur comme lues.
   * Utile pour le bouton "Tout marquer comme lu".
   */
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return {
      message: `${result.count} notification(s) marquée(s) comme lue(s)`,
      count: result.count,
    };
  }

  /**
   * Retourne le nombre de notifications non lues (pour le badge UI).
   */
  async countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }
}
