import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function setupTestDatabase() {
  try {
    // Применяем миграции
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
    // Очищаем тестовые данные
    await prisma.token.deleteMany({
      where: {
        chainId: 'test-chain-id',
      },
    });

    await prisma.chain.deleteMany({
      where: {
        id: 'test-chain-id',
      },
    });

    console.log('Test database cleanup completed');
  } catch (error) {
    console.error('Error cleaning up test database:', error);
  } finally {
    await prisma.$disconnect();
  }
}
