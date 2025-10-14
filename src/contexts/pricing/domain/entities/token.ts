import { DomainEvent } from "@shared/kernel/domain-event";
import { Chain } from "./chain";
import { TokenLogo } from "./token-logo";
import { TokenPrice } from "@shared/domain/value-objects/token-price";

/**
 * DOMAIN LAYER — ядро бизнес-домена
 *
 * Token представляет криптовалютный токен в нашем домене.
 * Это центральный Aggregate Root, инкапсулирующий бизнес-правила
 * и инварианты, связанные с управлением токеном и его ценой.
 *
 * Ключевые принципы:
 * - Инкапсулирует бизнес-логику и инварианты
 * - Невозможна внешняя мутация (состояние меняют только методы сущности)
 * - Публикует Domain Events при изменении состояния
 * - Использует Value Object для сложных данных (TokenPrice)
 *
 * Пример:
 * ```typescript
 * const token = Token.restore({...});
 * token.updatePrice(1500, new Date());
 * const events = token.pullEvents(); // Получить доменные события
 * ```
 */
export class Token {
  /** Коллекция доменных событий, произошедших за жизненный цикл сущности */
  private events: DomainEvent[] = [];

  /**
   * Закрытый конструктор гарантирует создание через фабричные методы,
   * чтобы обеспечить соблюдение бизнес-правил и инвариантов
   */
  private constructor(
    /** Уникальный идентификатор токена */
    public readonly id: string,
    /** Адрес смарт-контракта (для ERC20) или специальное значение для native-токенов */
    public readonly contractAddress: Buffer,
    /** Символ токена (например, "ETH", "BTC") */
    public readonly symbol: string | null,
    /** Человеко-читаемое имя токена */
    public readonly displayName: string | null,
    /** Количество знаков после запятой (precision) */
    public readonly decimalPlaces: number,
    /** Является ли токен нативным для сети (ETH, BTC и т.п.) */
    public readonly isNativeToken: boolean,
    /** Идентификатор сети (Chain), к которой относится токен */
    public readonly chainId: string,
    /** Защищён ли токен от изменений/удаления системно */
    public readonly isSystemProtected: boolean,
    /** Пользователь или система, кто последним изменял токен */
    public readonly lastModifiedBy: string | null,
    /** Приоритет отображения для UI */
    public readonly displayPriority: number,
    /** Текущая цена как Value Object (инкапсулирует логику цены) */
    private _currentPrice: TokenPrice,
    /** Временная метка последнего обновления цены */
    private _lastPriceUpdateDateTime: Date,
    /** Информация о блокчейне (Chain) */
    public readonly chain: Chain,
    /** Информация о логотипе токена (может быть null) */
    public readonly logo: TokenLogo | null
  ) {}

  /**
   * Фабричный метод для восстановления Token из слоя хранения
   *
   * Используется при загрузке токенов из базы данных.
   * Валидирует данные и создаёт корректно инициализированный экземпляр Token.
   *
   * @param params — все необходимые данные для реконструкции токена
   * @returns Экземпляр Token с предоставленными данными
   */
  static restore(params: {
    id: string;
    contractAddress: Buffer;
    symbol: string | null;
    displayName: string | null;
    decimalPlaces: number;
    isNativeToken: boolean;
    chainId: string;
    isSystemProtected: boolean;
    lastModifiedBy: string | null;
    displayPriority: number;
    currentPrice: number;
    lastPriceUpdateDateTime: Date;
    chain: Chain;
    logo: TokenLogo | null;
  }) {
    return new Token(
      params.id,
      params.contractAddress,
      params.symbol,
      params.displayName,
      params.decimalPlaces,
      params.isNativeToken,
      params.chainId,
      params.isSystemProtected,
      params.lastModifiedBy,
      params.displayPriority,
      TokenPrice.create(params.currentPrice),
      params.lastPriceUpdateDateTime,
      params.chain,
      params.logo
    );
  }

  /**
   * Геттер текущей цены
   * Возвращает числовое значение из Value Object TokenPrice
   */
  get currentPrice() {
    return this._currentPrice.getValue();
  }

  /**
   * Геттер времени последнего обновления цены
   */
  get lastPriceUpdateDateTime() {
    return this._lastPriceUpdateDateTime;
  }

  /**
   * Ключевой бизнес-метод: обновление цены токена
   *
   * Логика:
   * - Валидирует новую цену через Value Object TokenPrice
   * - Обновляет состояние только если цена изменилась (оптимизация)
   * - Фиксирует время обновления
   * - Публикует Domain Event для последующей обработки
   *
   * @param newPrice — новая цена
   * @param occurredAt — момент времени, когда произошло обновление
   */
  updatePrice(newPrice: number, occurredAt: Date) {
    const newTokenPrice = TokenPrice.create(newPrice);
    if (newTokenPrice.equals(this._currentPrice)) return;

    const oldPrice = this._currentPrice.getValue();
    this._currentPrice = newTokenPrice;
    this._lastPriceUpdateDateTime = occurredAt;
    this.events.push({
      name: "PriceUpdated",
      payload: { tokenId: this.id, symbol: this.symbol, oldPrice, newPrice },
      occurredAt,
    });
  }

  /**
   * Паттерн Domain Events: выдача событий на внешнюю обработку
   *
   * Метод:
   * - Возвращает накопленные доменные события
   * - Очищает внутреннюю коллекцию событий
   * - Позволяет внешним обработчикам (например, Kafka) их публиковать
   *
   * @returns Массив доменных событий
   */
  pullEvents(): DomainEvent[] {
    const e = [...this.events];
    this.events = [];
    return e;
  }
}
