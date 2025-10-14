/**
 * SHARED KERNEL — Domain Event Interface
 *
 * DomainEvent — событие домена, описывающее значимый факт, уже произошедший в системе.
 * Используется для развязки компонентов и построения event-driven архитектуры.
 *
 * Ключевые принципы:
 * - Описывает прошедшие события (past tense)
 * - Иммутабелен (после создания не меняется)
 * - Содержит всю необходимую информацию о факте
 * - Применим для интеграции между bounded contexts
 * - Поддерживает eventual consistency и loose coupling
 *
 * Публикуется агрегатами и потребляется:
 * - Другими агрегатами (для согласованности)
 * - Application-сервисами (для побочных эффектов)
 * - Infrastructure-сервисами (для интеграции с внешним миром)
 *
 * Пример:
 * ```typescript
 * const event: DomainEvent = {
 *   name: 'PriceUpdated',
 *   payload: { tokenId: '123', oldPrice: 100, newPrice: 150 },
 *   occurredAt: new Date()
 * };
 * ```
 */
export interface DomainEvent {
  /** Имя события (напр., 'PriceUpdated', 'TokenCreated') */
  name: string;
  /** Данные события — информация о том, что произошло */
  payload: unknown;
  /** Когда событие произошло (важно для порядка и аудита) */
  occurredAt: Date;
}
