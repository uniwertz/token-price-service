import * as retryLib from 'retry';

/**
 * SHARED UTILITIES — Retry Configuration
 *
 * RetryOptions задаёт конфигурацию повторных попыток (retry).
 * Нужен для устойчивости (resilience) при временных сбоях.
 */
export interface RetryOptions {
	/** Количество повторов (0 — без повторов, 1 — одна попытка и т.д.) */
	retries: number;
	/** Начальная задержка между повторами (мс) */
	initialDelayMs: number;
	/** Множитель экспоненциальной паузы (по умолчанию 2) */
	factor?: number;
}

/**
 * SHARED UTILITIES — Retry Function
 *
 * Универсальная утилита повторных попыток с exponential backoff.
 * Полезна для production-устойчивости при:
 * - Сетевых вызовах (HTTP, DB)
 * - Запросах к внешним сервисам
 * - Временной недоступности ресурсов
 *
 * Возможности:
 * - Экспоненциальный backoff
 * - Гибкая настройка количества и таймингов
 * - Бросает исходную ошибку после исчерпания попыток
 * - Типобезопасная generic-реализация
 *
 * @param fn — асинхронная функция, которую нужно повторять
 * @param opts — настройки retry
 * @returns Результат выполнения или исключение после всех попыток
 */
export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
	const operation = retryLib.operation({
		retries: opts.retries,
		minTimeout: opts.initialDelayMs,
		factor: opts.factor ?? 2,
	});

	return new Promise((resolve, reject) => {
		operation.attempt(async (currentAttempt) => {
			try {
				const result = await fn();
				resolve(result);
			} catch (error) {
				if (operation.retry(error)) {
					return;
				}
				reject(operation.mainError());
			}
		});
	});
}
