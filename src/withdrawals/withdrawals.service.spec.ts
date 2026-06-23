import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WithdrawalsService } from './withdrawals.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ConfigService } from '@nestjs/config';
import { WithdrawalStatut } from '@prisma/client';

describe('WithdrawalsService', () => {
  let service: WithdrawalsService;
  let prisma: any;
  let notificationsService: any;
  let configService: any;

  beforeEach(async () => {
    prisma = {
      driver: { findUnique: jest.fn() },
      wallet: { findUnique: jest.fn(), update: jest.fn() },
      withdrawal: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    notificationsService = { create: jest.fn() };
    configService = { get: jest.fn().mockReturnValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<WithdrawalsService>(WithdrawalsService);
  });

  it('should create a withdrawal and deduct the wallet balance', async () => {
    const driver = { id: 'driver-id', user: { id: 'user-id' } };
    const wallet = { id: 'wallet-id', withdrawableBalance: 80000, balance: 80000 };
    const withdrawal = {
      id: 'withdrawal-id',
      walletId: wallet.id,
      montant: 50000,
      commission: 5000,
      montantNet: 45000,
      operateur: 'ORANGE',
      telephone: '+224620000000',
      statut: WithdrawalStatut.PROCESSING,
      reference: 'WD-123',
    };

    prisma.driver.findUnique.mockResolvedValue(driver);
    prisma.wallet.findUnique.mockResolvedValue(wallet);
    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        wallet: { update: jest.fn().mockResolvedValue({}) },
        withdrawal: { create: jest.fn().mockResolvedValue(withdrawal) },
      } as any;
      return callback(tx);
    });

    service['submitMobileMoneyTransfer'] = jest.fn().mockResolvedValue({});

    const result = await service.create('user-id', {
      montant: 50000,
      operateur: 'ORANGE',
      telephone: '+224620000000',
    });

    expect(prisma.wallet.findUnique).toHaveBeenCalledWith({ where: { driverId: driver.id } });
    expect(result.id).toBe(withdrawal.id);
    expect(result.message).toContain('Retrait initié');
  });

  it('should reject withdrawal creation when balance is insufficient', async () => {
    prisma.driver.findUnique.mockResolvedValue({ id: 'driver-id', user: { id: 'user-id' } });
    prisma.wallet.findUnique.mockResolvedValue({ id: 'wallet-id', withdrawableBalance: 10000, balance: 10000 });

    await expect(
      service.create('user-id', {
        montant: 20000,
        operateur: 'ORANGE',
        telephone: '+224620000000',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should complete a withdrawal callback', async () => {
    const withdrawal = {
      id: 'withdrawal-id',
      walletId: 'wallet-id',
      montant: 50000,
      operateur: 'ORANGE',
      reference: 'WD-123',
      statut: WithdrawalStatut.PROCESSING,
    };

    prisma.withdrawal.findUnique.mockResolvedValue(withdrawal);
    prisma.withdrawal.update.mockResolvedValue({ ...withdrawal, statut: WithdrawalStatut.COMPLETED });
    prisma.wallet.findUnique.mockResolvedValue({ driver: { user: { id: 'user-id' } } });

    const result = await service.handleWebhook({ withdrawalId: withdrawal.id, statut: WithdrawalStatut.COMPLETED });

    expect(result.message).toContain('complété');
    expect(prisma.withdrawal.update).toHaveBeenCalled();
  });

  it('should fail a withdrawal callback and refund the wallet', async () => {
    const withdrawal = {
      id: 'withdrawal-id',
      walletId: 'wallet-id',
      montant: 50000,
      operateur: 'ORANGE',
      reference: 'WD-123',
      statut: WithdrawalStatut.PROCESSING,
    };

    prisma.withdrawal.findUnique.mockResolvedValue(withdrawal);
    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        withdrawal: { update: jest.fn().mockResolvedValue({ ...withdrawal, statut: WithdrawalStatut.FAILED }) },
        wallet: { update: jest.fn().mockResolvedValue({}) },
      } as any;
      return callback(tx);
    });
    prisma.wallet.findUnique.mockResolvedValue({ driver: { user: { id: 'user-id' } } });

    const result = await service.handleWebhook({ withdrawalId: withdrawal.id, statut: WithdrawalStatut.FAILED, failReason: 'Erreur opérateur' });

    expect(result.message).toContain('échoué');
    expect(prisma.wallet.findUnique).toHaveBeenCalledWith({
      where: { id: withdrawal.walletId },
      include: { driver: { include: { user: true } } },
    });
  });

  it('should list withdrawals for a driver', async () => {
    prisma.driver.findUnique.mockResolvedValue({ id: 'driver-id' });
    prisma.wallet.findUnique.mockResolvedValue({ id: 'wallet-id' });
    prisma.withdrawal.findMany.mockResolvedValue([{ id: 'withdrawal-id' }]);

    const result = await service.findAllForDriver('driver-user-id');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('withdrawal-id');
  });
});
