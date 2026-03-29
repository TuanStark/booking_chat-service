import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { MessagesRepository } from './messages.repository';
import { ConversationsRepository } from '../conversations/conversations.repository';
import { SendMessageDto } from './dto/send-message.dto';
import { ParticipantRole, MessageType } from '@prisma/client';
import { sanitizeMessageContent, truncatePreview } from '../../shared/utils/sanitize.util';
import { buildCursorPaginationResult } from '../../shared/utils/pagination.util';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly messagesRepo: MessagesRepository,
    private readonly conversationsRepo: ConversationsRepository,
  ) {}

  /**
   * Send a message in a conversation.
   * - Sanitizes content (XSS prevention)
   * - Validates participant authorization
   * - Updates conversation denormalized fields
   * - Increments unread count for other participants
   */
  async sendMessage(senderId: string, senderRole: ParticipantRole, dto: SendMessageDto) {
    // 1. Sanitize content
    const sanitized = sanitizeMessageContent(dto.content);
    if (!sanitized) {
      throw new BadRequestException('Message content cannot be empty');
    }

    // 2. Verify sender is participant (or auto-join admin)
    const isParticipant = await this.conversationsRepo.isParticipant(dto.conversationId, senderId);
    if (!isParticipant) {
      if (senderRole === ParticipantRole.ADMIN) {
        // Auto-join admin when they first reply
        await this.conversationsRepo.addParticipant(dto.conversationId, senderId, ParticipantRole.ADMIN);
        this.logger.log(`Admin ${senderId} auto-joined conversation ${dto.conversationId}`);
      } else {
        throw new ForbiddenException('Not a participant of this conversation');
      }
    }

    // 3. Create message
    const message = await this.messagesRepo.create({
      conversationId: dto.conversationId,
      senderId,
      senderRole,
      content: sanitized,
      type: dto.type || MessageType.TEXT,
      replyToId: dto.replyToId,
    });

    // 4. Update conversation denormalized fields
    await this.conversationsRepo.updateLastMessage(
      dto.conversationId,
      message.id,
      truncatePreview(sanitized),
    );

    // 5. Increment unread count for other participants
    await this.conversationsRepo.incrementUnreadForOthers(dto.conversationId, senderId);

    this.logger.log(`Message ${message.id} sent in conversation ${dto.conversationId} by ${senderRole}:${senderId}`);
    return message;
  }

  /** Load message history with cursor-based pagination */
  async getMessages(conversationId: string, userId: string, isAdmin: boolean, limit = 30, cursor?: string) {
    // Authorization check
    if (!isAdmin) {
      const isParticipant = await this.conversationsRepo.isParticipant(conversationId, userId);
      if (!isParticipant) throw new ForbiddenException('Not a participant');
    }

    const messages = await this.messagesRepo.findByConversation(conversationId, limit, cursor);
    return buildCursorPaginationResult(messages, limit);
  }

  /** Edit a message (only sender can edit) */
  async editMessage(messageId: string, userId: string, newContent: string) {
    const message = await this.messagesRepo.findById(messageId);
    if (!message) throw new BadRequestException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('Can only edit own messages');

    const sanitized = sanitizeMessageContent(newContent);
    if (!sanitized) throw new BadRequestException('Content cannot be empty');

    return this.messagesRepo.update(messageId, sanitized);
  }

  /** Soft delete a message (sender or admin) */
  async deleteMessage(messageId: string, userId: string, isAdmin: boolean) {
    const message = await this.messagesRepo.findById(messageId);
    if (!message) throw new BadRequestException('Message not found');
    if (!isAdmin && message.senderId !== userId) {
      throw new ForbiddenException('Can only delete own messages');
    }

    return this.messagesRepo.softDelete(messageId);
  }
}
