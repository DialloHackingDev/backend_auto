import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Injectable()
export class DriversService {
  constructor(private prisma: PrismaService) {}

  async findAll(availableOnly: boolean = false) {
    const where = availableOnly ? { isAvailable: true, isVerified: true } : {};
    return this.prisma.driver.findMany({
      where,
      include: {
        user: {
          select: { nom: true, telephone: true },
        },
        vehicles: true,
      },
    });
  }

  async findOne(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        user: {
          select: { nom: true, telephone: true, isActive: true },
        },
        vehicles: true,
      },
    });

    if (!driver) {
      throw new NotFoundException(`Chauffeur avec l'ID ${id} introuvable`);
    }

    return driver;
  }

  async findByUserId(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException(`Aucun profil chauffeur associé à cet utilisateur`);
    }

    return driver;
  }

  async updateAvailability(userId: string, dto: UpdateAvailabilityDto) {
    const driver = await this.findByUserId(userId);

    // Un chauffeur ne peut se mettre disponible que s'il est vérifié
    if (dto.isAvailable && !driver.isVerified) {
        throw new ForbiddenException('Votre profil doit être vérifié par un administrateur avant de vous mettre disponible.');
    }

    return this.prisma.driver.update({
      where: { id: driver.id },
      data: { isAvailable: dto.isAvailable },
    });
  }
}
