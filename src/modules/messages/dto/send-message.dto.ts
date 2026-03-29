import { IsString, IsOptional, MaxLength, IsEnum } from 'class-validator';
import { MessageType } from '@prisma/client';

export class SendMessageDto {
  @IsString()
  conversationId: string;

  @IsString()
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @IsOptional()
  @IsString()
  replyToId?: string;
}
