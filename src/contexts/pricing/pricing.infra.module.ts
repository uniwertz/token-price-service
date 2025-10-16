import { Module, forwardRef } from "@nestjs/common";

import { DOMAIN_EVENT_BUS } from "@shared/kernel/domain-event-bus.port";
import { StructuredLoggerService } from "@shared/infrastructure/logging/structured-logger.service";
import { PrismaService } from "@shared/infrastructure/prisma/prisma.service";
import { TelemetryService } from "@shared/infrastructure/telemetry/telemetry.service";

import { KafkaProducerService } from "../../kafka/kafka-producer.service";
import { MockPriceService } from "../../services/mock-price.service";
import { KafkaEventBus } from "./infrastructure/messaging/kafka/kafka-event-bus";
import { MockPriceFeedAdapter } from "./infrastructure/http/clients/mock-price-feed.adapter";
import { PrismaInitialDataRepository } from "./infrastructure/persistence/prisma/initial-data.prisma-repository";
import { PrismaTokenRepository } from "./infrastructure/persistence/prisma/token.prisma-repository";
import { PricingApplicationModule } from "./pricing.application.module";
import { EXTERNAL_PRICE_SERVICE_PORT } from "./domain/repositories/external-price-service.port";
import { INITIAL_DATA_REPOSITORY_PORT } from "./domain/repositories/initial-data-repository.port";
import { TOKEN_REPOSITORY } from "./domain/repositories/token-repository.port";

/**
 * INFRASTRUCTURE LAYER MODULE
 *
 * PricingInfraModule предоставляет инфраструктурные реализации для pricing-контекста.
 * Содержит конкретные реализации domain ports с использованием технологий.
 *
 * Ключевые принципы:
 * - Реализует порты домена (ports)
 * - Настраивает DI-binding для портов
 * - Содержит инфраструктурные сервисы (DB, messaging, HTTP)
 * - Экспортирует как конкретные сервисы, так и реализации портов
 *
 * Порты → реализации:
 * - TOKEN_REPOSITORY → PrismaTokenRepository
 * - DOMAIN_EVENT_BUS → KafkaEventBus
 * - EXTERNAL_PRICE_SERVICE_PORT → MockPriceFeedAdapter
 * - INITIAL_DATA_REPOSITORY_PORT → PrismaInitialDataRepository
 */
@Module({
  imports: [forwardRef(() => PricingApplicationModule)],
  providers: [
    KafkaProducerService,
    // Инфраструктурные сервисы
    PrismaService,
    MockPriceService,
    StructuredLoggerService,
    TelemetryService,

    // Реализации портов (DI-bindings)
    { provide: TOKEN_REPOSITORY, useClass: PrismaTokenRepository },
    { provide: DOMAIN_EVENT_BUS, useClass: KafkaEventBus },
    { provide: EXTERNAL_PRICE_SERVICE_PORT, useClass: MockPriceFeedAdapter },
    {
      provide: INITIAL_DATA_REPOSITORY_PORT,
      useClass: PrismaInitialDataRepository,
    },
  ],
  exports: [
    // Экспорт портов для application-слоя
    TOKEN_REPOSITORY,
    DOMAIN_EVENT_BUS,
    EXTERNAL_PRICE_SERVICE_PORT,
    INITIAL_DATA_REPOSITORY_PORT,

    // Экспорт инфраструктурных сервисов
    PrismaService,
    StructuredLoggerService,
    TelemetryService,
  ],
})
export class PricingInfraModule {}
