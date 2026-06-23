import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';

const COMMISSION_RATE = 0.10; // 10% — configurable en Sprint 4 via ConfigService

/**
 * WithdrawalsService
 *
 * Gère les demandes de retrait des chauffeurs.
 * Calcule automatiquement la commission plateforme (10%)
 * et notifie le chauffeur quand le retrait est initié.
 *
 * TODO Sprint 4 : Appeler l'API Mobile Money pour le vrai transfert
 * et gérer les callbacks (statut PROCESSING → COMPLETED/FAILED)
 */
@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateWithdrawalDto) {
    // 1. Récupérer le profil chauffeur + son wallet
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!driver) {
      throw new NotFoundException('Profil chauffeur introuvable');
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: { driverId: driver.id },
    });

    if (!wallet) {
      throw new NotFoundException('Portefeuille introuvable');
    }

    // 2. Vérifier le solde disponible
    if (wallet.withdrawableBalance < dto.montant) {
      throw new BadRequestException(
        `Solde insuffisant. Disponible : ${wallet.withdrawableBalance} GNF, demandé : ${dto.montant} GNF`,
      );
    }

    // 3. Calculer la commission et le montant net
    const commission = dto.montant * COMMISSION_RATE;
    const montantNet = dto.montant - commission;

    // 4. Transaction : déduire du wallet + créer le retrait
    const withdrawal = await this.prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          withdrawableBalance: { decrement: dto.montant },
          balance: { decrement: dto.montant },
        },
      });

      return tx.withdrawal.create({
        data: {
          walletId: wallet.id,
          montant: dto.montant,
          commission,
          montantNet,
          operateur: dto.operateur,
          telephone: dto.telephone,
          // Statut PENDING — à passer à PROCESSING après appel API Mobile Money
        },
      });
    });

    // 5. Notifier le chauffeur
    await this.notificationsService.create({
      userId,
      type: 'WITHDRAWAL_INITIATED',
      titre: 'Demande de retrait initiée',
      message: `Votre retrait de ${montantNet.toLocaleString()} GNF (commission : ${commission.toLocaleString()} GNF) a été initié vers ${dto.operateur} (${dto.telephone}).`,
      data: {
        montant: dto.montant,
        commission,
        montantNet,
        operateur: dto.operateur,
      },
    });

    return withdrawal;
  }

  async findAllForDriver(userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });

    if (!driver) {
      throw new NotFoundException('Profil chauffeur introuvable');
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: { driverId: driver.id },
    });

    if (!wallet) {
      return [];
    }

    return this.prisma.withdrawal.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
