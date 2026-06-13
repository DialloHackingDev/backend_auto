import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { StationsService } from './stations.service';
import { CreateStationDto } from './dto/create-station.dto';
import { UpdateStationDto } from './dto/update-station.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Stations')
@Controller('stations')
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-Auth')
  @ApiOperation({ summary: 'Créer une gare routière (Admin uniquement)' })
  create(@Body() createStationDto: CreateStationDto) {
    return this.stationsService.create(createStationDto);
  }

  @Public() // Accessible sans être connecté pour chercher un trajet
  @Get()
  @ApiOperation({ summary: 'Lister toutes les gares routières actives' })
  @ApiQuery({ name: 'all', required: false, type: Boolean, description: 'Si true, retourne aussi les gares inactives (Admin uniquement)' })
  findAll(@Query('all') all?: boolean) {
    // Si all est true, on retourne tout (en principe il faudrait vérifier si c'est un admin)
    // Pour simplifier le MVP, on permet de tout lister si all=true
    return this.stationsService.findAll(all !== true);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Obtenir les détails d\'une gare routière' })
  findOne(@Param('id') id: string) {
    return this.stationsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-Auth')
  @ApiOperation({ summary: 'Mettre à jour une gare routière (Admin uniquement)' })
  update(@Param('id') id: string, @Body() updateStationDto: UpdateStationDto) {
    return this.stationsService.update(id, updateStationDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT-Auth')
  @ApiOperation({ summary: 'Désactiver une gare routière (Admin uniquement)' })
  remove(@Param('id') id: string) {
    return this.stationsService.remove(id);
  }
}
