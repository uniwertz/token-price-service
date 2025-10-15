import { Injectable } from "@nestjs/common";

import { StructuredLoggerService } from "@shared/infrastructure/logging/structured-logger.service";
import { PrismaService } from "@shared/infrastructure/prisma/prisma.service";
import { TelemetryService } from "@shared/infrastructure/telemetry/telemetry.service";
import { retry } from "@shared/utils/retry";

import { Chain } from "@contexts/pricing/domain/entities/chain";
import { Token } from "@contexts/pricing/domain/entities/token";
import { TokenLogo } from "@contexts/pricing/domain/entities/token-logo";
import { TokenRepository, TokenPage } from "@contexts/pricing/domain/repositories/token-repository.port";

/**
 * INFRASTRUCTURE LAYER — Repository Adapter
 *
 * PrismaTokenRepository реализует порт TokenRepository с помощью Prisma ORM.
 * Это «адаптер» в архитектуре Ports & Adapters (Hexagonal).
 *
 * Ключевые принципы:
 * - Реализует доменные интерфейсы (ports) конкретной технологией
 * - Решает технические задачи (запросы к БД, ORM-маппинг, retry)
 * - Не содержит бизнес-логики (она в domain)
 * - Добавляет надёжность (retry, telemetry, logging)
 * - Маппит между domain-entity и моделями БД
 *
 * Пример:
 * ```typescript
 * // Domain использует интерфейс
 * const tokens = await this.tokenRepository.findAll();
 *
 * // Infrastructure предоставляет реализацию
 * const repo = new PrismaTokenRepository(prisma, logger, telemetry);
 * ```
 */
@Injectable()
export class PrismaTokenRepository implements TokenRepository {
  /**
   * Конструктор инфраструктурных зависимостей
   * @param prisma — Prisma ORM клиент
   * @param logger — структурированный логгер
   * @param telemetry — метрики/трейсинг
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: StructuredLoggerService,
    private readonly telemetry: TelemetryService
  ) {
    this.logger.setContext("PrismaTokenRepository");
  }

  /**
   * Получить страницу токенов (offset-based pagination для REST API)
   *
   * Использует OFFSET/LIMIT для классической пагинации.
   * Подходит для API, где клиент может переходить на любую страницу.
   */
  async findPage(page: number, limit: number): Promise<TokenPage> {
    const span = this.telemetry.startSpan("token.findPage");
    const startTime = Date.now();

    try {
      return await retry(
        async () => {
          const skip = (page - 1) * limit;

          // Параллельно запрашиваем данные и общее количество
          const [rows, total] = await Promise.all([
            this.prisma.token.findMany({
              skip,
              take: limit,
              orderBy: { id: "asc" },
              include: {
                chain: true,
                logo: true,
              },
            }),
            this.prisma.token.count(),
          ]);

          const totalPages = Math.ceil(total / limit);

          this.telemetry.recordMetric({
            name: "tokens_page_fetched",
            value: rows.length,
            labels: {
              operation: "findPage",
              page: page.toString(),
              total: total.toString(),
            },
          });

          return {
            items: rows.map((row) => this.mapToDomain(row)),
            total,
            page,
            pageSize: rows.length,
            totalPages,
          };
        },
        { retries: 3, initialDelayMs: 100, factor: 2 }
      );
    } finally {
      const duration = Date.now() - startTime;
      this.telemetry.recordSpan(span, "token.findPage", duration, true);
    }
  }

  /**
   * Обработать все токены потоком (для внутренних операций)
   *
   * Использует cursor-based подход для эффективного обхода 24k+ токенов
   * без загрузки всех в память. Идеально для batch-обработки.
   */
  async processAll(
    callback: (tokens: Token[]) => Promise<void>,
    batchSize: number = 100
  ): Promise<void> {
    const span = this.telemetry.startSpan("token.processAll");
    const startTime = Date.now();

    try {
      let cursor: string | undefined = undefined;
      let processedCount = 0;

      while (true) {
        const rows = await this.prisma.token.findMany({
          take: batchSize,
          ...(cursor && {
            cursor: { id: cursor },
            skip: 1, // Пропускаем сам курсор
          }),
          orderBy: { id: "asc" },
          include: {
            chain: true,
            logo: true,
          },
        });

        if (rows.length === 0) break;

        const tokens = rows.map((row) => this.mapToDomain(row));
        await callback(tokens);

        processedCount += rows.length;
        cursor = rows[rows.length - 1].id;

        // Если получили меньше чем batchSize, значит это последний батч
        if (rows.length < batchSize) break;
      }

      this.telemetry.recordMetric({
        name: "tokens_processed_all",
        value: processedCount,
        labels: { operation: "processAll" },
      });
    } finally {
      const duration = Date.now() - startTime;
      this.telemetry.recordSpan(span, "token.processAll", duration, true);
    }
  }

  /**
   * Сохранить токен
   *
   * Метод:
   * - Обновляет только изменяемые поля (цена, метка времени)
   * - Применяет retry
   * - Пишет telemetry и логирует операцию
   */
  async save(token: Token): Promise<void> {
    const span = this.telemetry.startSpan("token.save");
    const startTime = Date.now();

    try {
      return await retry(
        async () => {
          await this.prisma.token.update({
            where: { id: token.id },
            data: {
              currentPrice: token.currentPrice,
              lastPriceUpdateDateTime: token.lastPriceUpdateDateTime,
            },
          });

          // Логирование перенесено на уровень use case (агрегированная сводка)
          this.telemetry.recordMetric({
            name: "token_saved",
            value: 1,
            labels: { operation: "save" },
          });
        },
        { retries: 3, initialDelayMs: 100, factor: 2 }
      );
    } finally {
      const duration = Date.now() - startTime;
      this.telemetry.recordSpan(span, "token.save", duration, true);
    }
  }

  /**
   * Batch-сохранение токенов (эффективнее для больших объёмов)
   *
   * Использует Prisma $transaction + updateMany для минимизации round-trips к БД.
   * Для 100 токенов: 1 запрос вместо 100.
   */
  async saveBatch(tokens: Token[]): Promise<void> {
    if (tokens.length === 0) return;

    const span = this.telemetry.startSpan("token.saveBatch");
    const startTime = Date.now();

    try {
      await retry(
        async () => {
          // Группируем обновления в transaction для атомарности
          await this.prisma.$transaction(
            tokens.map((token) =>
              this.prisma.token.update({
                where: { id: token.id },
                data: {
                  currentPrice: token.currentPrice,
                  lastPriceUpdateDateTime: token.lastPriceUpdateDateTime,
                },
              })
            )
          );

          this.telemetry.recordMetric({
            name: "tokens_saved_batch",
            value: tokens.length,
            labels: { operation: "saveBatch" },
          });
        },
        { retries: 3, initialDelayMs: 200, factor: 2 }
      );
    } finally {
      const duration = Date.now() - startTime;
      this.telemetry.recordSpan(span, "token.saveBatch", duration, true);
    }
  }

  /**
   * Маппинг Prisma-модели БД в доменную сущность
   *
   * Выполняет конвертацию между:
   * - БД-моделями (Prisma) и domain-entities
   * - Техническими типами (Buffer/Uint8Array) и доменными значениями
   * - Связанными сущностями (Chain, TokenLogo)
   */
  private mapToDomain(row: any): Token {
    const chain = Chain.restore({
      id: row.chain.id,
      deploymentId: row.chain.deploymentId,
      name: row.chain.name,
      isEnabled: row.chain.isEnabled,
    });

    const logo = row.logo
      ? TokenLogo.restore({
          id: row.logo.id,
          tokenId: row.logo.tokenId,
          largeImagePath: row.logo.largeImagePath,
          mediumImagePath: row.logo.mediumImagePath,
          thumbnailPath: row.logo.thumbnailPath,
        })
      : null;

    return Token.restore({
      id: row.id,
      contractAddress: Buffer.from(row.contractAddress),
      symbol: row.symbol,
      displayName: row.displayName,
      decimalPlaces: row.decimalPlaces,
      isNativeToken: row.isNativeToken,
      chainId: row.chainId,
      isSystemProtected: row.isSystemProtected,
      lastModifiedBy: row.lastModifiedBy,
      displayPriority: row.displayPriority,
      currentPrice: Number(row.currentPrice),
      lastPriceUpdateDateTime: row.lastPriceUpdateDateTime,
      chain,
      logo,
    });
  }
}
