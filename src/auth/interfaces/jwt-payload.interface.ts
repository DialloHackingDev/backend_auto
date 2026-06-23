import { Role } from '@prisma/client';

/**
 * Payload décodé du JWT — Injecté par @CurrentUser() dans tous les controllers
 * Typer explicitement évite les `any` et rend le code maintenable
 */
export class JwtPayload {
  /** ID de l'utilisateur (UUID) */
  sub: string;
  /** Rôle de l'utilisateur */
  role: Role;
  /** Date d'émission du token (Unix timestamp) */
  iat?: number;
  /** Date d'expiration du token (Unix timestamp) */
  exp?: number;
}
