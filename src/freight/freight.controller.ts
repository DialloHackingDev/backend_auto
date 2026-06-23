import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { FreightService } from './freight.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateFreightDto } from './dto/create-freight.dto';

@ApiTags('Freight')
@Controller('freight')
@UseGuards(JwtAuthGuard)
export class FreightController {
  constructor(private readonly freightService: FreightService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une demande de fret' })
  create(@Body() body: CreateFreightDto) {
    return this.freightService.createFreight(body);
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les frets' })
  findAll() {
    return this.freightService.findAll();
  }

  @Post(':id/assign/:driverId')
  @ApiOperation({ summary: 'Assigner un fret à un chauffeur' })
  assignToDriver(@Param('id') id: string, @Param('driverId') driverId: string) {
    return this.freightService.assignToDriver(id, driverId);
  }
}
