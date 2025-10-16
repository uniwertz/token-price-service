import { z } from "zod";

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

// Валидация строкового представления (положительное число, до 8 знаков после запятой)
const TokenPriceStringSchema = z
  .string()
  .regex(/^\d+(?:\.\d{1,8})?$/, "Invalid decimal string (max 8 fraction digits)")
  .refine((s) => parseFloat(s) > 0, "Token price must be positive");

export class TokenPrice {
  /**
   * Закрытый конструктор гарантирует иммутабельность
   * Создание возможно только через фабричный метод
   */
  private constructor(private readonly value: string) {}

  /**
   * Фабричный метод создания TokenPrice
   * Валидирует вход и бросает ошибку при недопустимом значении
   *
   * @param value — значение цены
   * @returns Новый экземпляр TokenPrice
   * @throws Error — если валидация не пройдена
   */
  static create(value: string | number): TokenPrice {
    if (typeof value === "number") {
      if (value <= 0) throw new Error("Token price must be positive");
      if (value > Number.MAX_SAFE_INTEGER)
        throw new Error("Token price exceeds safe integer limit");
      const frac = value.toString().split(".")[1]?.length ?? 0;
      if (frac > 8)
        throw new Error("Too many decimal places for token price precision");
      const fixed = Number(value).toFixed(Math.min(frac, 8));
      const normalized = fixed.includes(".")
        ? fixed.replace(/\.0+$/, "").replace(/\.(.*?)(0+)$/, ".$1")
        : fixed; // не трогаем целые числа, сохраняем все нули
      const validated = TokenPriceStringSchema.parse(normalized);
      return new TokenPrice(validated);
    }
    // string input
    const validated = TokenPriceStringSchema.parse(value);
    return new TokenPrice(validated);
  }

  /**
   * Получить числовое значение
   */
  getValue(): number {
    return parseFloat(this.value);
  }

  /**
   * Строковое представление
   */
  toString(): string {
    return this.value;
  }

  /**
   * Безопасное сложение двух цен
   * Возвращает новый экземпляр (иммутабельность)
   */
  add(other: TokenPrice): TokenPrice {
    const a = this.value;
    const b = other.value;
    const sumFixed = (Number(a) + Number(b)).toFixed(8);
    const sum = sumFixed.includes(".")
      ? sumFixed.replace(/\.0+$/, "").replace(/\.(.*?)(0+)$/, ".$1")
      : sumFixed;
    return TokenPrice.create(sum);
  }

  /**
   * Безопасное вычитание цен
   * Возвращает новый экземпляр (иммутабельность)
   */
  subtract(other: TokenPrice): TokenPrice {
    const a = this.value;
    const b = other.value;
    const diffFixed = (Number(a) - Number(b)).toFixed(8);
    const diff = diffFixed.includes(".")
      ? diffFixed.replace(/\.0+$/, "").replace(/\.(.*?)(0+)$/, ".$1")
      : diffFixed;
    // Не допускаем отрицательных значений
    const num = parseFloat(diff);
    if (num <= 0) {
      throw new Error("Token price must be positive");
    }
    return TokenPrice.create(diff);
  }

  /**
   * Умножение на коэффициент
   * Возвращает новый экземпляр (иммутабельность)
   */
  multiply(factor: number): TokenPrice {
    const prodFixed = (Number(this.value) * factor).toFixed(8);
    const prod = prodFixed.includes(".")
      ? prodFixed.replace(/\.0+$/, "").replace(/\.(.*?)(0+)$/, ".$1")
      : prodFixed;
    return TokenPrice.create(prod);
  }

  /**
   * Равенство Value Object по значению
   */
  equals(other: TokenPrice): boolean {
    return this.value === other.value;
  }
}
