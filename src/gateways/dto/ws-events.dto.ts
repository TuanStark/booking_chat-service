import { IsString, IsNotEmpty } from 'class-validator';

export class JoinConversationDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;
}

export class LeaveConversationDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;
}

export class TypingEventDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;
}

export class MarkReadDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  messageId: string;
}
