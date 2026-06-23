import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CHAUFFEUR)
@ApiBearerAuth('JWT-Auth')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Obtenir le solde de son portefeuille (Chauffeur)' })
  getBalance(@CurrentUser() user: JwtPayload) {
    return this.walletService.getBalance(user.sub);
  }

  @Get('history')
  @ApiOperation({ summary: 'Obtenir l\'historique des mouvements du portefeuille (Chauffeur)' })
  getHistory(@CurrentUser() user: JwtPayload) {
    return this.walletService.getHistory(user.sub);
  }

  @Post('release/:bookingId')
  @Roles(Role.CHAUFFEUR, Role.ADMIN)
  @ApiOperation({ summary: 'Libérer les fonds sous séquestre après un trajet' })
  releaseFromEscrow(@Param('bookingId') bookingId: string) {
    return this.walletService.releaseFromEscrow(bookingId);
  }
}
