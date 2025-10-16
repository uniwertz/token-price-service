import { Inject, Injectable } from "@nestjs/common";

import {
  DOMAIN_EVENT_BUS,
  DomainEventBus,
} from "@shared/kernel/domain-event-bus.port";
import { DomainEvent } from "@shared/kernel/domain-event";
import { StructuredLoggerService } from "@shared/infrastructure/logging/structured-logger.service";
import { TelemetryService } from "@shared/infrastructure/telemetry/telemetry.service";

import { Token } from "@contexts/pricing/domain/entities/token";
import {
  EXTERNAL_PRICE_SERVICE_PORT,
  ExternalPriceServicePort,
} from "@contexts/pricing/domain/repositories/external-price-service.port";
import {
  TOKEN_REPOSITORY,
  TokenRepository,
} from "@contexts/pricing/domain/repositories/token-repository.port";
import { UpdateTokenPricesCommand } from "./update-token-prices.command";

/**
 * APPLICATION LAYER — Use Case Handler
 *
 * UpdateTokenPricesHandler оркестрирует workflow обновления цен токенов.
 * Это «Use Case» в Clean Architecture — координирует взаимодействие доменных сущностей
 * и инфраструктурных сервисов для выполнения конкретного бизнес-требования.
 *
 * Ключевые принципы:
 * - Содержит application-логику, а не бизнес-правила (они в domain)
 * - Оркестрирует доменные сущности и инфраструктуру
 * - Обрабатывает cross-cutting concerns (logging, telemetry, error handling)
 * - Зависит от абстракций (ports), а не реализаций
 * - Единственная ответственность: обновить цены всех токенов
 *
 * «Горячий путь» приложения — содержит:
 * - Telemetry и performance monitoring
 * - Изоляцию ошибок по токенам
 * - Структурированное логирование
 * - Публикацию Domain Events
 *
 * Пример:
 * ```typescript
 * await this.updateTokenPricesHandler.execute(new UpdateTokenPricesCommand());
 * ```
 */
@Injectable()
export class UpdateTokenPricesHandler {
  /**
   * Конструктор с dependency injection
   * Все зависимости — абстракции (ports), что упрощает тестирование (DIP)
   */
  constructor(
    /** Repository для операций персистентности токенов */
    @Inject(TOKEN_REPOSITORY) private readonly repo: TokenRepository,
    /** Внешний сервис получения текущих цен */
    @Inject(EXTERNAL_PRICE_SERVICE_PORT)
    private readonly externalPriceService: ExternalPriceServicePort,
    /** Event Bus для публикации доменных событий */
    @Inject(DOMAIN_EVENT_BUS) private readonly bus: DomainEventBus,
    /** Structured Logger */
    private readonly logger: StructuredLoggerService,
    /** Telemetry (метрики и трассировка) */
    private readonly telemetry: TelemetryService
  ) {
    this.logger.setContext("UpdateTokenPricesHandler");
  }

  /**
   * Execute use case: обновить цены всех токенов
   *
   * Шаги:
   * 1. Обойти все токены потоком (processAll) батчами по 100
   * 2. Для каждого токена запросить новую цену во внешнем сервисе
   * 3. Обновить агрегат (генерируются Domain Events)
   * 4. Опубликовать события в Kafka (ПЕРЕД сохранением в БД)
   * 5. Сохранить изменения в БД батчем (1 транзакция на 100 токенов)
   * 6. Обработать ошибки (ошибка одного токена не валит весь процесс)
   * 7. Записать метрики и тайминги
   *
   * Производительность:
   * - Cursor-based обход (не загружаем все 24k токенов в память)
   * - Batch-сохранение (1 запрос вместо 100)
   * - Параллельная обработка внутри батча (Promise.allSettled)
   */
  async execute(_cmd: UpdateTokenPricesCommand): Promise<void> {
    // cmd parameter is required by interface but not used in this implementation
    const span = this.telemetry.startSpan("updateTokenPrices");
    const startTime = Date.now();

    try {
      let totalProcessed = 0;
      let updatedCount = 0;
      let errorCount = 0;

      this.logger.log("Starting token price update...");

      // Потоковая обработка всех токенов батчами (без загрузки всех в память)
      await this.repo.processAll(async (batch) => {
        // Параллельная обработка токенов в батче
        const results = await Promise.allSettled(
          batch.map(async (token) => {
            const newPrice = await this.externalPriceService.getPriceForToken({
              id: token.id,
              symbol: token.symbol,
            });
            token.updatePrice(newPrice, new Date());
            return token; // Возвращаем обновлённый токен (события внутри)
          })
        );

        // Собираем успешно обновлённые токены и их события
        const tokensToSave: Token[] = [];
        const allEvents: DomainEvent[] = [];

        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            const token = result.value;
            tokensToSave.push(token);
            allEvents.push(...token.pullEvents()); // Собираем события
            updatedCount++;
          } else {
            errorCount++;
            const token = batch[index];
            this.logger.error(
              `${token.symbol || token.id}: ${result.reason?.message}`
            );
          }
        });

        // Публикуем ВСЕ события батча одним вызовом (1 запрос в Kafka вместо 100)
        if (allEvents.length > 0) {
          await this.bus.publish(allEvents);
        }

        // Batch-сохранение всех токенов батча (1 транзакция вместо 100 запросов)
        if (tokensToSave.length > 0) {
          await this.repo.saveBatch(tokensToSave);
        }

        totalProcessed += batch.length;

        // Логируем прогресс каждые 1000 токенов
        if (totalProcessed % 1000 === 0) {
          this.logger.log(`   Processed ${totalProcessed} tokens...`);
        }
      }, 100); // Размер батча: 100 токенов

      // Итоговый лог — компактный и информативный
      const successRate =
        totalProcessed > 0
          ? Math.round((updatedCount / totalProcessed) * 100)
          : 0;
      this.logger.log(
        `${updatedCount}/${totalProcessed} updated (${successRate}%)${
          errorCount > 0 ? ` | ${errorCount} errors` : ""
        }`
      );

      this.telemetry.recordMetric({
        name: "token_prices_update_completed",
        value: 1,
        labels: {
          totalTokens: totalProcessed.toString(),
          updatedCount: updatedCount.toString(),
          errorCount: errorCount.toString(),
        },
      });
    } catch (error) {
      this.logger.error(
        "Failed to update token prices",
        (error as Error).stack
      );
      this.telemetry.recordMetric({
        name: "token_prices_update_failed",
        value: 1,
      });
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      this.telemetry.recordSpan(span, "updateTokenPrices", duration, true);
    }
  }
}
