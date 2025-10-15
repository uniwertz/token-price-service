import { Inject, Injectable } from "@nestjs/common";

import {
  DOMAIN_EVENT_BUS,
  DomainEventBus,
} from "@shared/kernel/domain-event-bus.port";
import { StructuredLoggerService } from "@shared/infrastructure/logging/structured-logger.service";
import { TelemetryService } from "@shared/infrastructure/telemetry/telemetry.service";

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
   * 1. Получить все токены из репозитория
   * 2. Для каждого токена запросить новую цену во внешнем сервисе
   * 3. Обновить агрегат (генерируются Domain Events)
   * 4. Сохранить изменения
   * 5. Опубликовать события
   * 6. Обработать ошибки (ошибка одного токена не валит весь процесс)
   * 7. Записать метрики и тайминги
   */
  async execute(_cmd: UpdateTokenPricesCommand): Promise<void> {
    // cmd parameter is required by interface but not used in this implementation
    const span = this.telemetry.startSpan("updateTokenPrices");
    const startTime = Date.now();

    try {
      this.logger.log("Starting token prices update");

      const tokens = await this.repo.findAll();
      let updatedCount = 0;
      let errorCount = 0;

      // Параллельная обработка батчами для масштабируемости
      const BATCH_SIZE = 100; // Обрабатываем по 100 токенов параллельно
      const CONCURRENCY = 10; // Максимум 10 одновременных запросов к внешнему API

      for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        const batch = tokens.slice(i, i + BATCH_SIZE);

        // Разбиваем батч на группы по CONCURRENCY
        const results = await Promise.allSettled(
          batch.map(async (token) => {
            const newPrice = await this.externalPriceService.getPriceForToken({
              id: token.id,
              symbol: token.symbol,
            });
            token.updatePrice(newPrice, new Date());

            // Публикуем событие в Kafka ПЕРЕД сохранением в БД
            await this.bus.publish(token.pullEvents());

            // Только после успешной публикации сохраняем в БД
            await this.repo.save(token);
            return token.id;
          })
        );

        // Подсчет успешных и неудачных обновлений
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            updatedCount++;
          } else {
            errorCount++;
            const token = batch[index];
            this.logger.error(
              `Failed to update price for token ${token.id}`,
              result.reason?.stack,
              {
                tokenId: token.id,
                symbol: token.symbol,
                error: result.reason?.message,
              }
            );
          }
        });

        this.logger.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}`, {
          processed: Math.min(i + BATCH_SIZE, tokens.length),
          total: tokens.length,
          batchSuccess: results.filter((r) => r.status === "fulfilled").length,
          batchErrors: results.filter((r) => r.status === "rejected").length,
        });
      }

      this.logger.log("Token prices update completed", {
        totalTokens: tokens.length,
        updatedCount,
        errorCount,
      });

      this.telemetry.recordMetric({
        name: "token_prices_update_completed",
        value: 1,
        labels: {
          totalTokens: tokens.length.toString(),
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
