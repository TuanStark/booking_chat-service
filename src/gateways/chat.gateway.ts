import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MessagesService } from '../modules/messages/messages.service';
import { ConversationsService } from '../modules/conversations/conversations.service';
import { ParticipantRole } from '@prisma/client';
import { WS_CLIENT_EVENTS, WS_SERVER_EVENTS, ROOM_PREFIX } from '../common/constants/events.constant';
import { CORS_ALLOWED_ORIGINS } from '../config/cors.config';

@WebSocketGateway({
  cors: {
    origin: [...CORS_ALLOWED_ORIGINS],
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  /** userId -> Set<socketId> */
  private readonly connectedUsers = new Map<string, Set<string>>();
  /** socketId -> { userId, role } */
  private readonly socketMeta = new Map<string, { userId: string; role: string }>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
  ) {}

  // ─── Connection Lifecycle ────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
      if (!token) { client.disconnect(); return; }

      const payload = this.jwtService.verify(token, { algorithms: ['RS256'] });
      const userId = (payload.sub || payload.userId) as string | undefined;
      const role = String(payload.role ?? payload.roleName ?? 'user').toLowerCase();
      if (!userId) { client.disconnect(); return; }

      // Track connection
      if (!this.connectedUsers.has(userId)) this.connectedUsers.set(userId, new Set());
      this.connectedUsers.get(userId)!.add(client.id);
      this.socketMeta.set(client.id, { userId, role });

      // Join personal room
      client.join(`${ROOM_PREFIX.USER}${userId}`);

      // Admin joins admin support room to receive new conversation alerts
      if (role === 'admin') {
        client.join(ROOM_PREFIX.ADMIN_SUPPORT);
      }

      client.emit(WS_SERVER_EVENTS.CONNECTED, { userId, role, timestamp: new Date().toISOString() });
      this.logger.log(`✅ ${role}:${userId} connected (${client.id})`);
    } catch (error) {
      this.logger.error(`❌ WS auth failed: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const meta = this.socketMeta.get(client.id);
    if (meta) {
      const userSockets = this.connectedUsers.get(meta.userId);
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) this.connectedUsers.delete(meta.userId);
      }
      this.socketMeta.delete(client.id);
      this.logger.log(`👋 ${meta.role}:${meta.userId} disconnected`);
    }
  }

  // ─── Client Events ──────────────────────────────────────

  @SubscribeMessage(WS_CLIENT_EVENTS.JOIN_CONVERSATION)
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.join(`${ROOM_PREFIX.CONVERSATION}${data.conversationId}`);
    this.logger.log(`Socket ${client.id} joined room conversation:${data.conversationId}`);
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.LEAVE_CONVERSATION)
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.leave(`${ROOM_PREFIX.CONVERSATION}${data.conversationId}`);
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.SEND_MESSAGE)
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; content: string; type?: any; replyToId?: string },
  ) {
    const meta = this.socketMeta.get(client.id);
    if (!meta) { client.emit(WS_SERVER_EVENTS.ERROR, { message: 'Not authenticated' }); return; }

    try {
      const senderRole = meta.role === 'admin' ? ParticipantRole.ADMIN : ParticipantRole.USER;
      const message = await this.messagesService.sendMessage(meta.userId, senderRole, {
        conversationId: data.conversationId,
        content: data.content,
        type: data.type,
        replyToId: data.replyToId,
      });

      // Broadcast to all in conversation room (including sender for confirmation)
      this.server
        .to(`${ROOM_PREFIX.CONVERSATION}${data.conversationId}`)
        .emit(WS_SERVER_EVENTS.NEW_MESSAGE, {
          ...message,
          senderName: meta.userId, // Frontend will resolve name from user cache
        });

      this.logger.log(`📨 Message ${message.id} sent by ${meta.role}:${meta.userId}`);
    } catch (error) {
      client.emit(WS_SERVER_EVENTS.ERROR, { message: error.message });
    }
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.TYPING_START)
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const meta = this.socketMeta.get(client.id);
    if (!meta) return;
    client.to(`${ROOM_PREFIX.CONVERSATION}${data.conversationId}`).emit(WS_SERVER_EVENTS.USER_TYPING, {
      conversationId: data.conversationId,
      userId: meta.userId,
      role: meta.role,
    });
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.TYPING_STOP)
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const meta = this.socketMeta.get(client.id);
    if (!meta) return;
    client.to(`${ROOM_PREFIX.CONVERSATION}${data.conversationId}`).emit(WS_SERVER_EVENTS.USER_STOP_TYPING, {
      conversationId: data.conversationId,
      userId: meta.userId,
    });
  }

  @SubscribeMessage(WS_CLIENT_EVENTS.MARK_READ)
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; messageId: string },
  ) {
    const meta = this.socketMeta.get(client.id);
    if (!meta) return;

    try {
      await this.conversationsService.markAsRead(data.conversationId, meta.userId, data.messageId);
      // Notify other participants that messages have been read
      client.to(`${ROOM_PREFIX.CONVERSATION}${data.conversationId}`).emit(WS_SERVER_EVENTS.MESSAGES_READ, {
        conversationId: data.conversationId,
        userId: meta.userId,
        messageId: data.messageId,
      });
    } catch (error) {
      client.emit(WS_SERVER_EVENTS.ERROR, { message: error.message });
    }
  }

  // ─── Server-side helpers (called from services) ─────────

  /** Notify admin room about a new conversation */
  notifyNewConversation(conversation: any) {
    this.server.to(ROOM_PREFIX.ADMIN_SUPPORT).emit(WS_SERVER_EVENTS.NEW_CONVERSATION, conversation);
  }

  /** Notify conversation room about status change */
  notifyConversationUpdated(conversationId: string, data: any) {
    this.server
      .to(`${ROOM_PREFIX.CONVERSATION}${conversationId}`)
      .emit(WS_SERVER_EVENTS.CONVERSATION_UPDATED, data);
  }
}
