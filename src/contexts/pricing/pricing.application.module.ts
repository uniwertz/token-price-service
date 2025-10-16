import { Module } from "@nestjs/common";

import { PricingInfraModule } from "./pricing.infra.module";
import { GetHealthQuery } from "./application/queries/get-health.query";
import { GetStatusQuery } from "./application/queries/get-status.query";
import { SeedInitialDataHandler } from "./application/use-cases/seed-initial-data/seed-initial-data.handler";
import { UpdateTokenPricesHandler } from "./application/use-cases/update-token-prices/update-token-prices.handler";

/**
 * APPLICATION LAYER MODULE
 *
 * PricingApplicationModule предоставляет use case handlers для pricing-контекста.
 * Содержит application-логику, которая оркестрирует домен и инфраструктуру
 * для выполнения бизнес-требований.
 *
 * Ключевые принципы:
 * - Только use cases (application services)
 * - Без инфраструктурных зависимостей (зависит от абстракций)
 * - Экспортирует handlers для interface слоя
 * - Следует SRP (Single Responsibility Principle)
 *
 * Содержит:
 * - UpdateTokenPricesHandler — workflow обновления цен
 * - SeedInitialDataHandler — начальное наполнение данных
 *
 * Импортируется:
 * - PricingInterfaceModule (для REST)
 * - Тестовыми модулями
 */
@Module({
  imports: [PricingInfraModule],
  providers: [UpdateTokenPricesHandler, SeedInitialDataHandler, GetHealthQuery, GetStatusQuery],
  exports: [UpdateTokenPricesHandler, SeedInitialDataHandler, GetHealthQuery, GetStatusQuery],
})
export class PricingApplicationModule {}
