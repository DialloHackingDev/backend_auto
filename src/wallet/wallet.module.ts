import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { EscrowModule } from '../escrow/escrow.module';

@Module({
  imports: [EscrowModule],
  controllers: [WalletController],
  providers: [WalletService],
})
export class WalletModule {}
