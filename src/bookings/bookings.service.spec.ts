import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GpsService } from '../gps/gps.service';
import { OtpService } from '../otp/otp.service';
import { QrService } from '../qr/qr.service';
import { EscrowService } from '../escrow/escrow.service';
import { BookingStatut, PaymentStatut, Role } from '@prisma/client';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: any;
  let notificationsService: any;
  let gpsService: any;
  let otpService: any;
  let qrService: any;
  let escrowService: any;

  beforeEach(async () => {
    prisma = { booking: { update: jest.fn() } };
    notificationsService = { create: jest.fn() };
    gpsService = { verifyProximity: jest.fn() };
    otpService = { verifyOtp: jest.fn() };
    qrService = { decodeBookingQrData: jest.fn() };
    escrowService = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: GpsService, useValue: gpsService },
        { provide: OtpService, useValue: otpService },
        { provide: QrService, useValue: qrService },
        { provide: EscrowService, useValue: escrowService },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);

    // Override the internal findOne helper to avoid Prisma complexity
    service.findOne = jest.fn().mockImplementation(async () => ({
      id: 'booking-id',
      passenger: { user: { id: 'passenger-user-id' } },
      driver: { user: { id: 'driver-user-id' } },
      statut: BookingStatut.PAID,
      otpCode: '123456',
      otpExpiresAt: new Date(Date.now() + 1000 * 60),
      destination: 'Conakry',
    }));
  });

  it('should successfully start a trip using OTP when GPS is good', async () => {
    gpsService.verifyProximity.mockReturnValue({ distance: 20, maxDistance: 100 });
    otpService.verifyOtp.mockReturnValue(true);
    prisma.booking.update.mockResolvedValue({
      id: 'booking-id',
      statut: BookingStatut.IN_PROGRESS,
      gpsValidated: true,
      otpVerified: true,
      qrCodeScanned: false,
    });

    const result = await service.startTrip('booking-id', 'driver-user-id', Role.CHAUFFEUR, {
      driverLatitude: 9.60,
      driverLongitude: -13.68,
      passengerLatitude: 9.60,
      passengerLongitude: -13.68,
      otp: '123456',
    });

    expect(gpsService.verifyProximity).toHaveBeenCalled();
    expect(otpService.verifyOtp).toHaveBeenCalledWith('123456', '123456', expect.any(Date));
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-id' },
      data: expect.objectContaining({
        statut: BookingStatut.IN_PROGRESS,
        gpsValidated: true,
        otpVerified: true,
        qrCodeScanned: false,
      }),
    });
    expect(result.statut).toBe(BookingStatut.IN_PROGRESS);
  });

  it('should reject a startTrip when the booking is not paid', async () => {
    (service.findOne as jest.Mock).mockResolvedValueOnce({
      id: 'booking-id',
      passenger: { user: { id: 'passenger-user-id' } },
      driver: { user: { id: 'driver-user-id' } },
      statut: BookingStatut.CONFIRMED,
      otpCode: '123456',
      otpExpiresAt: new Date(Date.now() + 1000 * 60),
      destination: 'Conakry',
    });

    await expect(
      service.startTrip('booking-id', 'driver-user-id', Role.CHAUFFEUR, {
        driverLatitude: 9.60,
        driverLongitude: -13.68,
        passengerLatitude: 9.60,
        passengerLongitude: -13.68,
        otp: '123456',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject startTrip when GPS distance is too large', async () => {
    gpsService.verifyProximity.mockImplementation(() => {
      throw new BadRequestException('Échec de la validation GPS');
    });

    await expect(
      service.startTrip('booking-id', 'driver-user-id', Role.CHAUFFEUR, {
        driverLatitude: 9.60,
        driverLongitude: -13.68,
        passengerLatitude: 9.70,
        passengerLongitude: -13.70,
        otp: '123456',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject startTrip when neither OTP nor QR is valid', async () => {
    gpsService.verifyProximity.mockReturnValue({ distance: 20, maxDistance: 100 });
    otpService.verifyOtp.mockReturnValue(false);
    qrService.decodeBookingQrData.mockImplementation(() => ({ bookingId: 'other-booking-id' }));

    await expect(
      service.startTrip('booking-id', 'driver-user-id', Role.CHAUFFEUR, {
        driverLatitude: 9.60,
        driverLongitude: -13.68,
        passengerLatitude: 9.60,
        passengerLongitude: -13.68,
        otp: '000000',
        qrData: JSON.stringify({ bookingId: 'other-booking-id' }),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject startTrip for non chauffeur role', async () => {
    await expect(
      service.startTrip('booking-id', 'passenger-user-id', Role.PASSAGER, {
        driverLatitude: 9.60,
        driverLongitude: -13.68,
        passengerLatitude: 9.60,
        passengerLongitude: -13.68,
        otp: '123456',
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
