import { Controller, Get, Patch, Body, Param, UseGuards, Query } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Drivers')
@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Public() // Ou peut-être protégé selon les besoins
  @Get()
  @ApiOperation({ summary: 'Lister les chauffeurs' })
  @ApiQuery({ name: 'available', required: false, type: Boolean, description: 'Filtrer uniquement les disponibles et vérifiés' })
  findAll(@Query('available') available?: boolean) {
    return this.driversService.findAll(available === true);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Obtenir les détails d\'un chauffeur par ID Chauffeur' })
  findOne(@Param('id') id: string) {
    return this.driversService.findOne(id);
  }

  @Patch('availability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CHAUFFEUR)
  @ApiBearerAuth('JWT-Auth')
  @ApiOperation({ summary: 'Mettre à jour sa disponibilité (Chauffeur uniquement)' })
  updateAvailability(
    @CurrentUser() user: any,
    @Body() updateAvailabilityDto: UpdateAvailabilityDto
  ) {
    return this.driversService.updateAvailability(user.id, updateAvailabilityDto);
  }
}
