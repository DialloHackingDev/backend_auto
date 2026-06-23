import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { WithdrawalWebhookDto } from './dto/withdrawal-webhook.dto';
import { WithdrawalStatut } from '@prisma/client';

const COMMISSION_RATE = 0.10; // 10% — configurable en Sprint 4 via ConfigService

/**
 * WithdrawalsService
 *
 * Gère les demandes de retrait des chauffeurs.
 * Calcule automatiquement la commission plateforme (10%)
 * et notifie le chauffeur quand le retrait est initié.
 */
@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  async create(userId: string, dto: CreateWithdrawalDto) {
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

    if (wallet.withdrawableBalance < dto.montant) {
      throw new BadRequestException(
        `Solde insuffisant. Disponible : ${wallet.withdrawableBalance} GNF, demandé : ${dto.montant} GNF`,
      );
    }

    const commission = dto.montant * COMMISSION_RATE;
    const montantNet = dto.montant - commission;
    const reference = `WD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

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
          statut: WithdrawalStatut.PROCESSING,
          reference,
        },
      });
    });

    await this.submitMobileMoneyTransfer(withdrawal);

    await this.notificationsService.create({
      userId,
      type: 'WITHDRAWAL_PROCESSING',
      titre: 'Retrait en cours de traitement',
      message: `Votre retrait de ${montantNet.toLocaleString()} GNF est en cours de traitement vers ${dto.operateur}.`,
      data: {
        montant: dto.montant,
        commission,
        montantNet,
        operateur: dto.operateur,
        reference,
      },
    });

    return {
      ...withdrawal,
      message: 'Retrait initié et en cours de traitement. Le statut évoluera après le callback opérateur.',
    };
  }

  async handleWebhook(dto: WithdrawalWebhookDto) {
    const withdrawal = await this.findWithdrawalForWebhook(dto);

    if (!withdrawal) {
      throw new NotFoundException('Retrait introuvable pour ce callback');
    }

    if (dto.statut === WithdrawalStatut.PROCESSING) {
      if (withdrawal.statut !== WithdrawalStatut.PROCESSING) {
        await this.prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: { statut: WithdrawalStatut.PROCESSING },
        });
      }

      return {
        message: 'Callback reçu : retrait en cours de traitement.',
        withdrawalId: withdrawal.id,
      };
    }

    if (dto.statut === WithdrawalStatut.COMPLETED) {
      return this.completeWithdrawal(withdrawal, dto);
    }

    if (dto.statut === WithdrawalStatut.FAILED) {
      return this.failWithdrawal(withdrawal, dto);
    }

    throw new BadRequestException('Statut de callback non pris en charge');
  }

  private async findWithdrawalForWebhook(dto: WithdrawalWebhookDto) {
    if (dto.withdrawalId) {
      return this.prisma.withdrawal.findUnique({
        where: { id: dto.withdrawalId },
      });
    }

    if (dto.reference) {
      return this.prisma.withdrawal.findFirst({
        where: { reference: dto.reference },
      });
    }

    return null;
  }

  private async completeWithdrawal(withdrawal: any, dto: WithdrawalWebhookDto) {
    if (withdrawal.statut === WithdrawalStatut.COMPLETED) {
      return {
        message: 'Retrait déjà terminé.',
        withdrawalId: withdrawal.id,
      };
    }

    const updatedWithdrawal = await this.prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        statut: WithdrawalStatut.COMPLETED,
        reference: dto.reference ?? withdrawal.reference,
      },
    });

    const wallet = await this.prisma.wallet.findUnique({
      where: { id: withdrawal.walletId },
      include: { driver: { include: { user: true } } },
    });

    if (wallet?.driver?.user) {
      await this.notificationsService.create({
        userId: wallet.driver.user.id,
        type: 'WITHDRAWAL_COMPLETED',
        titre: 'Retrait effectué',
        message: `Votre retrait de ${withdrawal.montant.toLocaleString()} GNF a été effectué avec succès.`,
        data: {
          montant: withdrawal.montant,
          montantNet: withdrawal.montantNet,
          operateur: withdrawal.operateur,
          reference: updatedWithdrawal.reference,
        },
      });
    }

    return {
      message: 'Retrait complété avec succès.',
      withdrawal: updatedWithdrawal,
    };
  }

  private async failWithdrawal(withdrawal: any, dto: WithdrawalWebhookDto) {
    if (withdrawal.statut === WithdrawalStatut.FAILED) {
      return {
        message: 'Retrait déjà marqué comme échoué.',
        withdrawalId: withdrawal.id,
      };
    }

    const updatedWithdrawal = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          statut: WithdrawalStatut.FAILED,
          reference: dto.reference ?? withdrawal.reference,
        },
      });

      await tx.wallet.update({
        where: { id: withdrawal.walletId },
        data: {
          withdrawableBalance: { increment: withdrawal.montant },
          balance: { increment: withdrawal.montant },
        },
      });

      return updated;
    });

    const wallet = await this.prisma.wallet.findUnique({
      where: { id: withdrawal.walletId },
      include: { driver: { include: { user: true } } },
    });

    if (wallet?.driver?.user) {
      await this.notificationsService.create({
        userId: wallet.driver.user.id,
        type: 'WITHDRAWAL_FAILED',
        titre: 'Retrait échoué',
        message: `Votre retrait de ${withdrawal.montant.toLocaleString()} GNF a échoué. Le montant a été remboursé sur votre portefeuille.`,
        data: {
          montant: withdrawal.montant,
          operateur: withdrawal.operateur,
          reference: updatedWithdrawal.reference,
          failReason: dto.failReason,
        },
      });
    }

    return {
      message: 'Retrait échoué et montant remboursé sur le portefeuille.',
      withdrawal: updatedWithdrawal,
    };
  }

  private async submitMobileMoneyTransfer(withdrawal: any) {
    const operator = withdrawal.operateur?.toUpperCase() ?? 'UNKNOWN';
    const config = this.getOperatorConfig(operator);

    this.logger.log(
      `Envoi de la demande de retrait ${withdrawal.id} vers ${operator}. URL=${config.url ?? 'stub'}`,
    );

    if (!config.url) {
      this.logger.log('Aucun endpoint mobile money configuré. Utilisation d’un stub local.');
      return {
        message: `Succès simulé du transfert Mobile Money vers ${operator}.`,
        reference: withdrawal.reference,
      };
    }

    // Simuler l'appel API sans se bloquer si l'API n'est pas disponible.
    this.logger.log(
      `Stub API Mobile Money: ${config.url} (clé ${config.key ? 'présente' : 'absente'})`,
    );

    return {
      message: `Demande de retrait envoyée à l’opérateur ${operator}.`,
      reference: withdrawal.reference,
    };
  }

  private getOperatorConfig(operator: string) {
    if (operator === 'ORANGE') {
      return {
        url: this.configService.get<string>('ORANGE_MONEY_API_URL'),
        key: this.configService.get<string>('ORANGE_MONEY_API_KEY'),
      };
    }

    if (operator === 'MTN') {
      return {
        url: this.configService.get<string>('MTN_MONEY_API_URL'),
        key: this.configService.get<string>('MTN_MONEY_API_KEY'),
      };
    }

    return { url: null, key: null };
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
