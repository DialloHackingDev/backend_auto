import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FreightService {
  constructor(private readonly prisma: PrismaService) {}

  async createFreight(data: {
    poids: number;
    type?: string;
    destination: string;
    description?: string;
  }) {
    if (data.poids <= 0) {
      throw new BadRequestException('Le poids doit être supérieur à 0');
    }

    const tarifUnitaire = 5000; // Exemple MVP en GNF par kg
    const tarif = data.poids * tarifUnitaire;

    return this.prisma.freight.create({
      data: {
        poids: data.poids,
        type: data.type || 'Divers',
        destination: data.destination,
        tarif,
        description: data.description,
      },
    });
  }

  async findAll() {
    return this.prisma.freight.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignToDriver(freightId: string, driverId: string) {
    const freight = await this.prisma.freight.findUnique({
      where: { id: freightId },
    });

    if (!freight) {
      throw new NotFoundException('Fret introuvable');
    }

    if (freight.statut !== 'EN_ATTENTE') {
      throw new BadRequestException('Le fret ne peut pas être réassigné dans cet état');
    }

    return this.prisma.freight.update({
      where: { id: freightId },
      data: {
        driverId,
        statut: 'EN_TRANSIT',
      },
    });
  }
}
