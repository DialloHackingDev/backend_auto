import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Payments')
@Controller('payments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-Auth')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Initier un paiement pour une réservation' })
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.create(createPaymentDto);
  }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Webhook Mobile Money / callback opérateur' })
  handleWebhook(@Body() paymentWebhookDto: PaymentWebhookDto) {
    return this.paymentsService.handleWebhook(paymentWebhookDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Vérifier le statut d\'un paiement' })
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }
}
