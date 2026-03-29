import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ConversationType } from '@prisma/client';

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsEnum(ConversationType)
  type?: ConversationType;

  @IsOptional()
  @IsString()
  contextType?: string;

  @IsOptional()
  @IsString()
  contextId?: string;
}
