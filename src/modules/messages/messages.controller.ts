import { Controller, Post, Get, Patch, Delete, Param, Body, Query, Req, HttpCode } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageQueryDto } from './dto/message-query.dto';
import { ParticipantRole } from '@prisma/client';

@Controller()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /** Send a message via HTTP (fallback for when WebSocket is unavailable) */
  @Post('conversations/:conversationId/messages')
  @HttpCode(201)
  async sendMessage(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Body() body: { content: string; type?: any; replyToId?: string },
  ) {
    const userId = req.headers['x-user-id'];
    const role = req.headers['x-user-role'] === 'admin' ? ParticipantRole.ADMIN : ParticipantRole.USER;
    const dto: SendMessageDto = { conversationId, ...body };
    return this.messagesService.sendMessage(userId, role, dto);
  }

  /** Get message history with cursor pagination */
  @Get('conversations/:conversationId/messages')
  async getMessages(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Query() query: MessageQueryDto,
  ) {
    const userId = req.headers['x-user-id'];
    const isAdmin = req.headers['x-user-role'] === 'admin';
    return this.messagesService.getMessages(conversationId, userId, isAdmin, query.limit, query.cursor);
  }

  /** Edit a message */
  @Patch('messages/:id')
  async editMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    const userId = req.headers['x-user-id'];
    return this.messagesService.editMessage(id, userId, body.content);
  }

  /** Soft delete a message */
  @Delete('messages/:id')
  async deleteMessage(@Req() req: any, @Param('id') id: string) {
    const userId = req.headers['x-user-id'];
    const isAdmin = req.headers['x-user-role'] === 'admin';
    return this.messagesService.deleteMessage(id, userId, isAdmin);
  }
}
