import { Injectable } from "@nestjs/common";

import { StructuredLoggerService } from "@shared/infrastructure/logging/structured-logger.service";
import { PrismaService } from "@shared/infrastructure/prisma/prisma.service";

import { InitialDataRepositoryPort } from "@contexts/pricing/domain/repositories/initial-data-repository.port";

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
    const tokenCount = await this.prisma.token.count();
    if (tokenCount > 0) {
      this.logger.log("Database already seeded, skipping...", { tokenCount });
      return;
    }

    this.logger.log("Seeding initial data...");

    // Create chains first
    const ethChain = await this.prisma.chain.create({
      data: {
        deploymentId: 1,
        name: "Ethereum",
        isEnabled: true,
      },
    });

    const btcChain = await this.prisma.chain.create({
      data: {
        deploymentId: 2,
        name: "Bitcoin",
        isEnabled: true,
      },
    });

    const solChain = await this.prisma.chain.create({
      data: {
        deploymentId: 3,
        name: "Solana",
        isEnabled: true,
      },
    });

    // Create tokens with logos
    const ethToken = await this.prisma.token.create({
      data: {
        contractAddress: Buffer.from([
          0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09,
        ]),
        symbol: "ETH",
        displayName: "Ethereum",
        decimalPlaces: 18,
        isNativeToken: true,
        chainId: ethChain.id,
        isSystemProtected: true,
        lastModifiedBy: author,
        displayPriority: 1,
        currentPrice: 300000,
        lastPriceUpdateDateTime: new Date(),
      },
    });

    await this.prisma.tokenLogo.create({
      data: {
        tokenId: ethToken.id,
        largeImagePath: "/images/eth_large.png",
        mediumImagePath: "/images/eth_medium.png",
        thumbnailPath: "/images/eth_thumb.png",
      },
    });

    const btcToken = await this.prisma.token.create({
      data: {
        contractAddress: Buffer.from([
          0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19,
        ]),
        symbol: "BTC",
        displayName: "Bitcoin",
        decimalPlaces: 8,
        isNativeToken: true,
        chainId: btcChain.id,
        isSystemProtected: true,
        lastModifiedBy: author,
        displayPriority: 2,
        currentPrice: 4500000,
        lastPriceUpdateDateTime: new Date(),
      },
    });

    await this.prisma.tokenLogo.create({
      data: {
        tokenId: btcToken.id,
        largeImagePath: "/images/btc_large.png",
        mediumImagePath: "/images/btc_medium.png",
        thumbnailPath: "/images/btc_thumb.png",
      },
    });

    const solToken = await this.prisma.token.create({
      data: {
        contractAddress: Buffer.from([
          0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29,
        ]),
        symbol: "SOL",
        displayName: "Solana",
        decimalPlaces: 9,
        isNativeToken: true,
        chainId: solChain.id,
        isSystemProtected: true,
        lastModifiedBy: author,
        displayPriority: 3,
        currentPrice: 15000,
        lastPriceUpdateDateTime: new Date(),
      },
    });

    await this.prisma.tokenLogo.create({
      data: {
        tokenId: solToken.id,
        largeImagePath: "/images/sol_large.png",
        mediumImagePath: "/images/sol_medium.png",
        thumbnailPath: "/images/sol_thumb.png",
      },
    });

    this.logger.log("Initial data seeded successfully", {
      chains: 3,
      tokens: 3,
      logos: 3,
    });
  }
}
