import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { StartBookingDto } from './dto/start-booking.dto';
import { BookingStatut } from '@prisma/client';
import { GpsService } from '../gps/gps.service';
import { OtpService } from '../otp/otp.service';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private gpsService: GpsService,
    private otpService: OtpService
  ) {}

  async create(userId: string, createBookingDto: CreateBookingDto) {
    const passenger = await this.prisma.passenger.findUnique({
      where: { userId },
    });

    if (!passenger) {
      throw new ForbiddenException('Seul un passager peut effectuer une réservation');
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: createBookingDto.vehicleId },
      include: { driver: true },
    });

    if (!vehicle) {
      throw new NotFoundException('Véhicule introuvable');
    }

    if (vehicle.statut !== 'ACTIF' || !vehicle.driver.isAvailable) {
        throw new BadRequestException('Ce véhicule ou son chauffeur n\'est pas disponible');
    }

    if (vehicle.placesDisponibles < createBookingDto.places) {
      throw new BadRequestException(`Pas assez de places disponibles. Restant: ${vehicle.placesDisponibles}`);
    }

    // Calcul du prix (MVP: Prix fixe ou basé sur une logique simplifiée)
    // Idéalement, cela viendrait d'une table de tarifs
    const prixUnitaire = 100000; // 100 000 GNF par place
    const prixTotal = prixUnitaire * createBookingDto.places;

    // Utilisation d'une transaction pour créer la réservation et mettre à jour les places
    return this.prisma.$transaction(async (prisma) => {
        const booking = await prisma.booking.create({
            data: {
              passengerId: passenger.id,
              driverId: vehicle.driver.id,
              vehicleId: vehicle.id,
              departure: createBookingDto.departure,
              destination: createBookingDto.destination,
              places: createBookingDto.places,
              prix: prixTotal,
              statut: BookingStatut.PENDING,
            },
        });

        await prisma.vehicle.update({
            where: { id: vehicle.id },
            data: {
                placesDisponibles: {
                    decrement: createBookingDto.places
                }
            }
        });

        // Ici, on pourrait déclencher un événement Socket.io pour informer le chauffeur
        return booking;
    });
  }

  async findAllForUser(userId: string, role: string) {
    if (role === 'PASSAGER') {
        const passenger = await this.prisma.passenger.findUnique({ where: { userId }});
        if (!passenger) return [];
        return this.prisma.booking.findMany({ where: { passengerId: passenger.id }, include: { vehicle: true, driver: { include: { user: { select: { nom: true, telephone: true } } } } } });
    } else if (role === 'CHAUFFEUR') {
        const driver = await this.prisma.driver.findUnique({ where: { userId }});
        if (!driver) return [];
        return this.prisma.booking.findMany({ where: { driverId: driver.id }, include: { vehicle: true, passenger: { include: { user: { select: { nom: true, telephone: true } } } } } });
    }
    
    // Si ADMIN
    return this.prisma.booking.findMany({ include: { vehicle: true } });
  }

  async findOne(id: string, userId: string, role: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
          vehicle: true,
          passenger: { include: { user: { select: { nom: true, telephone: true, id: true } } } },
          driver: { include: { user: { select: { nom: true, telephone: true, id: true } } } },
          payment: true
      }
    });

    if (!booking) {
      throw new NotFoundException(`Réservation avec l'ID ${id} introuvable`);
    }

    // Vérification des droits d'accès
    if (role !== 'ADMIN' && booking.passenger.user.id !== userId && booking.driver.user.id !== userId) {
        throw new ForbiddenException('Vous n\'avez pas accès à cette réservation');
    }

    return booking;
  }

  async updateStatus(id: string, userId: string, role: string, dto: UpdateBookingStatusDto) {
    const booking = await this.findOne(id, userId, role);

    // TODO: Implémenter la logique complète de la machine à états
    // Pour l'instant, MVP : on permet d'annuler
    if (dto.statut === BookingStatut.CANCELLED) {
        if (booking.statut === BookingStatut.COMPLETED || booking.statut === BookingStatut.IN_PROGRESS) {
            throw new BadRequestException('Impossible d\'annuler un trajet en cours ou terminé');
        }

        return this.prisma.$transaction(async (prisma) => {
            const updatedBooking = await prisma.booking.update({
                where: { id },
                data: { statut: BookingStatut.CANCELLED, cancelledAt: new Date() }
            });

            // Restituer les places au véhicule
            await prisma.vehicle.update({
                where: { id: booking.vehicleId },
                data: { placesDisponibles: { increment: booking.places } }
            });

            // Gérer le remboursement si déjà payé... (à faire avec PaymentsModule)

            return updatedBooking;
        });
    }

    // Si c'est le chauffeur qui confirme la réservation
    if (dto.statut === BookingStatut.CONFIRMED && role === 'CHAUFFEUR') {
        return this.prisma.booking.update({
            where: { id },
            data: { statut: BookingStatut.CONFIRMED }
        });
    }

    // Par défaut, mise à jour (restreindre en fonction des rôles dans une version plus complète)
    return this.prisma.booking.update({
        where: { id },
        data: { statut: dto.statut }
    });
  }

  async startTrip(id: string, userId: string, role: string, dto: StartBookingDto) {
    if (role !== 'CHAUFFEUR') {
        throw new ForbiddenException('Seul le chauffeur peut démarrer le trajet');
    }

    const booking = await this.findOne(id, userId, role);

    if (booking.statut !== BookingStatut.PAID) {
        throw new BadRequestException('La réservation doit être payée avant de démarrer le trajet');
    }

    // 1. Validation GPS
    this.gpsService.verifyProximity(
        dto.driverLatitude,
        dto.driverLongitude,
        dto.passengerLatitude,
        dto.passengerLongitude
    );

    // 2. Validation OTP ou QR Code
    let isValidated = false;

    if (dto.otp) {
        isValidated = this.otpService.verifyOtp(dto.otp, booking.otpCode, booking.otpExpiresAt);
        if (!isValidated) {
            throw new BadRequestException('Code OTP invalide ou expiré');
        }
    } else if (dto.qrData) {
        try {
            const parsedData = JSON.parse(dto.qrData);
            if (parsedData.bookingId === booking.id) {
                isValidated = true;
            } else {
                throw new BadRequestException('QR Code invalide pour cette réservation');
            }
        } catch (e) {
            throw new BadRequestException('Données QR Code mal formées');
        }
    } else {
        throw new BadRequestException('Vous devez fournir un OTP ou un QR Code scanné pour valider le trajet');
    }

    // 3. Mise à jour de la réservation
    return this.prisma.booking.update({
        where: { id },
        data: {
            statut: BookingStatut.IN_PROGRESS,
            startedAt: new Date(),
            gpsValidated: true,
            otpVerified: !!dto.otp,
            qrCodeScanned: !!dto.qrData,
            otpCode: null, // Invalider l'OTP
            otpExpiresAt: null
        }
    });
  }
}
