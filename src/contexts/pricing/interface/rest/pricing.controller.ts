import { Controller, Get, Post, HttpException, HttpStatus } from '@nestjs/common';
import { TOKEN_REPOSITORY, TokenRepository } from '@contexts/pricing/domain/repositories/token-repository.port';
import { Inject } from '@nestjs/common';
import { UpdateTokenPricesHandler } from '@contexts/pricing/application/use-cases/update-token-prices/update-token-prices.handler';
import { UpdateTokenPricesCommand } from '@contexts/pricing/application/use-cases/update-token-prices/update-token-prices.command';

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
@Controller('pricing')
export class PricingController {
	/**
	 * Конструктор зависимостей
	 * @param tokenRepository — доступ к данным токенов
	 * @param updateTokenPricesHandler — use case обновления цен
	 */
	constructor(
		@Inject(TOKEN_REPOSITORY) private readonly tokenRepository: TokenRepository,
		private readonly updateTokenPricesHandler: UpdateTokenPricesHandler,
	) {}

	/**
	 * Health check для систем мониторинга
	 *
	 * Возвращает:
	 * - статус
	 * - количество токенов
	 * - время последнего обновления
	 * - текущую временную метку
	 */
	@Get('health')
	async getHealth() {
		const tokens = await this.tokenRepository.findAll();
		const lastUpdate = tokens.length > 0
			? Math.max(...tokens.map(t => t.lastPriceUpdateDateTime.getTime()))
			: null;

		return {
			status: 'healthy',
			tokensCount: tokens.length,
			lastUpdateTime: lastUpdate ? new Date(lastUpdate).toISOString() : null,
			timestamp: new Date().toISOString()
		};
	}

	/**
	 * Status endpoint (readiness)
	 *
	 * Аналогично health, но фокус на готовности системы
	 */
	@Get('status')
	async getStatus() {
		const tokens = await this.tokenRepository.findAll();
		const lastUpdate = tokens.length > 0
			? Math.max(...tokens.map(t => t.lastPriceUpdateDateTime.getTime()))
			: null;

		return {
			status: 'ready',
			tokensCount: tokens.length,
			lastUpdateTime: lastUpdate ? new Date(lastUpdate).toISOString() : null,
			timestamp: new Date().toISOString()
		};
	}

	/**
	 * Trigger для внешних планировщиков
	 *
	 * Используется:
	 * - Внешние планировщики (cron, systemd timers)
	 * - Ручные прогоны при тестировании
	 */
	@Post('trigger-update')
	async triggerUpdate() {
		const startTime = Date.now();
		try {
			await this.updateTokenPricesHandler.execute(new UpdateTokenPricesCommand());
			const duration = Date.now() - startTime;

			return {
				status: 'completed',
				message: 'Price update completed successfully',
				timestamp: new Date().toISOString(),
				duration: `${duration}ms`
			};
		} catch (error) {
			throw new HttpException(
				'Failed to trigger price update',
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
