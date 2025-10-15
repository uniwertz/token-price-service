import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { PrismaInitialDataRepository } from "../src/contexts/pricing/infrastructure/persistence/prisma/initial-data.prisma-repository";
import { PrismaService } from "../src/shared/infrastructure/prisma/prisma.service";
import { StructuredLoggerService } from "../src/shared/infrastructure/logging/structured-logger.service";

const prisma = new PrismaClient();

export async function setupTestDatabase() {
  try {
    // Применяем миграции Prisma (единственный источник истины для схемы)
    console.log("Applying Prisma migrations...");
    execSync("npx prisma migrate deploy", {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });

    // Используем seeder для тестовых данных
    const prismaService = new PrismaService();
    const logger = new StructuredLoggerService();
    const seeder = new PrismaInitialDataRepository(prismaService, logger);

    await seeder.seed("e2e-tests");

    console.log("Test database setup completed");
  } catch (error) {
    console.error("Error setting up test database:", error);
    throw error;
  }
}

export async function cleanupTestDatabase() {
  try {
    // Очищаем все данные (seeder создает Ethereum, Bitcoin, Solana)
    try {
      await prisma.token.deleteMany({});
      await prisma.chain.deleteMany({});
    } catch (error) {
      console.log("Tables do not exist, skipping cleanup");
    }

    console.log("Test database cleanup completed");
  } catch (error) {
    console.error("Error cleaning up test database:", error);
  } finally {
    await prisma.$disconnect();
  }
}
