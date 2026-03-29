import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageType, ParticipantRole, type Prisma } from '@prisma/client';

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    conversationId: string;
    senderId: string;
    senderRole: ParticipantRole;
    content: string;
    type?: MessageType;
    replyToId?: string;
    metadata?: any;
  }) {
    return this.prisma.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        senderRole: data.senderRole,
        content: data.content,
        type: data.type || MessageType.TEXT,
        replyToId: data.replyToId,
        metadata: data.metadata,
      },
    });
  }

  /** Cursor-based pagination: fetch messages before a cursor, newest first */
  async findByConversation(conversationId: string, limit: number, cursor?: string) {
    const where: Prisma.MessageWhereInput = {
      conversationId,
      isDeleted: false,
    };

    // If cursor provided, get messages BEFORE (older than) the cursor message
    if (cursor) {
      const cursorMessage = await this.prisma.message.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      });
      if (cursorMessage) {
        where.createdAt = { lt: cursorMessage.createdAt };
      }
    }

    return this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // Fetch one extra to detect hasMore
    });
  }

  async findById(id: string) {
    return this.prisma.message.findUnique({ where: { id } });
  }

  async update(id: string, content: string) {
    return this.prisma.message.update({
      where: { id },
      data: { content, isEdited: true, editedAt: new Date() },
    });
  }

  async softDelete(id: string) {
    return this.prisma.message.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }
}
