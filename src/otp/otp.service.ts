import { Injectable } from '@nestjs/common';

@Injectable()
export class OtpService {
  /**
   * Génère un code OTP aléatoire à 6 chiffres
   */
  generateOtp(): string {
    const min = 100000;
    const max = 999999;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  /**
   * Calcule la date d'expiration de l'OTP (par défaut 24h pour un trajet long)
   */
  getExpirationDate(hours: number = 24): Date {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + hours);
    return expiresAt;
  }

  /**
   * Vérifie si un OTP est valide et n'a pas expiré
   */
  verifyOtp(inputOtp: string, storedOtp: string | null, expiresAt: Date | null): boolean {
    if (!storedOtp || !expiresAt) {
      return false;
    }

    if (new Date() > expiresAt) {
      return false; // Expiré
    }

    return inputOtp === storedOtp;
  }
}
