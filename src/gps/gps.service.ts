import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GpsService {
  constructor(private readonly configService: ConfigService) {}

  private validateCoordinate(value: number, min: number, max: number, label: string) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new BadRequestException(`${label} doit être un nombre valide`);
    }

    if (value < min || value > max) {
      throw new BadRequestException(`${label} hors limites (${value}). Attendu entre ${min} et ${max}.`);
    }
  }

  private getMaxDistance(maxDistance?: number): number {
    if (maxDistance && maxDistance > 0) {
      return maxDistance;
    }
    return this.configService.get<number>('GPS_MAX_START_DISTANCE_METERS', 100);
  }

  /**
   * Calcule la distance en mètres entre deux points GPS en utilisant la formule de Haversine.
   *
   * @param lat1 Latitude du point 1
   * @param lon1 Longitude du point 1
   * @param lat2 Latitude du point 2
   * @param lon2 Longitude du point 2
   * @returns La distance en mètres
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Rayon de la Terre en mètres
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
              Math.cos(p1) * Math.cos(p2) *
              Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Vérifie si deux coordonnées sont à proximité l'une de l'autre.
   *
   * @param driverLat Latitude du chauffeur
   * @param driverLon Longitude du chauffeur
   * @param passengerLat Latitude du passager
   * @param passengerLon Longitude du passager
   * @param maxDistance Marge d'erreur en mètres (configurable)
   */
  verifyProximity(
    driverLat: number,
    driverLon: number,
    passengerLat: number,
    passengerLon: number,
    maxDistance?: number,
  ): { distance: number; maxDistance: number } {
    this.validateCoordinate(driverLat, -90, 90, 'Latitude chauffeur');
    this.validateCoordinate(passengerLat, -90, 90, 'Latitude passager');
    this.validateCoordinate(driverLon, -180, 180, 'Longitude chauffeur');
    this.validateCoordinate(passengerLon, -180, 180, 'Longitude passager');

    const distance = this.calculateDistance(
      driverLat,
      driverLon,
      passengerLat,
      passengerLon,
    );

    const allowedDistance = this.getMaxDistance(maxDistance);

    if (distance > allowedDistance) {
      throw new BadRequestException(
        `Échec de la validation GPS : ${Math.round(distance)} mètres séparant le chauffeur et le passager. Distance autorisée : ${allowedDistance} mètres.`,
      );
    }

    return { distance, maxDistance: allowedDistance };
  }
}
