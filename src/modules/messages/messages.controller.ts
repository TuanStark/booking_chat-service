import { Controller, Post, Get, Patch, Delete, Param, Body, Query, Req, HttpCode, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageQueryDto } from './dto/message-query.dto';
import { ParticipantRole } from '@prisma/client';
import {
  readGatewayUserId,
  readGatewayUserIdOrThrow,
  readGatewayIsAdmin,
} from '../../common/utils/gateway-identity.util';

@Controller()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /** Send a message via HTTP (fallback for when WebSocket is unavailable) */
  @Post('conversations/:conversationId/messages')
  @HttpCode(201)
  async sendMessage(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @Body() body: { content: string; type?: any; replyToId?: string },
  ) {
    const userId = readGatewayUserIdOrThrow(req);
    const role = readGatewayIsAdmin(req) ? ParticipantRole.ADMIN : ParticipantRole.USER;
    const dto: SendMessageDto = { conversationId, ...body };
    return this.messagesService.sendMessage(userId, role, dto);
  }

  /** Get message history with cursor pagination */
  @Get('conversations/:conversationId/messages')
  async getMessages(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @Query() query: MessageQueryDto,
  ) {
    const isAdmin = readGatewayIsAdmin(req);
    const userId = readGatewayUserId(req);
    if (!isAdmin && !userId) {
      throw new UnauthorizedException('Missing user identity (x-user-id)');
    }
    return this.messagesService.getMessages(conversationId, userId ?? '', isAdmin, query.limit, query.cursor);
  }

  /** Edit a message */
  @Patch('messages/:id')
  async editMessage(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    const userId = readGatewayUserIdOrThrow(req);
    return this.messagesService.editMessage(id, userId, body.content);
  }

  /** Soft delete a message */
  @Delete('messages/:id')
  async deleteMessage(@Req() req: Request, @Param('id') id: string) {
    const userId = readGatewayUserIdOrThrow(req);
    const isAdmin = readGatewayIsAdmin(req);
    return this.messagesService.deleteMessage(id, userId, isAdmin);
  }
}
