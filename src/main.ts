import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { CORS_ALLOWED_ORIGINS } from './config/cors.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: [...CORS_ALLOWED_ORIGINS],
    credentials: true,
  });

  const port = process.env.PORT || 3013;
  await app.listen(port);

  logger.log(`🚀 Chat Service is running on port ${port}`);
  logger.log(`🔌 WebSocket namespace: /chat`);
}
bootstrap();
