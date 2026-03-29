// ─── Client → Server ──────────────────────────────────
export const WS_CLIENT_EVENTS = {
  SEND_MESSAGE: 'send_message',
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
  MARK_READ: 'mark_read',
  JOIN_CONVERSATION: 'join_conversation',
  LEAVE_CONVERSATION: 'leave_conversation',
} as const;

// ─── Server → Client ──────────────────────────────────
export const WS_SERVER_EVENTS = {
  NEW_MESSAGE: 'new_message',
  MESSAGE_UPDATED: 'message_updated',
  MESSAGE_DELETED: 'message_deleted',
  USER_TYPING: 'user_typing',
  USER_STOP_TYPING: 'user_stop_typing',
  MESSAGES_READ: 'messages_read',
  CONVERSATION_UPDATED: 'conversation_updated',
  NEW_CONVERSATION: 'new_conversation',
  ERROR: 'error',
  CONNECTED: 'connected',
} as const;

// ─── Socket.IO Room Prefixes ──────────────────────────
export const ROOM_PREFIX = {
  CONVERSATION: 'conversation:',
  USER: 'user:',
  ADMIN_SUPPORT: 'admin:support',
} as const;

// ─── RabbitMQ Routing Keys ────────────────────────────
export const RABBITMQ_EVENTS = {
  CHAT_MESSAGE_SENT: 'chat.message.sent',
  CHAT_CONVERSATION_CREATED: 'chat.conversation.created',
} as const;
