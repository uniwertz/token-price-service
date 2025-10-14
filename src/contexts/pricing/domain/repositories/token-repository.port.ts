import { Token } from '../entities/token';

/**
 * DOMAIN LAYER — Repository Port (интерфейс)
 *
 * TokenRepository определяет контракт для персистентности токенов.
 * Это «порт» в архитектуре Ports & Adapters (Hexagonal).
 *
 * Ключевые принципы:
 * - Определяется в domain-слое (без зависимостей от инфраструктуры)
 * - Описывает бизнес-операции, а не технические детали
 * - Реализуется инфраструктурными адаптерами
 * - Обеспечивает Dependency Inversion (зависимость от абстракций)
 *
 * Domain определяет ЧТО нужно, инфраструктура — КАК это реализовано.
 *
 * Пример:
 * ```typescript
 * // Domain-слой использует интерфейс
 * const tokens = await this.tokenRepository.findAll();
 *
 * // Infrastructure-слой реализует интерфейс
 * class PrismaTokenRepository implements TokenRepository { ... }
 * ```
 */
export interface TokenRepository {
	/**
	 * Получить все токены из репозитория
	 */
	findAll(): Promise<Token[]>;

	/**
	 * Сохранить (обновить) токен
	 */
	save(token: Token): Promise<void>;
}

/** DI-токен для внедрения реализации TokenRepository */
export const TOKEN_REPOSITORY = Symbol('TOKEN_REPOSITORY');
