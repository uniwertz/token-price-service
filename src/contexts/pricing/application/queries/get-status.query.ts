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
    const page = await this.tokenRepository.findPage(1, 1);
    const lastUpdate = await this.tokenRepository.getLastUpdateTimestamp();
    return {
      status: "ready",
      tokensCount: page.total,
      lastUpdate: lastUpdate ? lastUpdate.toISOString() : null,
      timestamp: new Date().toISOString(),
    };
  }
}
