import { Token } from "../entities/token";

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
 * // Offset-based pagination для API
 * const page = await repo.findPage(1, 50);
 *
 * // Потоковая обработка для внутренних операций
 * await repo.processAll(async (token) => { ... });
 * ```
 */

export interface TokenPage {
  items: Token[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TokenRepository {
  /**
   * Получить страницу токенов (offset-based pagination для REST API)
   *
   * @param page - номер страницы (1-based)
   * @param limit - количество токенов на странице
   * @returns страница токенов с метаданными пагинации
   */
  findPage(page: number, limit: number): Promise<TokenPage>;

  /**
   * Обработать все токены потоком (для внутренних операций)
   * Использует cursor для эффективного обхода больших объёмов данных.
   *
   * @param callback - функция обработки батча токенов
   * @param batchSize - размер батча (default: 100)
   */
  processAll(
    callback: (tokens: Token[]) => Promise<void>,
    batchSize?: number
  ): Promise<void>;

  /**
   * Сохранить (обновить) токен
   */
  save(token: Token): Promise<void>;

  /**
   * Batch-сохранение токенов (для производительности)
   */
  saveBatch(tokens: Token[]): Promise<void>;

  /**
   * Получить метку времени последнего обновления цены среди всех токенов
   */
  getLastUpdateTimestamp(): Promise<Date | null>;

  /**
   * Получить количество доступных сетей (chains) для токенов
   */
  getDistinctChainCount(): Promise<number>;
}

/** DI-токен для внедрения реализации TokenRepository */
export const TOKEN_REPOSITORY = Symbol("TOKEN_REPOSITORY");
