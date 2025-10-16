import { Inject, Injectable } from "@nestjs/common";

import {
  TOKEN_REPOSITORY,
  TokenRepository,
} from "@contexts/pricing/domain/repositories/token-repository.port";

@Injectable()
export class GetStatusQuery {
  constructor(
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepository: TokenRepository
  ) {}

  async execute() {
    const [page, lastUpdate, chainsCount] = await Promise.all([
      this.tokenRepository.findPage(1, 1),
      this.tokenRepository.getLastUpdateTimestamp(),
      this.tokenRepository.getDistinctChainCount(),
    ]);
    return {
      status: "ready",
      tokensCount: page.total,
      chainsCount,
      lastUpdate: lastUpdate ? lastUpdate.toISOString() : null,
      timestamp: new Date().toISOString(),
    };
  }
}
