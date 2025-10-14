import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Main');
  logger.log('Starting Token Price Service...');

  try {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    app.enableShutdownHooks();

    const port = Number(process.env.PORT) || 3000;
    await app.listen(port);
    logger.log(`Service is running on port ${port}`);

    const gracefulShutdown = async (signal: string) => {
      logger.log(`Received ${signal}. Shutting down gracefully...`);
      try {
        await app.close();
        logger.log('Application closed. Bye!');
        process.exit(0);
      } catch (closeError) {
        logger.error('Error during shutdown', (closeError as Error).stack);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  } catch (error) {
    logger.error('Fatal error during bootstrap', (error as Error).stack);
    process.exit(1);
  }
}
bootstrap();
