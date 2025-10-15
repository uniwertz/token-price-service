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
   * Публикация доменных событий в Kafka (batch)
   *
   * Метод:
   * - Фильтрует события по типу (PriceUpdated)
   * - Собирает все события в batch
   * - Маппит payload доменного события в формат Kafka-сообщения
   * - Отправляет все сообщения одним запросом (batch)
   * - Применяет retry для устойчивости
   *
   * Для 100 токенов: 1 запрос вместо 100
   */
  async publish(events: DomainEvent[]): Promise<void> {
    // Собираем все PriceUpdated события в batch
    const priceUpdateMessages = events
      .filter((e) => e.name === "PriceUpdated")
      .map((e) => {
        const payload = e.payload as {
          tokenId: string;
          symbol: string | null;
          oldPrice: number;
          newPrice: number;
        };
        return {
          tokenId: payload.tokenId,
          symbol: payload.symbol ?? "UNKNOWN",
          oldPrice: payload.oldPrice,
          newPrice: payload.newPrice,
          timestamp: e.occurredAt,
        };
      });

    if (priceUpdateMessages.length === 0) return;

    // Отправляем batch в Kafka с retry
    await retry(
      () => this.kafka.sendPriceUpdateBatch(priceUpdateMessages),
      { retries: 3, initialDelayMs: 200, factor: 2 }
    );
  }
}
