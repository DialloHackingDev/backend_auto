import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as qrcode from 'qrcode';

@Injectable()
export class QrService {
  async generateBookingQrCode(bookingId: string): Promise<string> {
    try {
      // Pour plus de sécurité, on pourrait signer ce payload (JWT)
      // Pour le MVP, on encode juste un JSON contenant l'ID de la réservation
      const payload = JSON.stringify({ bookingId });
      
      // Génère une Data URI (Base64) de l'image QR
      const qrDataUri = await qrcode.toDataURL(payload, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        margin: 2,
        width: 300,
      });

      return qrDataUri;
    } catch (error) {
      throw new InternalServerErrorException('Erreur lors de la génération du QR Code');
    }
  }

  // Si on veut décoder côté serveur dans une future étape
  // En général, le décodage se fait via l'appareil photo du chauffeur
  // qui envoie ensuite le "bookingId" lu à l'API de validation.
}
