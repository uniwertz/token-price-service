import { Injectable } from "@nestjs/common";

import { DomainEvent } from "@shared/kernel/domain-event";
import { DomainEventBus } from "@shared/kernel/domain-event-bus.port";
import { retry } from "@shared/utils/retry";

import { KafkaProducerService } from "../../../../../kafka/kafka-producer.service";

/**
 * INFRASTRUCTURE LAYER — Event Bus Adapter
 *
 * KafkaEventBus реализует порт DomainEventBus с использованием Apache Kafka.
 * Адаптер решает технические детали публикации доменных событий во внешние системы
 * через message queue.
 *
 * Ключевые принципы:
 * - Реализация доменного интерфейса конкретной технологией
 * - Технические задачи: сериализация, retry, обработка ошибок
 * - Без бизнес-логики (она в domain)
 * - Надёжность через retry-политику
 * - Маппинг доменных событий в формат сообщений очереди
 *
 * Пример:
 * ```typescript
 * // Domain публикует события
 * await this.eventBus.publish(domainEvents);
 *
 * // Infrastructure отправляет их в Kafka
 * const eventBus = new KafkaEventBus(kafkaProducer);
 * ```
 */
@Injectable()
export class KafkaEventBus implements DomainEventBus {
  /**
   * DI Kafka producer
   * @param kafka — продюсер для отправки сообщений
   */
  constructor(private readonly kafka: KafkaProducerService) {}

  /**
   * Публикация доменных событий в Kafka
   *
   * Метод:
   * - Фильтрует события по типу (PriceUpdated)
   * - Маппит payload доменного события в формат Kafka-сообщения
   * - Применяет retry для устойчивости
   * - Обрабатывает сериализацию и отправку
   */
  async publish(events: DomainEvent[]): Promise<void> {
    for (const e of events) {
      if (e.name === "PriceUpdated") {
        const payload = e.payload as {
          tokenId: string;
          symbol: string | null;
          oldPrice: number;
          newPrice: number;
        };
        await retry(
          () =>
            this.kafka.sendPriceUpdateMessage({
              tokenId: payload.tokenId,
              symbol: payload.symbol ?? "UNKNOWN",
              oldPrice: payload.oldPrice,
              newPrice: payload.newPrice,
              timestamp: e.occurredAt,
            }),
          { retries: 3, initialDelayMs: 200, factor: 2 }
        );
      }
    }
  }
}
