import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { TokenRepository } from '@contexts/pricing/domain/repositories/token-repository.port';
import { Token } from '@contexts/pricing/domain/entities/token';
import { Chain } from '@contexts/pricing/domain/entities/chain';
import { TokenLogo } from '@contexts/pricing/domain/entities/token-logo';
import { retry } from '@shared/utils/retry';
import { StructuredLoggerService } from '@shared/infrastructure/logging/structured-logger.service';
import { TelemetryService } from '@shared/infrastructure/telemetry/telemetry.service';

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
		private readonly telemetry: TelemetryService,
	) {
		this.logger.setContext('PrismaTokenRepository');
	}

	/**
	 * Получить все токены из базы данных
	 *
	 * Метод:
	 * - Загружает токены с related-данными (chain, logo)
	 * - Маппит Prisma-модели в domain-entities
	 * - Пишет telemetry для мониторинга
	 * - Применяет retry для устойчивости
	 */
	async findAll(): Promise<Token[]> {
		const span = this.telemetry.startSpan('token.findAll');
		const startTime = Date.now();

		try {
			return await retry(
				async () => {
					const rows = await this.prisma.token.findMany({
						include: {
							chain: true,
							logo: true,
						},
					});

					this.logger.log('Found tokens', { count: rows.length });
					this.telemetry.recordMetric({
						name: 'tokens_found',
						value: rows.length,
						labels: { operation: 'findAll' },
					});

					return rows.map((row) => this.mapToDomain(row));
				},
				{ retries: 3, initialDelayMs: 100, factor: 2 },
			);
		} finally {
			const duration = Date.now() - startTime;
			this.telemetry.recordSpan(span, 'token.findAll', duration, true);
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
		const span = this.telemetry.startSpan('token.save');
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

						this.logger.log('Token saved', { tokenId: token.id, currentPrice: token.currentPrice, lastPriceUpdateDateTime: token.lastPriceUpdateDateTime });
				this.telemetry.recordMetric({
					name: 'token_saved',
					value: 1,
					labels: { operation: 'save', tokenId: token.id },
				});
				},
				{ retries: 3, initialDelayMs: 100, factor: 2 },
			);
		} finally {
			const duration = Date.now() - startTime;
			this.telemetry.recordSpan(span, 'token.save', duration, true);
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
