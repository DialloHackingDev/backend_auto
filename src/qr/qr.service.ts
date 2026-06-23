import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
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

  decodeBookingQrData(qrData: string): { bookingId: string } {
    if (!qrData || typeof qrData !== 'string') {
      throw new BadRequestException('Données QR Code invalides');
    }

    const trimmed = qrData.trim();

    // Accepte soit un JSON stringifié, soit un identifiant brut.
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string') {
        return { bookingId: parsed };
      }
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof (parsed as any).bookingId === 'string'
      ) {
        return { bookingId: (parsed as any).bookingId };
      }
    } catch {
      // Continue et tente d'utiliser le texte brut
    }

    if (/^[0-9a-fA-F-]{36}$/.test(trimmed)) {
      return { bookingId: trimmed };
    }

    throw new BadRequestException('Données QR Code mal formées');
  }
}
