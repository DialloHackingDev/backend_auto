import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class GpsService {
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

    const distance = R * c;
    return distance; // en mètres
  }

  /**
   * Vérifie si deux coordonnées sont à proximité l'une de l'autre
   * 
   * @param driverLat Latitude du chauffeur
   * @param driverLon Longitude du chauffeur
   * @param passengerLat Latitude du passager
   * @param passengerLon Longitude du passager
   * @param maxDistance Marge d'erreur en mètres (par défaut 100m)
   */
  verifyProximity(
    driverLat: number, 
    driverLon: number, 
    passengerLat: number, 
    passengerLon: number,
    maxDistance: number = 100
  ): boolean {
    const distance = this.calculateDistance(driverLat, driverLon, passengerLat, passengerLon);
    
    if (distance > maxDistance) {
      throw new BadRequestException(`Vous êtes trop loin de l'autre utilisateur (${Math.round(distance)} mètres). Vous devez être à moins de ${maxDistance} mètres pour valider le trajet.`);
    }

    return true;
  }
}
