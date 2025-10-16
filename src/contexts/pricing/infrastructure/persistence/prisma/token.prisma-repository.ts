import { Injectable } from "@nestjs/common";

import { StructuredLoggerService } from "@shared/infrastructure/logging/structured-logger.service";
import { PrismaService } from "@shared/infrastructure/prisma/prisma.service";

import { Chain } from "@contexts/pricing/domain/entities/chain";
import { Token } from "@contexts/pricing/domain/entities/token";
import { TokenLogo } from "@contexts/pricing/domain/entities/token-logo";
import {
  TokenRepository,
  TokenPage,
} from "@contexts/pricing/domain/repositories/token-repository.port";

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
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: StructuredLoggerService
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

    return {
      items: rows.map((row) => this.mapToDomain(row)),
      total,
      page,
      pageSize: rows.length,
      totalPages,
    };
  }

  /**
   * Обработать все токены потоком (для внутренних операций)
   *
   * Использует cursor-based подход для эффективного обхода 24k+ токенов
   * без загрузки всех в память. Идеально для batch-обработки.
   */
  async processAll(
    callback: (tokens: Token[]) => Promise<void>,
    batchSize = 100
  ): Promise<void> {
    let cursor: string | undefined = undefined;
    let _processedCount = 0;

    // eslint-disable-next-line no-constant-condition
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

      _processedCount += rows.length;
      cursor = rows[rows.length - 1].id;

      // Если получили меньше чем batchSize, значит это последний батч
      if (rows.length < batchSize) break;
    }

    // агрегированное логирование переносится на уровень use case
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
    await this.prisma.token.update({
      where: { id: token.id },
      data: {
        currentPrice: token.currentPrice, // строка для Prisma Decimal
        lastPriceUpdateDateTime: token.lastPriceUpdateDateTime,
      },
    });
  }

  /**
   * Batch-сохранение токенов (эффективнее для больших объёмов)
   *
   * Использует Prisma $transaction + updateMany для минимизации round-trips к БД.
   * Для 100 токенов: 1 запрос вместо 100.
   */
  async saveBatch(tokens: Token[]): Promise<void> {
    if (tokens.length === 0) return;

    // Группируем обновления в transaction для атомарности
    await this.prisma.$transaction(
      tokens.map((token) =>
        this.prisma.token.update({
          where: { id: token.id },
          data: {
            currentPrice: token.currentPrice, // строка для Prisma Decimal
            lastPriceUpdateDateTime: token.lastPriceUpdateDateTime,
          },
        })
      )
    );
  }

  /**
   * Возвращает максимальную метку времени обновления цены среди всех токенов
   */
  async getLastUpdateTimestamp(): Promise<Date | null> {
    const result = await this.prisma.token.aggregate({
      _max: { lastPriceUpdateDateTime: true },
    });
    return result._max.lastPriceUpdateDateTime ?? null;
  }

  async getDistinctChainCount(): Promise<number> {
    const result = await this.prisma.token.groupBy({
      by: ["chainId"],
      _count: { chainId: true },
    });
    return result.length;
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
      currentPrice: String(row.currentPrice),
      lastPriceUpdateDateTime: row.lastPriceUpdateDateTime,
      chain,
      logo,
    });
  }
}
