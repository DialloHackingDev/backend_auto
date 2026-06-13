import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStationDto } from './dto/create-station.dto';
import { UpdateStationDto } from './dto/update-station.dto';

@Injectable()
export class StationsService {
  constructor(private prisma: PrismaService) {}

  async create(createStationDto: CreateStationDto) {
    return this.prisma.station.create({
      data: createStationDto,
    });
  }

  async findAll(onlyActive: boolean = true) {
    const where = onlyActive ? { isActive: true } : {};
    return this.prisma.station.findMany({ where });
  }

  async findOne(id: string) {
    const station = await this.prisma.station.findUnique({
      where: { id },
    });

    if (!station) {
      throw new NotFoundException(`Gare avec l'ID ${id} introuvable`);
    }

    return station;
  }

  async update(id: string, updateStationDto: UpdateStationDto) {
    // Vérifie si la gare existe
    await this.findOne(id);

    return this.prisma.station.update({
      where: { id },
      data: updateStationDto,
    });
  }

  async remove(id: string) {
    // Vérifie si la gare existe
    await this.findOne(id);

    // Au lieu de la supprimer physiquement, on la désactive (soft delete)
    return this.prisma.station.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
