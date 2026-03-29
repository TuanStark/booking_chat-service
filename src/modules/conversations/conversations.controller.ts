import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  Req,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationQueryDto } from './dto/conversation-query.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import {
  readGatewayUserId,
  readGatewayUserIdOrThrow,
  readGatewayIsAdmin,
} from '../../common/utils/gateway-identity.util';

/**
 * REST endpoints for conversations.
 * Auth is handled via x-user-id and x-user-role headers set by API Gateway.
 */
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  /** Create or find existing support conversation */
  @Post()
  @HttpCode(201)
  async create(@Req() req: Request, @Body() dto: CreateConversationDto) {
    const userId = readGatewayUserIdOrThrow(req);
    return this.conversationsService.createOrFind(userId, dto);
  }

  /** Get current user's conversations */
  @Get()
  async getUserConversations(@Req() req: Request) {
    const userId = readGatewayUserIdOrThrow(req);
    return this.conversationsService.getUserConversations(userId);
  }

  // ─── Static paths must be registered before @Get(':id') ─────────────────

  /** List all conversations (admin) */
  @Get('admin/all')
  async getAllConversations(@Query() query: ConversationQueryDto) {
    return this.conversationsService.getAllConversations(query);
  }

  /** Get dashboard stats (admin) */
  @Get('admin/stats')
  async getStats() {
    return this.conversationsService.getStats();
  }

  /** Get total unread count for current user */
  @Get('unread/count')
  async getUnreadCount(@Req() req: Request) {
    const userId = readGatewayUserIdOrThrow(req);
    const count = await this.conversationsService.getTotalUnreadCount(userId);
    return { unreadCount: count };
  }

  /** Get a specific conversation */
  @Get(':id')
  async getConversation(@Req() req: Request, @Param('id') id: string) {
    const isAdmin = readGatewayIsAdmin(req);
    const userId = readGatewayUserId(req);
    if (!isAdmin && !userId) {
      throw new UnauthorizedException('Missing user identity (x-user-id)');
    }
    return this.conversationsService.getConversation(id, userId ?? '', isAdmin);
  }

  /** Update conversation status */
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateConversationDto) {
    if (!dto.status) throw new Error('Status is required');
    return this.conversationsService.updateStatus(id, dto.status);
  }

  /** Mark conversation as read */
  @Post(':id/read')
  @HttpCode(200)
  async markAsRead(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { messageId: string },
  ) {
    const userId = readGatewayUserIdOrThrow(req);
    await this.conversationsService.markAsRead(id, userId, body.messageId);
    return { success: true };
  }
}
