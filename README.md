# Token Price Service

Production-ready сервис обновления цен токенов, построенный с использованием Clean Architecture, DDD и SOLID принципов.

## Быстрый старт

### Требования
- Kubernetes кластер (минимум 1 worker node)
- kubectl настроен и подключен к кластеру
- Docker для сборки образов

### Development (локальная разработка)
```bash
# Установка зависимостей
npm install

# Запуск зависимостей (Postgres + Kafka)
docker-compose up -d postgres kafka

# Миграции базы данных
npx prisma migrate dev
npx prisma generate

# Запуск приложения
npm run start:dev
```

### Production (развертывание в кластере)

#### 1. Сборка и публикация Docker образа
```bash
# Сборка образа для amd64
docker buildx create --use || true
IMAGE=docker.io/uniwertz/token-price-service:prod-$(date +%Y%m%d%H%M)
docker buildx build --platform linux/amd64 -t $IMAGE --push .
```

#### 2. Создание секрета для Postgres
```bash
kubectl -n token-price-service create secret generic postgres-secret --from-literal=password=postgres
```

#### 3. Развертывание через GitOps
```bash
# Применение всех ресурсов (Kafka, Postgres, приложение)
kubectl apply -k gitops/overlays/production

# Проверка статуса
kubectl -n token-price-service rollout status deploy/postgres
kubectl -n token-price-service rollout status deploy/kafka
kubectl -n token-price-service rollout status deploy/token-price-service
```

#### 4. Включение CronJob (после стабилизации сервиса)
```bash
kubectl -n token-price-service patch cronjob price-updater --type=merge -p '{"spec":{"suspend":false}}'
```

## Архитектура

Приложение использует Clean Architecture с разделением на слои:
- Domain Layer: сущности, Value Objects, доменные сервисы
- Application Layer: use cases, команды, обработчики
- Infrastructure Layer: репозитории, внешние сервисы, messaging
- Interface Layer: REST контроллеры, API endpoints

## Технологический стек

- Node.js + TypeScript + NestJS
- PostgreSQL + Prisma
- Kafka для messaging
- Zod для валидации
- Docker + Kubernetes
- OpenTelemetry для телеметрии
- Jest для тестирования

## API Endpoints

### Health Check
```
GET /pricing/health
```
Возвращает статус сервиса, количество токенов и время последнего обновления.

### Status
```
GET /pricing/status
```
Возвращает детальную информацию о состоянии сервиса.

### Trigger Update
```
POST /pricing/trigger-update
```
Запускает обновление цен для всех токенов. Используется внешними планировщиками.

## Конфигурация

### Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| NODE_ENV | Окружение | development |
| PORT | Порт сервиса | 3000 |
| DATABASE_URL | URL базы данных | postgresql://postgres:postgres@postgres:5432/tokens |
| KAFKA_ENABLED | Включить Kafka | true |
| KAFKA_BROKERS | Kafka брокеры | kafka:9092 |
| KAFKA_CLIENT_ID | ID клиента Kafka | token-price-service |
| KAFKA_TOPIC | Топик Kafka | token-price-updates |
| KAFKAJS_NO_PARTITIONER_WARNING | Отключить предупреждение KafkaJS | 1 |
| AUTO_SEED_ON_STARTUP | Автоматическое заполнение данных | false |
| UPDATE_INTERVAL_SECONDS | Интервал обновления | 10 |
| MAX_RETRIES | Количество попыток | 5 |
| TIMEOUT_MS | Таймаут запросов | 60000 |

### GitOps конфигурация

Приложение поддерживает развертывание через GitOps с использованием Kustomize:

- `gitops/base/` - базовые манифесты (Deployment, Service, ConfigMap, Secret, PVC, Kafka, Postgres)
- `gitops/overlays/development/` - конфигурация для development
- `gitops/overlays/production/` - конфигурация для production (урезанные ресурсы, правильные образы)
- `gitops/argocd/` - ArgoCD Application (опционально)

#### Структура GitOps
```
gitops/
├── base/                          # Базовые манифесты
│   ├── kustomization.yaml        # Список ресурсов
│   ├── deployment.yaml           # Основное приложение
│   ├── service.yaml              # Service для приложения
│   ├── configmap.yaml            # Конфигурация
│   ├── secret.yaml               # Секреты
│   ├── pvc-*.yaml                # PersistentVolumeClaim для данных/логов
│   ├── kafka-deployment.yaml     # Kafka в кластере
│   ├── kafka-service.yaml        # Service для Kafka
│   ├── postgres-deployment.yaml  # Postgres в кластере
│   ├── postgres-service.yaml     # Service для Postgres
│   ├── postgres-pvc.yaml         # PVC для Postgres
│   ├── cronjob-price-updater.yaml # CronJob для обновления цен
│   └── ingress.yaml              # Ingress (базовый)
└── overlays/
    └── production/               # Production overlay
        ├── kustomization.yaml    # Патчи для production
        ├── deployment-patch.yaml # Урезанные ресурсы, правильный образ
        ├── configmap-patch.yaml  # Production переменные
        ├── cronjob-patch.yaml    # Suspend=true, минимальные ресурсы
        ├── ingress-patch.yaml    # Домены и TLS
        └── pvc-patch.yaml        # StorageClass для PVC
```

## Планирование обновления цен

Сервис использует разные подходы к планированию в зависимости от окружения:

### Development
- Ручной запуск через API: `curl -X POST http://localhost:3000/pricing/trigger-update`
- Или через npm скрипт (если есть): `npm run scheduler:dev`

### Production
- Kubernetes CronJob - запускается каждую минуту
- 12 запросов с интервалом 5 секунд между ними
- Suspend по умолчанию - включается после стабилизации основного сервиса
- Минимальные ресурсы - requests: 5m/16Mi, limits: 20m/64Mi
- Управление: `kubectl -n token-price-service patch cronjob price-updater --type=merge -p '{"spec":{"suspend":false}}'`

## Тестирование

### Unit тесты
```bash
npm test
```

### E2E тесты
```bash
npm run test:e2e
```

### Покрытие кода
```bash
npm run test:cov
```

## Мониторинг

### Логи
Сервис использует структурированное JSON логирование с временными метками и контекстом.

### Метрики
Интеграция с OpenTelemetry для сбора метрик и трассировки.

### Health Checks
Встроенные health checks для Kubernetes liveness и readiness probes.

## Разработка

### Структура проекта

```
src/
├── app/                   # Конфигурация приложения
├── contexts/              # Bounded Contexts (DDD)
│   └── pricing/           # Pricing Context
│       ├── domain/        # Domain Layer
│       ├── application/   # Application Layer
│       ├── infrastructure/# Infrastructure Layer
│       └── interface/     # Interface Layer
├── shared/                # Shared Kernel
│   ├── domain/           # Shared Value Objects
│   ├── infrastructure/   # Shared Infrastructure
│   ├── kernel/           # Core Abstractions
│   └── utils/            # Utilities
└── services/             # Legacy Services
```

### Команды разработки

```bash
npm run build              # Сборка проекта
npm run start:dev          # Development режим
npm run start:prod         # Production режим
npm run lint               # Линтинг
npm run format             # Форматирование кода
npm run prisma:migrate     # Миграции БД
npm run prisma:studio      # Prisma Studio
```

### Добавление новых токенов

Схема Prisma уже готова для добавления новых токенов. Просто добавьте новую запись в таблицу `tokens`:

```sql
INSERT INTO tokens (
  contract_address, symbol, display_name, decimal_places,
  is_native_token, chain_id, is_system_protected,
  last_modified_by, display_priority, current_price
) VALUES (
  '\x1234...', 'NEW', 'New Token', 18,
  false, 'chain-id', false,
  'admin', 100, 0
);
```

## Troubleshooting

### Проблемы с ресурсами кластера
```bash
# Проверить доступные ресурсы узлов
kubectl describe nodes
```

### Проблемы с образами
```bash
# Проверить доступность образа
docker buildx imagetools inspect docker.io/uniwertz/token-price-service:prod-YYYYMMDDHHMM

# Пересобрать и запушить
docker buildx build --platform linux/amd64 -t $IMAGE --push .
```

### Проблемы с базой данных
```bash
# Проверить статус Postgres
kubectl -n token-price-service get pods -l app=postgres
kubectl -n token-price-service logs -l app=postgres

# Проверить секрет
kubectl -n token-price-service get secret postgres-secret -o yaml
```

### Проблемы с Kafka
```bash
# Проверить статус Kafka
kubectl -n token-price-service get pods -l app=kafka
kubectl -n token-price-service logs -l app=kafka

# Проверить сервис
kubectl -n token-price-service get svc kafka
```

### Проблемы с основным приложением
```bash
# Проверить статус подов
kubectl -n token-price-service get pods -l app=token-price-service

# Проверить логи
kubectl -n token-price-service logs -l app=token-price-service --tail=100

# Проверить события
kubectl -n token-price-service describe pod -l app=token-price-service

# Перезапустить deployment
kubectl -n token-price-service rollout restart deploy/token-price-service
```

### Проблемы с CronJob
```bash
# Проверить статус CronJob
kubectl -n token-price-service get cronjob price-updater

# Включить/выключить CronJob
kubectl -n token-price-service patch cronjob price-updater --type=merge -p '{"spec":{"suspend":false}}'
kubectl -n token-price-service patch cronjob price-updater --type=merge -p '{"spec":{"suspend":true}}'

# Проверить Jobs
kubectl -n token-price-service get jobs
kubectl -n token-price-service logs -l job-name=price-updater-XXXXXX
```

## Безопасность

- Все секреты хранятся в Kubernetes Secrets
- Конфигурация через ConfigMaps
- Health checks для мониторинга
- Graceful shutdown для корректного завершения

## Дополнительные ресурсы

### Настройка внешних сервисов

После запуска скрипта настройки необходимо настроить внешние сервисы:

1. GitHub/GitLab репозиторий - загрузите код и настройте webhook для ArgoCD
2. PostgreSQL база данных - создайте управляемую БД или разверните в кластере
3. Kafka - настройте управляемый Kafka или разверните в кластере
4. DNS и домен - настройте DNS записи для вашего домена
5. SSL сертификаты - cert-manager автоматически получит сертификаты от Let's Encrypt

### Полезные команды

```bash
# Проверка статуса всех ресурсов
kubectl get all -n token-price-service

# Проверка статуса конкретных компонентов
kubectl -n token-price-service get pods,svc,pvc,deploy,cronjob

# Просмотр логов основного приложения
kubectl -n token-price-service logs -l app=token-price-service -f

# Просмотр логов Kafka
kubectl -n token-price-service logs -l app=kafka -f

# Просмотр логов Postgres
kubectl -n token-price-service logs -l app=postgres -f

# Port-forward для локального доступа
kubectl -n token-price-service port-forward svc/token-price-service 3000:3000

# Доступ к ArgoCD (если установлен)
kubectl -n argocd port-forward svc/argocd-server 8080:443
```

### CI/CD

Проект поддерживает автоматическое развертывание через ArgoCD для GitOps развертывания.

## Лицензия

Этот проект создан в тестовых целях.