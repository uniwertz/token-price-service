export interface ExternalPriceServicePort {
  getPriceForToken(token: {
    id: string;
    symbol: string | null;
  }): Promise<number>;
}

export const EXTERNAL_PRICE_SERVICE_PORT = Symbol(
  "EXTERNAL_PRICE_SERVICE_PORT"
);
