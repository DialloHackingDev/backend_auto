import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createVehicleDto: CreateVehicleDto) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new ForbiddenException('Seul un chauffeur peut ajouter un véhicule');
    }

    const existingVehicle = await this.prisma.vehicle.findUnique({
        where: { immatriculation: createVehicleDto.immatriculation }
    });

    if (existingVehicle) {
        throw new ConflictException('Un véhicule avec cette immatriculation existe déjà');
    }

    return this.prisma.vehicle.create({
      data: {
        ...createVehicleDto,
        driverId: driver.id,
        placesDisponibles: createVehicleDto.capacite, // Au départ, toutes les places sont disponibles
      },
    });
  }

  async findAll() {
    return this.prisma.vehicle.findMany({
      include: {
        driver: {
          select: {
            user: { select: { nom: true, telephone: true } },
            note: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        driver: {
          select: {
            id: true,
            user: { select: { nom: true, telephone: true } },
            note: true,
          },
        },
      },
    });

    if (!vehicle) {
      throw new NotFoundException(`Véhicule avec l'ID ${id} introuvable`);
    }

    return vehicle;
  }

  // Recherche des véhicules à proximité (simplifié pour le MVP - retourne les chauffeurs disponibles)
  async findNearby(latitude?: number, longitude?: number) {
    // Dans un vrai système, on utiliserait PostGIS ou une formule Haversine
    // Pour le MVP, on retourne les véhicules des chauffeurs qui sont 'isAvailable'
    
    return this.prisma.vehicle.findMany({
        where: {
            statut: 'ACTIF',
            placesDisponibles: { gt: 0 },
            driver: {
                isAvailable: true,
                isVerified: true
            }
        },
        include: {
            driver: {
                select: {
                    latitude: true,
                    longitude: true,
                    note: true,
                    user: { select: { nom: true, telephone: true }}
                }
            }
        }
    });
  }

  async update(userId: string, id: string, updateVehicleDto: UpdateVehicleDto) {
    const vehicle = await this.findOne(id);
    const driver = await this.prisma.driver.findUnique({ where: { userId }});

    if (!driver || vehicle.driverId !== driver.id) {
        throw new ForbiddenException('Vous n\'êtes pas autorisé à modifier ce véhicule');
    }

    return this.prisma.vehicle.update({
      where: { id },
      data: updateVehicleDto,
    });
  }

  async remove(userId: string, id: string) {
    const vehicle = await this.findOne(id);
    const driver = await this.prisma.driver.findUnique({ where: { userId }});

    if (!driver || vehicle.driverId !== driver.id) {
        throw new ForbiddenException('Vous n\'êtes pas autorisé à supprimer ce véhicule');
    }

    return this.prisma.vehicle.update({
      where: { id },
      data: { statut: 'INACTIF' }, // Soft delete / Désactivation
    });
  }
}
