import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-Auth')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lister mes notifications' })
  @ApiQuery({
    name: 'unreadOnly',
    required: false,
    type: Boolean,
    description: 'Si true, retourne uniquement les notifications non lues',
  })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.findAllForUser(
      user.sub,
      unreadOnly === 'true',
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Nombre de notifications non lues (badge)' })
  countUnread(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.countUnread(user.sub);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marquer une notification comme lue' })
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.markAsRead(id, user.sub);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Marquer toutes les notifications comme lues' })
  markAllAsRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllAsRead(user.sub);
  }
}
