import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GpsService } from './gps.service';
import { LogGpsDto } from './dto/log-gps.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('GPS')
@Controller('gps')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-Auth')
export class GpsController {
  constructor(private readonly gpsService: GpsService) {}

  @Post('log')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.CHAUFFEUR)
  @ApiOperation({ summary: 'Enregistrer la position GPS actuelle (Chauffeur uniquement)' })
  logPosition(@CurrentUser() user: JwtPayload, @Body() logGpsDto: LogGpsDto) {
    // Dans une implémentation complète (Sprint 3 avec WebSockets), cette position
    // serait envoyée en temps réel au passager via Socket.io.
    // Pour le MVP, on pourrait stocker cette position en base ou dans Redis.
    return {
      success: true,
      message: 'Position GPS enregistrée avec succès',
      data: {
        userId: user.sub,
        ...logGpsDto,
        timestamp: new Date().toISOString(),
      }
    };
  }
}
