import { Controller, Get, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { StartBookingDto } from './dto/start-booking.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-Auth')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles(Role.PASSAGER)
  @ApiOperation({ summary: 'Créer une réservation (Passager uniquement)' })
  create(@CurrentUser() user: any, @Body() createBookingDto: CreateBookingDto) {
    return this.bookingsService.create(user.id, createBookingDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les réservations de l\'utilisateur connecté' })
  findAll(@CurrentUser() user: any) {
    return this.bookingsService.findAllForUser(user.id, user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir les détails d\'une réservation' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.bookingsService.findOne(id, user.id, user.role);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Mettre à jour le statut d\'une réservation' })
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() updateBookingStatusDto: UpdateBookingStatusDto
  ) {
    return this.bookingsService.updateStatus(id, user.id, user.role, updateBookingStatusDto);
  }

  @Post(':id/start')
  @Roles(Role.CHAUFFEUR)
  @ApiOperation({ summary: 'Démarrer un trajet (Validation GPS + OTP/QR)' })
  startTrip(
      @Param('id') id: string,
      @CurrentUser() user: any,
      @Body() startBookingDto: StartBookingDto
  ) {
      return this.bookingsService.startTrip(id, user.id, user.role, startBookingDto);
  }
}
