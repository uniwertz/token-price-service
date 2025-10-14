import { Injectable, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class MockPriceService implements OnModuleDestroy {
  private readonly timeouts = new Set<NodeJS.Timeout>();

  async getRandomPriceForToken(token: { id: string; symbol: string | null }): Promise<number> {
    // Simulate API call delay with proper cleanup
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.timeouts.delete(timeout);
        resolve();
      }, this.getRandomInt(50, 200));

      this.timeouts.add(timeout);
    });

    const basePrice = this.getRandomInt(1, 100000);
    const randomFactor = this.getRandomInt(1, 10); // keep integer for numeric(28,0)

    return basePrice * randomFactor;
  }

  // Метод для очистки всех активных таймеров (для graceful shutdown)
  cleanup(): void {
    this.timeouts.forEach(timeout => clearTimeout(timeout));
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
