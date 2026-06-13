import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByTelephone(telephone: string) {
    return this.prisma.user.findUnique({
      where: { telephone },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        passenger: true,
        driver: true,
      }
    });

    if (!user) {
        throw new NotFoundException('Utilisateur introuvable');
    }
    
    // On ne renvoie pas le mot de passe
    const { motDePasse, refreshToken, ...result } = user;
    return result;
  }

  async updateRefreshToken(id: string, refreshToken: string | null) {
      await this.prisma.user.update({
          where: { id },
          data: { refreshToken }
      })
  }
}
