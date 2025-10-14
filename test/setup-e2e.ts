import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function createTablesManually() {
  console.log('Creating tables manually...');

  // Создаем таблицу chains
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "chains" (
      "id" TEXT NOT NULL,
      "deployment_id" INTEGER NOT NULL,
      "name" TEXT NOT NULL,
      "is_enabled" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "chains_pkey" PRIMARY KEY ("id")
    );
  `;

  // Создаем таблицу tokens
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "tokens" (
      "id" TEXT NOT NULL,
      "contract_address" BYTEA NOT NULL,
      "symbol" TEXT,
      "display_name" TEXT,
      "decimal_places" INTEGER NOT NULL DEFAULT 0,
      "is_native_token" BOOLEAN NOT NULL DEFAULT false,
      "chain_id" TEXT NOT NULL,
      "is_system_protected" BOOLEAN NOT NULL DEFAULT false,
      "last_modified_by" TEXT,
      "display_priority" INTEGER NOT NULL DEFAULT 0,
      "current_price" DECIMAL(28,0) NOT NULL DEFAULT 0,
      "last_price_update_datetime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
    );
  `;

  // Создаем таблицу token_logos
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "token_logos" (
      "id" TEXT NOT NULL,
      "token_id" TEXT,
      "large_image_path" TEXT NOT NULL,
      "medium_image_path" TEXT NOT NULL,
      "thumbnail_path" TEXT NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "token_logos_pkey" PRIMARY KEY ("id")
    );
  `;

  // Создаем индексы
  await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "chains_deployment_id_key" ON "chains"("deployment_id");`;
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "chains_is_enabled_idx" ON "chains"("is_enabled");`;
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "tokens_chain_id_idx" ON "tokens"("chain_id");`;
  await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "tokens_symbol_idx" ON "tokens"("symbol");`;

  // Создаем внешние ключи
  await prisma.$executeRaw`
    ALTER TABLE "tokens"
    ADD CONSTRAINT IF NOT EXISTS "tokens_chain_id_fkey"
    FOREIGN KEY ("chain_id") REFERENCES "chains"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  `;

  await prisma.$executeRaw`
    ALTER TABLE "token_logos"
    ADD CONSTRAINT IF NOT EXISTS "token_logos_token_id_fkey"
    FOREIGN KEY ("token_id") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  `;

  console.log('Tables created successfully');
}

export async function setupTestDatabase() {
  try {
    // Применяем миграции Prisma
    console.log('Applying Prisma migrations...');
    try {
      execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
      });
    } catch (migrationError) {
      console.log('Migration command failed, trying to create tables manually...');
      // Если миграции не работают, создаем таблицы вручную
      await createTablesManually();
    }

    // Создаем расширение UUID если нужно
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;

    // Создаем тестовые данные
    const testChain = await prisma.chain.upsert({
      where: { deploymentId: 1 },
      update: {},
      create: {
        id: 'test-chain-id',
        deploymentId: 1,
        name: 'Test Chain',
        isEnabled: true,
      },
    });

    // Создаем тестовые токены
    const testTokens = [
      {
        id: '1ac998da-3c8d-4687-9d26-63f29698ea87',
        contractAddress: Buffer.from('0x1234567890abcdef', 'hex'),
        symbol: 'TEST1',
        displayName: 'Test Token 1',
        decimalPlaces: 18,
        isNativeToken: false,
        chainId: testChain.id,
        isSystemProtected: false,
        currentPrice: 50000,
        lastPriceUpdateDateTime: new Date(),
      },
      {
        id: '3477a5df-9840-428b-9932-18943baf95d0',
        contractAddress: Buffer.from('0xabcdef1234567890', 'hex'),
        symbol: 'TEST2',
        displayName: 'Test Token 2',
        decimalPlaces: 18,
        isNativeToken: false,
        chainId: testChain.id,
        isSystemProtected: false,
        currentPrice: 75000,
        lastPriceUpdateDateTime: new Date(),
      },
      {
        id: '0fb03ae1-3731-4cd3-89ac-d51b53168d19',
        contractAddress: Buffer.from('0x9876543210fedcba', 'hex'),
        symbol: 'TEST3',
        displayName: 'Test Token 3',
        decimalPlaces: 18,
        isNativeToken: false,
        chainId: testChain.id,
        isSystemProtected: false,
        currentPrice: 25000,
        lastPriceUpdateDateTime: new Date(),
      },
    ];

    for (const token of testTokens) {
      await prisma.token.upsert({
        where: { id: token.id },
        update: token,
        create: token,
      });
    }

    console.log('Test database setup completed');
  } catch (error) {
    console.error('Error setting up test database:', error);
    throw error;
  }
}

export async function cleanupTestDatabase() {
  try {
    // Очищаем тестовые данные только если таблицы существуют
    try {
      await prisma.token.deleteMany({
        where: {
          chainId: 'test-chain-id',
        },
      });
    } catch (error) {
      console.log('Tokens table does not exist, skipping cleanup');
    }

    try {
      await prisma.chain.deleteMany({
        where: {
          id: 'test-chain-id',
        },
      });
    } catch (error) {
      console.log('Chains table does not exist, skipping cleanup');
    }

    console.log('Test database cleanup completed');
  } catch (error) {
    console.error('Error cleaning up test database:', error);
  } finally {
    await prisma.$disconnect();
  }
}
