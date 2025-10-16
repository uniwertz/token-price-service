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

const SCALE = 8n; // фиксированный scale для цен
const TEN = 10n;
const SCALE_FACTOR = TEN ** SCALE;

function parseDecimalStringToAmount(value: string): bigint {
  const [intPart, fracPartRaw = ""] = value.split(".");
  const fracPart = fracPartRaw.padEnd(Number(SCALE), "0").slice(0, Number(SCALE));
  const digits = intPart + fracPart;
  // Удаляем ведущие нули, но оставляем хотя бы один
  const normalizedDigits = digits.replace(/^0+(?=\d)/, "");
  return BigInt(normalizedDigits);
}

function formatAmountToDecimalString(amount: bigint): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const intPart = abs / SCALE_FACTOR;
  let fracPart = (abs % SCALE_FACTOR).toString().padStart(Number(SCALE), "0");
  // Убираем хвостовые нули
  fracPart = fracPart.replace(/0+$/, "");
  const base = fracPart.length > 0 ? `${intPart.toString()}.${fracPart}` : intPart.toString();
  return negative ? `-${base}` : base;
}

function parseNumberToAmount(n: number): bigint {
  if (!Number.isFinite(n)) throw new Error("Invalid number");
  if (n <= 0) throw new Error("Token price must be positive");
  if (n > Number.MAX_SAFE_INTEGER)
    throw new Error("Token price exceeds safe integer limit");
  const str = n.toString();
  // Ограничим до SCALE знаков после запятой, без научной нотации
  const [i, fRaw = ""] = str.split(".");
  if (fRaw.length > Number(SCALE))
    throw new Error("Too many decimal places for token price precision");
  const f = fRaw.slice(0, Number(SCALE));
  const normalized = f.length > 0 ? `${i}.${f}` : i;
  TokenPriceStringSchema.parse(normalized); // валидация формата и >0
  return parseDecimalStringToAmount(normalized);
}

export class TokenPrice {
  /**
   * Закрытый конструктор гарантирует иммутабельность
   * Создание возможно только через фабричный метод
   */
  private constructor(private readonly amount: bigint) {}

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
      const amount = parseNumberToAmount(value);
      return new TokenPrice(amount);
    }
    const validated = TokenPriceStringSchema.parse(value);
    const amount = parseDecimalStringToAmount(validated);
    return new TokenPrice(amount);
  }

  /** Создать из строкового amount (целое число в масштабе SCALE) */
  static fromAmountString(amountStr: string): TokenPrice {
    const amount = BigInt(amountStr);
    if (amount <= 0n) throw new Error("Token price must be positive");
    return new TokenPrice(amount);
  }

  /**
   * Получить числовое значение
   */
  getValue(): number {
    // Совместимость с существующими тестами: возвращаем number (может потерять точность для очень больших значений)
    return parseFloat(formatAmountToDecimalString(this.amount));
  }

  /** Получить внутренний amount (целое число в масштабе SCALE) */
  getAmount(): bigint {
    return this.amount;
  }

  /** Получить amount как строку */
  getAmountString(): string {
    return this.amount.toString();
  }

  /**
   * Строковое представление
   */
  toString(): string {
    return formatAmountToDecimalString(this.amount);
  }

  /**
   * Безопасное сложение двух цен
   * Возвращает новый экземпляр (иммутабельность)
   */
  add(other: TokenPrice): TokenPrice {
    const result = this.amount + other.amount;
    if (result <= 0n) throw new Error("Token price must be positive");
    return new TokenPrice(result);
  }

  /**
   * Безопасное вычитание цен
   * Возвращает новый экземпляр (иммутабельность)
   */
  subtract(other: TokenPrice): TokenPrice {
    const result = this.amount - other.amount;
    if (result <= 0n) throw new Error("Token price must be positive");
    return new TokenPrice(result);
  }

  /**
   * Умножение на коэффициент
   * Возвращает новый экземпляр (иммутабельность)
   */
  multiply(factor: number): TokenPrice {
    if (!Number.isFinite(factor)) throw new Error("Invalid factor");
    if (factor <= 0) throw new Error("Token price must be positive");
    // Конвертируем factor в fixed-point с тем же SCALE
    const factorStr = factor.toString();
    const [fi, ffRaw = ""] = factorStr.split(".");
    const ff = ffRaw.padEnd(Number(SCALE), "0").slice(0, Number(SCALE));
    const factorScaled = BigInt((fi + ff).replace(/^0+(?=\d)/, ""));
    // amount * factorScaled / SCALE_FACTOR с округлением Half Up
    const prod = this.amount * factorScaled;
    const q = prod / SCALE_FACTOR;
    const r = prod % SCALE_FACTOR;
    const half = SCALE_FACTOR / 2n;
    const rounded = r >= half ? q + 1n : q;
    if (rounded <= 0n) throw new Error("Token price must be positive");
    return new TokenPrice(rounded);
  }

  /**
   * Равенство Value Object по значению
   */
  equals(other: TokenPrice): boolean {
    return this.amount === other.amount;
  }
}
