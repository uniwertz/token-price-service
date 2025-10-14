import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { PricingApplicationModule } from './pricing.application.module';
import { PricingInfraModule } from './pricing.infra.module';
import { PricingController } from './interface/rest/pricing.controller';
import { SeedInitialDataHandler } from './application/use-cases/seed-initial-data/seed-initial-data.handler';
import { SeedInitialDataCommand } from './application/use-cases/seed-initial-data/seed-initial-data.command';

/**
 * INTERFACE LAYER MODULE — точка входа pricing-контекста
 *
 * PricingInterfaceModule объединяет слои (application, infrastructure, interface)
 * в цельный модуль и обрабатывает логику инициализации.
 *
 * Ключевые принципы:
 * - Импортирует application и infrastructure модули
 * - Предоставляет REST-контроллеры
 * - Выполняет application startup-логику (seeding)
 * - Composition Root для контекста
 *
 * Состав модуля:
 * - PricingApplicationModule — use case handlers
 * - PricingInfraModule — инфраструктурные реализации
 * - PricingController — REST API
 */
@Module({
  imports: [PricingApplicationModule, PricingInfraModule],
  controllers: [PricingController],
})
export class PricingInterfaceModule implements OnModuleInit {
  private readonly logger = new Logger(PricingInterfaceModule.name);

  /**
   * DI seed handler
   * @param seedHandler — обработчик начального наполнения данных
   */
  constructor(private readonly seedHandler: SeedInitialDataHandler) {}

  /**
   * Инициализация модуля — автоматический seeding при старте
   *
   * Поведение:
   * - Проверяет конфигурацию окружения
   * - Пропускает seeding в тестовом окружении
   * - Логирует операции для аудита
   * - Обрабатывает ошибки мягко
   */
  async onModuleInit() {
    try {
      const isTestEnv = process.env.NODE_ENV === 'test';
      const autoSeedOnStartup = (process.env.AUTO_SEED_ON_STARTUP || 'true') === 'true';

      // Автоматическое сидирование только в development и только если включено
      if (!isTestEnv && autoSeedOnStartup) {
        this.logger.log('Auto-seeding enabled, starting initial data seeding...');
        await this.seedHandler.execute(new SeedInitialDataCommand('system'));
      } else {
        this.logger.log('Auto-seeding disabled or test environment, skipping seed');
      }
    } catch (error) {
      this.logger.error('Failed to initialize pricing module', error.stack, { error: error.message });
    }
  }
}
