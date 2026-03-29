import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationStatus, ConversationType, ParticipantRole, Prisma } from '@prisma/client';

@Injectable()
export class ConversationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId: string;
    title?: string;
    type?: ConversationType;
    contextType?: string;
    contextId?: string;
  }) {
    return this.prisma.conversation.create({
      data: {
        userId: data.userId,
        title: data.title,
        type: data.type || ConversationType.SUPPORT,
        contextType: data.contextType,
        contextId: data.contextId,
        participants: {
          create: {
            userId: data.userId,
            role: ParticipantRole.USER,
          },
        },
      },
      include: { participants: true },
    });
  }

  async findById(id: string) {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: { participants: true },
    });
  }

  /** Find existing SUPPORT conversation between user and context */
  async findExistingSupport(userId: string, contextType?: string, contextId?: string) {
    const where: Prisma.ConversationWhereInput = {
      userId,
      type: ConversationType.SUPPORT,
      status: { not: ConversationStatus.CLOSED },
    };
    if (contextType && contextId) {
      where.contextType = contextType;
      where.contextId = contextId;
    }
    return this.prisma.conversation.findFirst({ where, include: { participants: true } });
  }

  /** List conversations for a specific user (User side) */
  async findByUserId(userId: string, status?: ConversationStatus) {
    const where: Prisma.ConversationWhereInput = {
      participants: { some: { userId } },
    };
    if (status) where.status = status;

    return this.prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
      include: {
        participants: true,
      },
    });
  }

  /** List ALL conversations (Admin side) with optional search/filter */
  async findAll(options: {
    status?: ConversationStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, search, page = 1, limit = 20 } = options;
    const where: Prisma.ConversationWhereInput = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { lastMessageText: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        skip: (page - 1) * limit,
        take: limit,
        include: { participants: true },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async updateStatus(id: string, status: ConversationStatus) {
    return this.prisma.conversation.update({
      where: { id },
      data: { status },
    });
  }

  /** Update last message denormalized fields atomically */
  async updateLastMessage(conversationId: string, messageId: string, text: string) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageId: messageId,
        lastMessageAt: new Date(),
        lastMessageText: text.substring(0, 200),
      },
    });
  }

  /** Add admin participant to conversation */
  async addParticipant(conversationId: string, userId: string, role: ParticipantRole) {
    return this.prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      create: { conversationId, userId, role },
      update: {},
    });
  }

  /** Check if user is participant of conversation */
  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const p = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    return !!p;
  }

  /** Increment unread count for all participants except sender */
  async incrementUnreadForOthers(conversationId: string, senderId: string) {
    return this.prisma.conversationParticipant.updateMany({
      where: { conversationId, userId: { not: senderId } },
      data: { unreadCount: { increment: 1 } },
    });
  }

  /** Reset unread count for a user in a conversation */
  async markAsRead(conversationId: string, userId: string, lastMessageId: string) {
    return this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { unreadCount: 0, lastReadMessageId: lastMessageId, lastReadAt: new Date() },
    });
  }

  /** Get total unread count across all conversations for a user */
  async getTotalUnreadCount(userId: string): Promise<number> {
    const result = await this.prisma.conversationParticipant.aggregate({
      where: { userId },
      _sum: { unreadCount: true },
    });
    return result._sum.unreadCount || 0;
  }
}
