import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConversationsRepository } from './conversations.repository';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationQueryDto } from './dto/conversation-query.dto';
import { ConversationStatus, ParticipantRole } from '@prisma/client';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(private readonly conversationsRepo: ConversationsRepository) {}

  /**
   * Create or find existing support conversation for a user.
   * If user already has an active conversation with same context, return it (idempotent).
   */
  async createOrFind(userId: string, dto: CreateConversationDto) {
    // Check for existing active conversation with same context
    const existing = await this.conversationsRepo.findExistingSupport(
      userId,
      dto.contextType,
      dto.contextId,
    );
    if (existing) {
      this.logger.log(`Reusing existing conversation ${existing.id} for user ${userId}`);
      return existing;
    }

    const conversation = await this.conversationsRepo.create({
      userId,
      title: dto.title || 'Hỗ trợ khách hàng',
      type: dto.type,
      contextType: dto.contextType,
      contextId: dto.contextId,
    });

    this.logger.log(`Created conversation ${conversation.id} for user ${userId}`);
    return conversation;
  }

  /** Get conversations for a user (User side) */
  async getUserConversations(userId: string, status?: ConversationStatus) {
    return this.conversationsRepo.findByUserId(userId, status);
  }

  /** Get ALL conversations with filters (Admin side) */
  async getAllConversations(query: ConversationQueryDto) {
    return this.conversationsRepo.findAll(query);
  }

  /** Get a single conversation with authorization check */
  async getConversation(conversationId: string, userId: string, isAdmin: boolean) {
    const conversation = await this.conversationsRepo.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');

    // Admin can see all, user can only see own
    if (!isAdmin) {
      const isParticipant = await this.conversationsRepo.isParticipant(conversationId, userId);
      if (!isParticipant) throw new ForbiddenException('Not a participant of this conversation');
    }

    return conversation;
  }

  /** Update conversation status (Admin only) */
  async updateStatus(conversationId: string, status: ConversationStatus) {
    const conversation = await this.conversationsRepo.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');

    return this.conversationsRepo.updateStatus(conversationId, status);
  }

  /** Add admin to conversation as participant */
  async joinAsAdmin(conversationId: string, adminId: string) {
    return this.conversationsRepo.addParticipant(conversationId, adminId, ParticipantRole.ADMIN);
  }

  /** Check if user is participant */
  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    return this.conversationsRepo.isParticipant(conversationId, userId);
  }

  /** Mark conversation as read for a user */
  async markAsRead(conversationId: string, userId: string, lastMessageId: string) {
    await this.conversationsRepo.markAsRead(conversationId, userId, lastMessageId);
  }

  /** Get total unread count for a user */
  async getTotalUnreadCount(userId: string): Promise<number> {
    return this.conversationsRepo.getTotalUnreadCount(userId);
  }

  /** Get conversation stats for admin dashboard */
  async getStats() {
    const [active, closed, archived] = await Promise.all([
      this.conversationsRepo.findAll({ status: ConversationStatus.ACTIVE, limit: 0 }),
      this.conversationsRepo.findAll({ status: ConversationStatus.CLOSED, limit: 0 }),
      this.conversationsRepo.findAll({ status: ConversationStatus.ARCHIVED, limit: 0 }),
    ]);
    return {
      active: active.total,
      closed: closed.total,
      archived: archived.total,
      total: active.total + closed.total + archived.total,
    };
  }
}
