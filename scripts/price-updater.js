#!/usr/bin/env node

const axios = require('axios');

// Конфигурация из переменных окружения
const config = {
  pricingServiceUrl: process.env.PRICING_SERVICE_URL || 'http://localhost:3000',
  updateIntervalSeconds: parseInt(process.env.UPDATE_INTERVAL_SECONDS) || 10,
  maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
  timeoutMs: parseInt(process.env.TIMEOUT_MS) || 30000,
  environment: process.env.NODE_ENV || 'development'
};

// Логирование с временными метками
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    environment: config.environment,
    ...data
  };

  console.log(JSON.stringify(logEntry));
}

// Функция для обновления цен с ретраями
async function updatePrices() {
  const startTime = Date.now();
  let attempt = 0;

  while (attempt < config.maxRetries) {
    try {
      attempt++;
      log('info', 'Triggering price update', {
        attempt,
        maxRetries: config.maxRetries,
        url: config.pricingServiceUrl
      });

      const response = await axios.post(
        `${config.pricingServiceUrl}/pricing/trigger-update`,
        {},
        {
          timeout: config.timeoutMs,
          headers: {
            'User-Agent': `PriceUpdater/${config.environment}/1.0`,
            'Content-Type': 'application/json'
          }
        }
      );

      const duration = Date.now() - startTime;
      log('info', 'Price update completed successfully', {
        attempt,
        duration: `${duration}ms`,
        status: response.status,
        responseData: response.data
      });

      return; // Успех, выходим из цикла

    } catch (error) {
      const duration = Date.now() - startTime;

      if (attempt >= config.maxRetries) {
        log('error', 'Price update failed after all retries', {
          attempt,
          maxRetries: config.maxRetries,
          duration: `${duration}ms`,
          error: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText
        });
        throw error;
      }

      // Экспоненциальная задержка перед повтором
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      log('warn', 'Price update failed, retrying', {
        attempt,
        maxRetries: config.maxRetries,
        delay: `${delay}ms`,
        error: error.message,
        status: error.response?.status
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Graceful shutdown
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log('info', `Received ${signal}, shutting down gracefully...`);

  // Даём время завершить текущий запрос
  setTimeout(() => {
    log('info', 'Graceful shutdown completed');
    process.exit(0);
  }, 5000);
}

// Обработчики сигналов
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Основной цикл
async function main() {
  log('info', 'Price updater started', {
    environment: config.environment,
    interval: `${config.updateIntervalSeconds}s`,
    url: config.pricingServiceUrl,
    maxRetries: config.maxRetries,
    timeout: `${config.timeoutMs}ms`
  });

  // Первый запуск сразу
  try {
    await updatePrices();
  } catch (error) {
    log('error', 'Initial price update failed', { error: error.message });
  }

  // Затем по расписанию
  const interval = setInterval(async () => {
    if (isShuttingDown) {
      clearInterval(interval);
      return;
    }

    try {
      await updatePrices();
    } catch (error) {
      log('error', 'Scheduled price update failed', { error: error.message });
    }
  }, config.updateIntervalSeconds * 1000);

  // Обработка ошибок
  process.on('uncaughtException', (error) => {
    log('error', 'Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    log('error', 'Unhandled rejection', { reason: reason.toString() });
    process.exit(1);
  });
}

// Запуск
main().catch((error) => {
  log('error', 'Failed to start price updater', { error: error.message, stack: error.stack });
  process.exit(1);
});
