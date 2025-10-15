import { Injectable } from "@nestjs/common";

import { MockPriceService } from "../../../../../services/mock-price.service";
import { ExternalPriceServicePort } from "@contexts/pricing/domain/repositories/external-price-service.port";

@Injectable()
export class MockPriceFeedAdapter implements ExternalPriceServicePort {
  constructor(private readonly mock: MockPriceService) {}

  async getPriceForToken(token: {
    id: string;
    symbol: string | null;
  }): Promise<number> {
    return this.mock.getRandomPriceForToken(token);
  }
}
