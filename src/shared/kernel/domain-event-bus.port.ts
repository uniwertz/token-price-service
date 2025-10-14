import { DomainEvent } from "./domain-event";

/**
 * SHARED KERNEL — Domain Event Bus Port
 *
 * DomainEventBus определяет контракт публикации доменных событий.
 * Это «порт» в Ports & Adapters, позволяющий домену публиковать события,
 * не зная деталей реализации.
 *
 * Ключевые принципы:
 * - Определяется в shared kernel (без зависимостей от инфраструктуры)
 * - Описывает бизнес-потребность публиковать события
 * - Реализуется инфраструктурными адаптерами (Kafka)
 * - Обеспечивает Dependency Inversion
 * - Поддерживает публикацию через Kafka
 *
 * Domain определяет ЧТО публиковать, infrastructure — КАК публиковать.
 */
export interface DomainEventBus {
  /**
   * Публикация доменных событий во внешние системы
   *
   * Задачи метода:
   * - Сериализация и маршрутизация
   * - Retry и обработка ошибок
   * - Интеграция с message queue
   * - Фильтрация и трансформация событий
   */
  publish(events: DomainEvent[]): Promise<void>;
}

/** DI-токен для внедрения реализации DomainEventBus */
export const DOMAIN_EVENT_BUS = Symbol("DOMAIN_EVENT_BUS");
