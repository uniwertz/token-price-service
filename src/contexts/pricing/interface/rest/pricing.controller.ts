import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Query,
  Headers,
} from "@nestjs/common";

import { UpdateTokenPricesCommand } from "@contexts/pricing/application/use-cases/update-token-prices/update-token-prices.command";
import { UpdateTokenPricesHandler } from "@contexts/pricing/application/use-cases/update-token-prices/update-token-prices.handler";
import {
  TOKEN_REPOSITORY,
  TokenRepository,
} from "@contexts/pricing/domain/repositories/token-repository.port";
import { GetStatusQuery } from "@contexts/pricing/application/queries/get-status.query";
import { GetHealthQuery } from "@contexts/pricing/application/queries/get-health.query";

/**
 * INTERFACE LAYER — REST Controller
 *
 * PricingController обрабатывает HTTP-запросы для pricing-контекста.
 * Это точка входа для внешних систем и следует принципам REST.
 *
 * Ключевые принципы:
 * - Обрабатывает HTTP-концерны (request/response, статус-коды, сериализация)
 * - Делегирует бизнес-логику в application layer (use cases)
 * - Предоставляет API для внешних планировщиков и мониторинга
 * - Не содержит бизнес-логики
 * - Следует REST- и HTTP-семантике
 *
 * Предоставляет:
 * - Health-эндпоинты для мониторинга
 * - Status-эндпоинты для состояния системы
 * - Trigger-эндпоинт для внешних планировщиков
 * - Корректные статус-коды и обработку ошибок
 *
 * Пример:
 * ```typescript
 * // Health check
 * GET /pricing/health
 *
 * // Trigger price update
 * POST /pricing/trigger-update
 * ```
 */
@Controller("pricing")
export class PricingController {
  /**
   * Конструктор зависимостей
   * @param tokenRepository — доступ к данным токенов
   * @param updateTokenPricesHandler — use case обновления цен
   * @param healthQuery — health (application layer)
   * @param statusQuery — status (application layer)
   */
  constructor(
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepository: TokenRepository,
    private readonly updateTokenPricesHandler: UpdateTokenPricesHandler,
    private readonly healthQuery: GetHealthQuery,
    private readonly statusQuery: GetStatusQuery
  ) {}

  /**
   * Health check для систем мониторинга
   *
   * Возвращает:
   * - статус
   * - timestamp
   *
   * Легковесный endpoint для проверки доступности сервиса.
   */
  @Get("health")
  async getHealth() {
    return this.healthQuery.execute();
  }

  /**
   * Status endpoint (readiness)
   *
   * Проверяет готовность системы и возвращает статистику по данным.
   */
  @Get("status")
  async getStatus() {
    return this.statusQuery.execute();
  }

  /**
   * Получить информацию по токенам (offset-based pagination)
   *
   * Query params:
   * - page: номер страницы (1-based, default: 1)
   * - limit: количество токенов на странице (default: 50, max: 1000)
   *
   * Возвращает:
   * - список токенов с ценами
   * - информацию о сети
   * - логотипы
   * - метаданные пагинации (total, totalPages, page)
   *
   * Пример:
   * GET /pricing/tokens?page=1&limit=50 → первая страница
   * GET /pricing/tokens?page=2&limit=50 → вторая страница (цены обновляются!)
   */
  @Get("tokens")
  async getTokens(
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    const pageNum = Math.max(Number(page) || 1, 1); // Минимум 1
    const pageLimit = Math.min(Number(limit) || 50, 1000); // Макс 1000 за раз

    const result = await this.tokenRepository.findPage(pageNum, pageLimit);

    return {
      tokens: result.items.map((token) => ({
        id: token.id,
        symbol: token.symbol,
        displayName: token.displayName,
        currentPrice: token.currentPrice,
        lastPriceUpdateDateTime: token.lastPriceUpdateDateTime.toISOString(),
        decimalPlaces: token.decimalPlaces,
        isNativeToken: token.isNativeToken,
        chain: {
          id: token.chain.id,
          name: token.chain.name,
          deploymentId: token.chain.deploymentId,
          isEnabled: token.chain.isEnabled,
        },
        logo: token.logo
          ? {
              largeImagePath: token.logo.largeImagePath,
              mediumImagePath: token.logo.mediumImagePath,
              thumbnailPath: token.logo.thumbnailPath,
            }
          : null,
      })),
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Trigger для внешних планировщиков
   *
   * Используется:
   * - Внешние планировщики (cron, systemd timers)
   * - Ручные прогоны при тестировании
   */
  @Post("trigger-update")
  async triggerUpdate(@Headers("x-internal-job-token") jobToken?: string) {
    const startTime = Date.now();
    try {
      // В проде требуем внутренний токен для ограничения доступа извне
      if (
        (process.env.NODE_ENV || "development").toLowerCase() === "production"
      ) {
        const expected = process.env.INTERNAL_JOB_TOKEN || "";
        if (!expected || jobToken !== expected) {
          throw new HttpException("Forbidden", HttpStatus.FORBIDDEN);
        }
      }

      await this.updateTokenPricesHandler.execute(
        new UpdateTokenPricesCommand()
      );
      const duration = Date.now() - startTime;

      return {
        status: "completed",
        message: "Price update completed successfully",
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
      };
    } catch (error) {
      throw new HttpException(
        "Failed to trigger price update",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
