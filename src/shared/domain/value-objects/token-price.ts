import { z } from 'zod';

/**
 * DOMAIN LAYER — Value Object
 *
 * TokenPrice представляет денежное значение для крипто-токенов.
 * Value Object — это неизменяемый объект, описывающий понятие домена,
 * определяемый значением, а не идентичностью.
 *
 * Ключевые принципы:
 * - Иммутабельность: после создания значение не меняется
 * - Самовалидируемость: содержит всю логику валидации
 * - Равенство по значению, а не по ссылке
 * - Инкапсулирует бизнес-правила финансовых вычислений
 *
 * Пример:
 * ```typescript
 * const price1 = TokenPrice.create(1000);
 * const price2 = TokenPrice.create(500);
 * const total = price1.add(price2); // Новый TokenPrice(1500)
 * ```
 */

// Zod-схема для валидации цен токенов
const TokenPriceSchema = z.number()
  .positive('Token price must be positive')
  .max(Number.MAX_SAFE_INTEGER, 'Token price exceeds safe integer limit')
  .refine(
    (val) => Number.isInteger(val) || val.toString().split('.')[1]?.length <= 8,
    'Too many decimal places for token price precision'
  );

export class TokenPrice {
  /**
   * Закрытый конструктор гарантирует иммутабельность
   * Создание возможно только через фабричный метод
   */
  private constructor(private readonly value: number) {}

  /**
   * Фабричный метод создания TokenPrice
   * Валидирует вход и бросает ошибку при недопустимом значении
   *
   * @param value — значение цены
   * @returns Новый экземпляр TokenPrice
   * @throws Error — если валидация не пройдена
   */
  static create(value: number): TokenPrice {
    const validated = TokenPriceSchema.parse(value);
    return new TokenPrice(validated);
  }

  /**
   * Получить числовое значение
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Строковое представление
   */
  toString(): string {
    return this.value.toString();
  }

  /**
   * Безопасное сложение двух цен
   * Возвращает новый экземпляр (иммутабельность)
   */
  add(other: TokenPrice): TokenPrice {
    return TokenPrice.create(this.value + other.value);
  }

  /**
   * Безопасное вычитание цен
   * Возвращает новый экземпляр (иммутабельность)
   */
  subtract(other: TokenPrice): TokenPrice {
    return TokenPrice.create(this.value - other.value);
  }

  /**
   * Умножение на коэффициент
   * Возвращает новый экземпляр (иммутабельность)
   */
  multiply(factor: number): TokenPrice {
    return TokenPrice.create(this.value * factor);
  }

  /**
   * Равенство Value Object по значению
   */
  equals(other: TokenPrice): boolean {
    return this.value === other.value;
  }
}
