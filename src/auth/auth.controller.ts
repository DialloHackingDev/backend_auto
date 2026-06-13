import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Inscription d\'un nouvel utilisateur' })
  @ApiResponse({ status: 201, description: 'Utilisateur créé avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 409, description: 'Le numéro de téléphone existe déjà' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Connexion' })
  @ApiResponse({ status: 200, description: 'Connexion réussie, retourne les tokens' })
  @ApiResponse({ status: 401, description: 'Identifiants invalides' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Rafraîchir le token d\'accès' })
  @ApiResponse({ status: 200, description: 'Nouveaux tokens générés' })
  @ApiResponse({ status: 401, description: 'Refresh token invalide ou expiré' })
  // Dans un vrai scénario, on vérifierait le refresh token via une stratégie séparée (JwtRefreshStrategy)
  // Pour faire simple ici, on passe l'ID de l'utilisateur (normalement extrait du token) 
  // Attention: Ceci est une implémentation simplifiée. En production, on utiliserait un Guard dédié.
  // Pour rester dans le MVP rapidement, on peut extraire le sub depuis le JWT côté service.
  // Je vais modifier la signature pour correspondre au MVP.
  refreshToken(@Body() dto: RefreshTokenDto) {
      // Note: Le décodage devrait se faire via un AuthGuard('jwt-refresh'). 
      // Pour l'instant, on laisse cette route mais on devra extraire le userId du token côté service.
      throw new Error("L'implémentation complète nécessite un JwtRefreshStrategy (à faire).");
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-Auth')
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({ summary: 'Déconnexion' })
  logout(@CurrentUser() user: any) {
    return this.authService.logout(user.id);
  }
}
