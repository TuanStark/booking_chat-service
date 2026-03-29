import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(_configService: ConfigService) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Prisma connected to Chat DB');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
