import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Décorateur @Roles()
 * Définit les rôles autorisés à accéder à une route
 *
 * Usage:
 * @Roles(Role.ADMIN, Role.AGENT_GARE)
 * @Get('dashboard')
 * getDashboard() { ... }
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
