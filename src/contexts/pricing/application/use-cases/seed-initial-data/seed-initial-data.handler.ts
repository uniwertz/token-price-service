import { Inject, Injectable } from "@nestjs/common";

import { StructuredLoggerService } from "@shared/infrastructure/logging/structured-logger.service";

import {
  INITIAL_DATA_REPOSITORY_PORT,
  InitialDataRepositoryPort,
} from "@contexts/pricing/domain/repositories/initial-data-repository.port";
import { SeedInitialDataCommand } from "./seed-initial-data.command";

@Injectable()
export class SeedInitialDataHandler {
  constructor(
    @Inject(INITIAL_DATA_REPOSITORY_PORT)
    private readonly initialDataRepository: InitialDataRepositoryPort,
    private readonly logger: StructuredLoggerService
  ) {
    this.logger.setContext("SeedInitialDataHandler");
  }

  async execute(cmd: SeedInitialDataCommand): Promise<void> {
    try {
      this.logger.log("Starting initial data seeding", { author: cmd.author });

      await this.initialDataRepository.seed(cmd.author);

      this.logger.log("Initial data seeding completed");
    } catch (error) {
      this.logger.error("Failed to seed initial data", (error as Error).stack, {
        author: cmd.author,
      });
      throw error;
    }
  }
}
