import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EscrowService } from './escrow.service';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatut, PaymentStatut } from '@prisma/client';

describe('EscrowService', () => {
  let service: EscrowService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      booking: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
  });

  it('should release funds and update the booking', async () => {
    const booking = {
      id: 'booking-id',
      driverId: 'driver-id',
      payment: {
        id: 'payment-id',
        montant: 100000,
        escrow: { id: 'escrow-id', isReleased: false },
      },
    };
    const wallet = { id: 'wallet-id' };

    prisma.booking.findUnique.mockResolvedValue(booking);
    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        escrow: { update: jest.fn().mockResolvedValue({}) },
        wallet: {
          findUnique: jest.fn().mockResolvedValue(wallet),
          update: jest.fn().mockResolvedValue({}),
        },
        booking: { update: jest.fn().mockResolvedValue({ id: booking.id, statut: BookingStatut.FUNDS_RELEASED }) },
      } as any;
      return callback(tx);
    });

    const result = await service.releaseFunds('booking-id');

    expect(result.statut).toBe(BookingStatut.FUNDS_RELEASED);
  });

  it('should refund funds and update wallet balances', async () => {
    const booking = {
      id: 'booking-id',
      driverId: 'driver-id',
      payment: {
        id: 'payment-id',
        montant: 90000,
        escrow: { id: 'escrow-id', isReleased: false },
      },
    };

    prisma.booking.findUnique.mockResolvedValue(booking);
    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        escrow: { update: jest.fn().mockResolvedValue({}) },
        payment: {
          update: jest.fn().mockResolvedValue({ id: booking.payment.id, statut: PaymentStatut.REFUNDED }),
        },
        wallet: {
          findUnique: jest.fn().mockResolvedValue({ id: 'wallet-id' }),
          update: jest.fn().mockResolvedValue({}),
        },
      } as any;
      return callback(tx);
    });

    const result = await service.refundFunds('booking-id', 'Annulation du trajet');

    expect(result.bookingId).toBe('booking-id');
    expect(result.amount).toBe(90000);
  });

  it('should throw when escrow record is missing', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-id',
      driverId: 'driver-id',
      payment: null,
    });

    await expect(service.refundFunds('booking-id', 'Erreur')).rejects.toThrow(NotFoundException);
  });
});
