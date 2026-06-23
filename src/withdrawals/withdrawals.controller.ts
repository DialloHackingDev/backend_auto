import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { WithdrawalWebhookDto } from './dto/withdrawal-webhook.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Withdrawals')
@Controller('withdrawals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CHAUFFEUR)
@ApiBearerAuth('JWT-Auth')
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les retraits du chauffeur connecté' })
  findAll(@CurrentUser() user: any) {
    return this.withdrawalsService.findAllForDriver(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Demander un retrait (Chauffeur uniquement)' })
  create(@CurrentUser() user: any, @Body() createWithdrawalDto: CreateWithdrawalDto) {
    return this.withdrawalsService.create(user.id, createWithdrawalDto);
  }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Webhook Mobile Money / callback opérateur de retrait' })
  handleWebhook(@Body() withdrawalWebhookDto: WithdrawalWebhookDto) {
    return this.withdrawalsService.handleWebhook(withdrawalWebhookDto);
  }
}
