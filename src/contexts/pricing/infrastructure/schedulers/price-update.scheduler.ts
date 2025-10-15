import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";

import { StructuredLoggerService } from "@shared/infrastructure/logging/structured-logger.service";

import { UpdateTokenPricesCommand } from "@contexts/pricing/application/use-cases/update-token-prices/update-token-prices.command";
import { UpdateTokenPricesHandler } from "@contexts/pricing/application/use-cases/update-token-prices/update-token-prices.handler";

/**
 * INFRASTRUCTURE LAYER — Scheduled Task
 *
 * PriceUpdateScheduler обеспечивает периодическое обновление цен токенов.
 * Это инфраструктурный компонент, который триггерит use case по расписанию.
 *
 * Ключевые принципы:
 * - Инкапсулирует механизм планирования (cron)
 * - Делегирует бизнес-логику в application layer
 * - Обрабатывает ошибки планировщика независимо от бизнес-логики
 * - Позволяет включать/выключать через конфигурацию
 * - Логирует выполнение для мониторинга
 *
 * Использует:
 * - @Cron декоратор из @nestjs/schedule
 * - UpdateTokenPricesHandler для бизнес-логики
 * - Конфигурацию для гибкой настройки интервала
 *
 * Пример конфигурации (в .env):
 * ```
 * PRICE_UPDATE_ENABLED=true
 * PRICE_UPDATE_CRON="*\/5 * * * * *"
 * ```
 * (каждые 5 секунд)
 */
@Injectable()
export class PriceUpdateScheduler {
  private readonly isEnabled: boolean;
  private readonly cronExpression: string;

  constructor(
    private readonly updateTokenPricesHandler: UpdateTokenPricesHandler,
    private readonly logger: StructuredLoggerService,
    private readonly configService: ConfigService
  ) {
    this.logger.setContext("PriceUpdateScheduler");

    // Читаем конфигурацию из env
    this.isEnabled =
      this.configService.get<string>("PRICE_UPDATE_ENABLED", "true") === "true";
    this.cronExpression = this.configService.get<string>(
      "PRICE_UPDATE_CRON",
      "*/5 * * * * *" // По умолчанию: каждые 5 секунд
    );

    if (this.isEnabled) {
      this.logger.log("Price update scheduler enabled", {
        cronExpression: this.cronExpression,
      });
    } else {
      this.logger.log("Price update scheduler disabled");
    }
  }

  /**
   * Периодическое обновление цен по расписанию
   *
   * Декоратор Cron принимает cron-выражение (каждые 5 секунд по умолчанию)
   * Можно настроить через переменные окружения PRICE_UPDATE_CRON
   */
  @Cron("*/5 * * * * *", {
    name: "price-update",
    timeZone: "UTC",
  })
  async handlePriceUpdate() {
    if (!this.isEnabled) {
      return;
    }

    const startTime = Date.now();
    this.logger.log("Starting scheduled price update");

    try {
      await this.updateTokenPricesHandler.execute(
        new UpdateTokenPricesCommand("scheduler")
      );

      const duration = Date.now() - startTime;
      this.logger.log("Scheduled price update completed successfully", {
        duration: `${duration}ms`,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        "Scheduled price update failed",
        (error as Error).stack,
        {
          duration: `${duration}ms`,
        }
      );
      // Не пробрасываем ошибку, чтобы не сломать планировщик
    }
  }

  /**
   * Обновление каждые 30 минут (альтернативный вариант)
   * Закомментировано по умолчанию, можно раскомментировать при необходимости
   */
  // @Cron(CronExpression.EVERY_30_MINUTES, {
  //   name: "price-update-30min",
  //   timeZone: "UTC",
  // })
  // async handlePriceUpdate30Min() {
  //   if (!this.isEnabled) {
  //     return;
  //   }
  //   await this.handlePriceUpdate();
  // }

  /**
   * Обновление каждый час (альтернативный вариант)
   * Закомментировано по умолчанию
   */
  // @Cron(CronExpression.EVERY_HOUR, {
  //   name: "price-update-hourly",
  //   timeZone: "UTC",
  // })
  // async handlePriceUpdateHourly() {
  //   if (!this.isEnabled) {
  //     return;
  //   }
  //   await this.handlePriceUpdate();
  // }
}
