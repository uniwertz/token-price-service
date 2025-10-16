import { Injectable } from "@nestjs/common";

import { StructuredLoggerService } from "@shared/infrastructure/logging/structured-logger.service";
import { PrismaService } from "@shared/infrastructure/prisma/prisma.service";

import { InitialDataRepositoryPort } from "@contexts/pricing/domain/repositories/initial-data-repository.port";
import { chainsSeedData, tokensSeedData } from "../seed-data";

@Injectable()
export class PrismaInitialDataRepository implements InitialDataRepositoryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: StructuredLoggerService
  ) {
    this.logger.setContext("PrismaInitialDataRepository");
  }

  async seed(author: string): Promise<void> {
    // Check if there are already tokens in the database
    const existingTokens = await this.prisma.token.count();
    if (existingTokens > 0) {
      this.logger.log("Database already seeded, skipping...", {
        tokenCount: existingTokens,
      });
      return;
    }

    const startTime = Date.now();
    this.logger.log("Starting seed: loading 1311 chains and 24k+ tokens...");

    // Step 1: Seed chains (1311 chains from CoinGecko)
    this.logger.log("Seeding chains...");
    const chainMap = new Map<string, string>(); // id -> UUID
    let chainCount = 0;

    for (const chainData of chainsSeedData) {
      if (!chainData.chain_identifier) continue; // Пропускаем без deploymentId

      const chain = await this.prisma.chain.create({
        data: {
          deploymentId: chainData.chain_identifier,
          name: chainData.name,
          isEnabled: true,
        },
      });
      chainMap.set(chainData.id, chain.id);
      chainCount++;

      if (chainCount % 100 === 0) {
        this.logger.log(`   Chains: ${chainCount}/1311`);
      }
    }

    this.logger.log(`Chains seeded: ${chainCount}`);

    // Step 2: Seed tokens (24k+ tokens from CoinGecko)
    this.logger.log("Seeding tokens...");
    let tokenCount = 0;
    let skippedCount = 0;
    const BATCH_SIZE = 500;
    const tokenEntries = Object.entries(tokensSeedData);

    for (let i = 0; i < tokenEntries.length; i += BATCH_SIZE) {
      const batch = tokenEntries.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async ([key, tokenData]) => {
          try {
            // Парсим key: "SYMBOL" или "SYMBOL:chain:address"
            const parts = key.split(":");
            const symbol = parts[0];
            const chainId = parts[1]; // может быть undefined
            const contractAddress = parts[2]; // может быть undefined

            // Находим chain UUID, если есть chainId
            const firstChainId = chainMap.values().next().value as string | undefined;
            let dbChainId: string = firstChainId ?? (() => {
              throw new Error("No chains seeded");
            })();
            if (chainId && chainMap.has(chainId)) {
              dbChainId = chainMap.get(chainId)!;
            }

            // Создаём токен
            await this.prisma.token.create({
              data: {
                contractAddress: contractAddress
                  ? Buffer.from(contractAddress.slice(0, 42).padEnd(42, "0"))
                  : Buffer.from(symbol.padEnd(42, "0")),
                symbol: symbol.slice(0, 10),
                displayName: tokenData.name.slice(0, 255),
                decimalPlaces: 18, // default
                isNativeToken: !contractAddress,
                chainId: dbChainId,
                isSystemProtected: false,
                lastModifiedBy: author,
                displayPriority: 0,
                currentPrice: "1", // Минимальная валидная цена (будет обновлена внешним кроном)
                lastPriceUpdateDateTime: new Date(),
              },
            });
            tokenCount++;
          } catch (error) {
            skippedCount++;
          }
        })
      );

      if ((i + BATCH_SIZE) % 5000 === 0) {
        this.logger.log(
          `   Tokens: ${tokenCount}/${tokenEntries.length} (${skippedCount} skipped)`
        );
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log(`Seed completed in ${Math.round(duration / 1000)}s`, {
      chains: chainCount,
      tokens: tokenCount,
      skipped: skippedCount,
    });
  }
}
