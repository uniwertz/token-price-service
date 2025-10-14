# Multi-stage build для production-ready образа
FROM node:24-alpine AS builder

# Рабочая директория
WORKDIR /app

# Копируем package files и ставим dev+prod зависимости (для nest/tsc)
COPY package*.json ./
RUN npm ci

# Гарантируем наличие nest-cli в builder
RUN npm i -g @nestjs/cli

# Генерация Prisma client
COPY prisma ./prisma/
RUN npx prisma generate

# Копируем исходный код и собираем
COPY . .
RUN npm run build

# Production stage
FROM node:24-alpine AS production

# Создаем пользователя для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Создаем рабочую директорию
WORKDIR /app

# Копируем package files
COPY package*.json ./

# Устанавливаем только production зависимости
RUN npm ci --only=production && npm cache clean --force

# Копируем собранное приложение из builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Создаем директории для логов
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app/logs

# Переключаемся на непривилегированного пользователя
USER nodejs

# Expose порт
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/pricing/health || exit 1

# Запускаем приложение
CMD ["node", "dist/main.js"]
