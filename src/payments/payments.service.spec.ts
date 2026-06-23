import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EscrowService } from '../escrow/escrow.service';
import { QrService } from '../qr/qr.service';
import { OtpService } from '../otp/otp.service';
import { ConfigService } from '@nestjs/config';
import { BookingStatut, PaymentMethode, PaymentStatut } from '@prisma/client';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: any;
  let notificationsService: any;
  let escrowService: any;
  let qrService: any;
  let otpService: any;
  let configService: any;

  beforeEach(async () => {
    prisma = {
      booking: { findUnique: jest.fn() },
      payment: { create: jest.fn(), findFirst: jest.fn() },
      escrow: { create: jest.fn() },
      wallet: { upsert: jest.fn() },
      $transaction: jest.fn(),
    };
    notificationsService = { create: jest.fn() };
    escrowService = {};
    qrService = { generateBookingQrCode: jest.fn() };
    otpService = { generateOtp: jest.fn(), getExpirationDate: jest.fn() };
    configService = { get: jest.fn().mockReturnValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: EscrowService, useValue: escrowService },
        { provide: QrService, useValue: qrService },
        { provide: OtpService, useValue: otpService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should create a payment and return processing info when no operator API is configured', async () => {
    const booking = {
      id: 'booking-id',
      statut: BookingStatut.PENDING,
      prix: 120000,
      passenger: { user: { id: 'passenger-user-id' } },
      driver: { user: { id: 'driver-user-id' } },
    };
    const payment = {
      id: 'payment-id',
      bookingId: booking.id,
      montant: 120000,
      statut: PaymentStatut.PROCESSING,
      transactionId: 'TXN-123',
      operateur: 'ORANGE',
      telephone: '+224620000000',
    };

    prisma.booking.findUnique.mockResolvedValue(booking);
    prisma.payment.create.mockResolvedValue(payment);

    const result = await service.create({
      bookingId: booking.id,
      montant: 120000,
      methode: PaymentMethode.ORANGE_MONEY,
      telephone: '+224620000000',
    });

    expect(prisma.booking.findUnique).toHaveBeenCalledWith({
      where: { id: booking.id },
      include: {
        passenger: { include: { user: true } },
        driver: { include: { user: true } },
      },
    });
    expect(prisma.payment.create).toHaveBeenCalled();
    expect(result.paymentId).toBe(payment.id);
    expect(result.statut).toBe(payment.statut);
    expect(result.message).toContain('callback');
  });

  it('should reject payment creation when booking is not found', async () => {
    prisma.booking.findUnique.mockResolvedValue(null);

    await expect(
      service.create({
        bookingId: 'missing-booking',
        montant: 100000,
        methode: PaymentMethode.ORANGE_MONEY,
        telephone: '+224620000000',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject payment creation when amount is invalid', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-id',
      statut: BookingStatut.PENDING,
      prix: 100000,
      passenger: { user: { id: 'passenger-user-id' } },
      driver: { user: { id: 'driver-user-id' } },
    });

    await expect(
      service.create({
        bookingId: 'booking-id',
        montant: 110000,
        methode: PaymentMethode.ORANGE_MONEY,
        telephone: '+224620000000',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject payment creation when mobile money phone is missing', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-id',
      statut: BookingStatut.CONFIRMED,
      prix: 100000,
      passenger: { user: { id: 'passenger-user-id' } },
      driver: { user: { id: 'driver-user-id' } },
    });

    await expect(
      service.create({
        bookingId: 'booking-id',
        montant: 100000,
        methode: PaymentMethode.MTN_MONEY,
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should confirm payment on webhook callback and generate QR/OTP', async () => {
    const payment = {
      id: 'payment-id',
      bookingId: 'booking-id',
      montant: 100000,
      statut: PaymentStatut.PROCESSING,
      transactionId: 'TXN-123',
      operateur: 'ORANGE',
      telephone: '+224620000000',
      booking: {
        id: 'booking-id',
        passenger: { user: { id: 'passenger-user-id' } },
        driver: { user: { id: 'driver-user-id' } },
      },
    };
    const booking = {
      id: 'booking-id',
      passenger: { user: { id: 'passenger-user-id' } },
      driver: { user: { id: 'driver-user-id' } },
    };

    prisma.payment.findFirst.mockResolvedValue(payment);
    prisma.booking.findUnique.mockResolvedValue(booking);
    qrService.generateBookingQrCode.mockResolvedValue('qr-data');
    otpService.generateOtp.mockReturnValue('123456');
    otpService.getExpirationDate.mockReturnValue(new Date(Date.now() + 1000 * 60 * 60));

    const tx = {
      payment: { update: jest.fn().mockResolvedValue({ ...payment, statut: PaymentStatut.COMPLETED }) },
      booking: { update: jest.fn().mockResolvedValue({ id: booking.id, statut: BookingStatut.PAID }) },
      escrow: { create: jest.fn().mockResolvedValue({ id: 'escrow-id' }) },
      wallet: { upsert: jest.fn().mockResolvedValue({ id: 'wallet-id' }) },
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const result = await service.handleWebhook({
      transactionId: payment.transactionId,
      statut: PaymentStatut.COMPLETED,
      montant: payment.montant,
    });

    expect(prisma.payment.findFirst).toHaveBeenCalledWith({
      where: { transactionId: payment.transactionId },
      include: {
        booking: {
          include: {
            passenger: { include: { user: true } },
            driver: { include: { user: true } },
          },
        },
      },
    });
    expect(result.message).toContain('Paiement confirmé');
    expect(tx.payment.update).toHaveBeenCalled();
    expect(tx.booking.update).toHaveBeenCalled();
    expect(tx.escrow.create).toHaveBeenCalled();
    expect(tx.wallet.upsert).toHaveBeenCalled();
  });

  it('should reject webhook callback when amount mismatches payment', async () => {
    const payment = {
      id: 'payment-id',
      bookingId: 'booking-id',
      montant: 100000,
      statut: PaymentStatut.PROCESSING,
      transactionId: 'TXN-123',
      operateur: 'ORANGE',
      telephone: '+224620000000',
    };

    prisma.payment.findFirst.mockResolvedValue(payment);

    await expect(
      service.handleWebhook({
        transactionId: payment.transactionId,
        statut: PaymentStatut.COMPLETED,
        montant: 90000,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
