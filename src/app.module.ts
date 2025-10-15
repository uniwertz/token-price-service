import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";

import { AppConfigModule } from "./app/config/config.module";
import { PricingInterfaceModule } from "@contexts/pricing/pricing.interface.module";

/**
 * MAIN APPLICATION MODULE
 *
 * AppModule — корневой модуль приложения, оркестрирующий контексты
 * и предоставляющий глобальную конфигурацию. Composition Root NestJS.
 *
 * Ключевые принципы:
 * - Импортирует bounded contexts
 * - Предоставляет глобальную конфигурацию (env, validation)
 * - Главная точка входа приложения
 * - Следует Clean Architecture
 *
 * Состав:
 * - AppConfigModule — глобальная конфигурация и валидация окружения
 * - PricingInterfaceModule — контекст Pricing со всеми слоями
 *
 * Пример:
 * ```typescript
 * const app = await NestFactory.create(AppModule);
 * await app.listen(3000);
 * ```
 */
@Module({
  imports: [AppConfigModule, ScheduleModule.forRoot(), PricingInterfaceModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
