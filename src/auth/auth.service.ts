import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const userExists = await this.usersService.findByTelephone(dto.telephone);
    if (userExists) {
      throw new ConflictException('Un utilisateur avec ce numéro existe déjà');
    }

    if (dto.role === Role.CHAUFFEUR && !dto.numeroPermis) {
        throw new BadRequestException('Le numéro de permis est obligatoire pour un chauffeur');
    }

    const hashedPassword = await bcrypt.hash(dto.motDePasse, 12);

    const user = await this.prisma.$transaction(async (prisma) => {
        const newUser = await prisma.user.create({
            data: {
                nom: dto.nom,
                telephone: dto.telephone,
                motDePasse: hashedPassword,
                role: dto.role,
            }
        });

        if (dto.role === Role.PASSAGER) {
            await prisma.passenger.create({
                data: { userId: newUser.id }
            });
        } else if (dto.role === Role.CHAUFFEUR) {
            const driver = await prisma.driver.create({
                data: { 
                    userId: newUser.id,
                    numeroPermis: dto.numeroPermis as string
                }
            });
            // Créer le wallet du chauffeur
            await prisma.wallet.create({
                data: { driverId: driver.id }
            });
        }
        
        return newUser;
    });

    return this.generateTokens(user.id, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByTelephone(dto.telephone);
    
    if (!user || !user.isActive || user.isSuspended) {
      throw new UnauthorizedException('Identifiants invalides ou compte inactif');
    }

    const isPasswordValid = await bcrypt.compare(dto.motDePasse, user.motDePasse);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    return this.generateTokens(user.id, user.role);
  }

  async refreshToken(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Accès refusé');
    }

    const isRefreshValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isRefreshValid) {
        throw new UnauthorizedException('Accès refusé');
    }

    return this.generateTokens(user.id, user.role);
  }

  async logout(userId: string) {
      await this.usersService.updateRefreshToken(userId, null);
      return { message: 'Déconnexion réussie' };
  }

  private async generateTokens(userId: string, role: string) {
    const payload = { sub: userId, role };
    
    // ConfigService.get retourne une valeur (string | undefined)
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const jwtRefreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');

    if (!jwtSecret || !jwtRefreshSecret) {
        throw new Error('JWT secrets are not defined in environment variables');
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtSecret,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: jwtRefreshSecret,
        expiresIn: '7d',
      }),
    ]);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshToken(userId, hashedRefreshToken);

    return {
      accessToken,
      refreshToken,
    };
  }
}
