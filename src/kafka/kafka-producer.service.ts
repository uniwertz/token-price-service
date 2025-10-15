import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Kafka, Producer } from "kafkajs";

// Интерфейс для Kafka сообщений
interface TokenPriceUpdateMessage {
  tokenId: string;
  symbol: string;
  oldPrice: number;
  newPrice: number;
  timestamp: Date;
}

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private producer: Producer;
  private readonly topic: string =
    process.env.KAFKA_TOPIC || "token-price-updates";
  private enabled = true;

  constructor() {
    // Empty constructor for dependency injection
  }

  async onModuleInit(): Promise<void> {
    // Позволяем запускаться локально без Kafka
    const envEnabled = (process.env.KAFKA_ENABLED || "").toLowerCase();
    const nodeEnv = (process.env.NODE_ENV || "development").toLowerCase();
    this.enabled = envEnabled === "true" || nodeEnv === "production";

    if (!this.enabled) {
      this.logger.warn(
        "Kafka disabled (KAFKA_ENABLED!=true and NODE_ENV!=production). Skipping connect."
      );
      return;
    }

    try {
      const brokersEnv = process.env.KAFKA_BROKERS || "localhost:9092";
      const clientId = process.env.KAFKA_CLIENT_ID || "token-price-service";
      const brokers = brokersEnv
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean);

      const kafka = new Kafka({ clientId, brokers });
      this.producer = kafka.producer();
      await this.producer.connect();
      this.logger.log(
        `Connected to Kafka [${brokers.join(", ")}], topic=${this.topic}`
      );
    } catch (err) {
      this.enabled = false;
      this.logger.error(
        `Kafka init failed: ${
          (err as Error).message
        }. Continuing without Kafka.`
      );
    }
  }

  async sendPriceUpdateMessage(
    message: TokenPriceUpdateMessage
  ): Promise<void> {
    try {
      if (!this.enabled) {
        // Не логируем каждое пропущенное сообщение (слишком шумно)
        return;
      }
      // Простая валидация
      if (
        !message.tokenId ||
        !message.symbol ||
        message.oldPrice < 0 ||
        message.newPrice < 0
      ) {
        throw new Error("Invalid message format");
      }

      const value = JSON.stringify(message);

      await this.producer.send({
        topic: this.topic,
        messages: [
          {
            key: message.tokenId,
            value,
          },
        ],
      });

      this.logger.log(`Sent message to Kafka: ${value}`);
      return;
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
    }
  }

  /**
   * Batch-отправка сообщений в Kafka (эффективнее для больших объёмов)
   *
   * Для 100 токенов: 1 запрос вместо 100
   */
  async sendPriceUpdateBatch(
    messages: TokenPriceUpdateMessage[]
  ): Promise<void> {
    if (messages.length === 0) return;

    try {
      if (!this.enabled) {
        return;
      }

      // Фильтруем невалидные сообщения
      const validMessages = messages.filter(
        (msg) =>
          msg.tokenId &&
          msg.symbol &&
          msg.oldPrice >= 0 &&
          msg.newPrice >= 0
      );

      if (validMessages.length === 0) {
        this.logger.warn("All messages in batch are invalid");
        return;
      }

      // Формируем batch для Kafka
      const kafkaMessages = validMessages.map((msg) => ({
        key: msg.tokenId,
        value: JSON.stringify(msg),
      }));

      await this.producer.send({
        topic: this.topic,
        messages: kafkaMessages,
      });

      this.logger.log(`Sent ${validMessages.length} messages to Kafka (batch)`);
    } catch (error) {
      this.logger.error(`Error sending batch: ${error.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.producer) {
        await this.producer.disconnect();
      }
      this.logger.log("Disconnected from Kafka");
    } catch (error) {
      this.logger.error("Error disconnecting from Kafka", error.stack);
    }
  }
}
