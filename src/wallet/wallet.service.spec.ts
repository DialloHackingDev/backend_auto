import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { PrismaService } from '../prisma/prisma.service';
import { EscrowService } from '../escrow/escrow.service';

describe('WalletService', () => {
  let service: WalletService;
  let prisma: any;
  let escrowService: any;

  beforeEach(async () => {
    prisma = {
      driver: { findUnique: jest.fn() },
      wallet: { findUnique: jest.fn() },
      booking: { findMany: jest.fn() },
    };
    escrowService = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: prisma },
        { provide: EscrowService, useValue: escrowService },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  it('should return a balance summary for the driver', async () => {
    prisma.driver.findUnique.mockResolvedValue({ id: 'driver-id' });
    prisma.wallet.findUnique.mockResolvedValue({
      id: 'wallet-id',
      balance: 200000,
      pendingBalance: 50000,
      withdrawableBalance: 150000,
      withdrawals: [
        { commission: 5000, montant: 10000 },
        { commission: 0, montant: 5000 },
      ],
    });

    const result = await service.getBalance('driver-user-id');

    expect(result.balance).toBe(200000);
    expect(result.withdrawableBalance).toBe(150000);
    expect(result.pendingBalance).toBe(50000);
    expect(result.totalCommissionPaid).toBe(5000);
    expect(result.totalWithdrawalsRequested).toBe(15000);
    expect(result.recentWithdrawals).toHaveLength(2);
  });

  it('should throw when the driver is not found', async () => {
    prisma.driver.findUnique.mockResolvedValue(null);

    await expect(service.getBalance('unknown-user-id')).rejects.toThrow(NotFoundException);
  });

  it('should return history data for the driver', async () => {
    prisma.driver.findUnique.mockResolvedValue({ id: 'driver-id' });
    prisma.wallet.findUnique.mockResolvedValue({
      id: 'wallet-id',
      balance: 120000,
      pendingBalance: 20000,
      withdrawableBalance: 100000,
      withdrawals: [
        {
          id: 'withdrawal-1',
          montant: 50000,
          commission: 5000,
          montantNet: 45000,
          operateur: 'ORANGE',
          telephone: '+224620000000',
          statut: 'PROCESSING',
          reference: 'REF-1',
          createdAt: new Date('2026-01-01T12:00:00Z'),
          updatedAt: new Date('2026-01-01T12:00:00Z'),
        },
      ],
    });
    prisma.booking.findMany.mockResolvedValue([
      {
        id: 'booking-1',
        completedAt: new Date('2026-01-01T11:00:00Z'),
        payment: { montant: 100000 },
      },
    ]);

    const result = await service.getHistory('driver-user-id');

    expect(result.wallet.balance).toBe(120000);
    expect(result.wallet.withdrawableBalance).toBe(100000);
    expect(result.history.withdrawals).toHaveLength(1);
    expect(result.history.earnings).toEqual([
      { bookingId: 'booking-1', amount: 100000, date: new Date('2026-01-01T11:00:00Z') },
    ]);
  });
});
