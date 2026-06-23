import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Role } from '@prisma/client';

@ApiTags('Disputes')
@Controller('disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-Auth')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  @Roles(Role.PASSAGER, Role.CHAUFFEUR)
  @ApiOperation({ summary: 'Ouvrir un litige sur une réservation' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDisputeDto) {
    return this.disputesService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lister les litiges (mes litiges ou tous si ADMIN)',
  })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.disputesService.findAll(user.sub, user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un litige' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.disputesService.findOne(id, user.sub, user.role);
  }

  @Patch(':id/resolve')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Résoudre ou rejeter un litige (Admin uniquement)' })
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.disputesService.resolve(id, user.sub, dto);
  }
}
