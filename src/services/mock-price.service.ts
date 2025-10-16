import { Injectable, OnModuleDestroy } from "@nestjs/common";

@Injectable()
export class MockPriceService implements OnModuleDestroy {
  private readonly timeouts = new Set<NodeJS.Timeout>();
  private readonly tokenBasePrices = new Map<string, number>();

  async getRandomPriceForToken(token: {
    id: string;
    symbol: string | null;
  }): Promise<number> {
    // Simulate API call delay with proper cleanup
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.timeouts.delete(timeout);
        resolve();
      }, this.getRandomInt(50, 200));

      this.timeouts.add(timeout);
    });

    // Получаем или создаём базовую цену для токена
    if (!this.tokenBasePrices.has(token.id)) {
      // Генерируем случайную базовую цену в диапазоне 50-50000
      const basePrice = this.getRandomPriceInRange();
      this.tokenBasePrices.set(token.id, basePrice);
    }

    const basePrice =
      this.tokenBasePrices.get(token.id) ?? this.getRandomPriceInRange();

    // Изменяем цену на ±5%
    const changePercent = (Math.random() * 10 - 5) / 100; // от -5% до +5%
    const priceChange = Math.floor(basePrice * changePercent);
    const newPrice = basePrice + priceChange;

    return Math.max(1, newPrice);
  }

  private getRandomPriceInRange(): number {
    // Случайная цена: 50, 500 или 50000 с небольшой вариацией
    const ranges = [
      { min: 45, max: 55 }, // ~50
      { min: 450, max: 550 }, // ~500
      { min: 45000, max: 55000 }, // ~50000
    ];

    const selectedRange = ranges[Math.floor(Math.random() * ranges.length)];
    return this.getRandomInt(selectedRange.min, selectedRange.max);
  }

  // Метод для очистки всех активных таймеров (для graceful shutdown)
  cleanup(): void {
    this.timeouts.forEach((timeout) => clearTimeout(timeout));
    this.timeouts.clear();
  }

  onModuleDestroy() {
    this.cleanup();
  }

  private getRandomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
