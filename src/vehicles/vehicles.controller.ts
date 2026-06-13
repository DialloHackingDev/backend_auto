import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Vehicles')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CHAUFFEUR)
  @ApiBearerAuth('JWT-Auth')
  @ApiOperation({ summary: 'Ajouter un véhicule (Chauffeur uniquement)' })
  create(@CurrentUser() user: any, @Body() createVehicleDto: CreateVehicleDto) {
    return this.vehiclesService.create(user.id, createVehicleDto);
  }

  @Public()
  @Get('nearby')
  @ApiOperation({ summary: 'Rechercher des véhicules disponibles à proximité' })
  @ApiQuery({ name: 'latitude', required: false, type: Number })
  @ApiQuery({ name: 'longitude', required: false, type: Number })
  findNearby(
      @Query('latitude') latitude?: number,
      @Query('longitude') longitude?: number
  ) {
      return this.vehiclesService.findNearby(latitude, longitude);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lister tous les véhicules' })
  findAll() {
    return this.vehiclesService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Obtenir les détails d\'un véhicule' })
  findOne(@Param('id') id: string) {
    return this.vehiclesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CHAUFFEUR)
  @ApiBearerAuth('JWT-Auth')
  @ApiOperation({ summary: 'Mettre à jour un véhicule (Propriétaire uniquement)' })
  update(
      @CurrentUser() user: any,
      @Param('id') id: string, 
      @Body() updateVehicleDto: UpdateVehicleDto
  ) {
    return this.vehiclesService.update(user.id, id, updateVehicleDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CHAUFFEUR)
  @ApiBearerAuth('JWT-Auth')
  @ApiOperation({ summary: 'Désactiver un véhicule (Propriétaire uniquement)' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.vehiclesService.remove(user.id, id);
  }
}
