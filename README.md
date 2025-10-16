# Token Price Service

Production-ready сервис обновления цен токенов, построенный с использованием Clean Architecture, DDD и SOLID принципов.

## Быстрый старт

### Требования
- Node.js 18+ и npm
- Kubernetes кластер (минимум 1 worker node)
- kubectl настроен и подключен к кластеру
- ArgoCD установлен в кластере (для GitOps)
- Docker для локальной разработки

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

#### Автоматическое развертывание через CI/CD

Проект использует **GitHub Actions** для автоматической сборки и развертывания:

1. **При создании Pull Request в main:**
   - Запускаются тесты (unit + e2e)
   - Проверяется линтинг
   
2. **При создании тега `v*.*.*` (например, v1.0.0):**
   - Запускаются тесты
   - Собирается Docker образ для `linux/amd64`
   - Образ публикуется в GitHub Container Registry (GHCR): `ghcr.io/uniwertz/token-price-service:v1.0.0`
   - Выполняется security scan через Trivy
   - **Автоматически создается Pull Request** с обновлением production манифеста
   - После мержа PR, ArgoCD автоматически деплоит новую версию в кластер

#### Процесс релиза

```bash
# 1. Создайте и запушьте тег версии
git tag v1.0.0
git push origin v1.0.0

# 2. GitHub Actions автоматически:
#    - Соберет и опубликует Docker образ
#    - Создаст PR с обновлением версии в gitops/overlays/production/deployment-patch.yaml

# 3. Проверьте и смержьте автоматически созданный PR

# 4. ArgoCD автоматически задеплоит новую версию (если настроен syncPolicy.automated)
```

#### Ручное развертывание (если нужно)

```bash
# 1. Создание секрета для GHCR (однократно)
kubectl -n token-price-service create secret docker-registry ghcr-cred \
  --docker-server=ghcr.io \
  --docker-username=uniwertz \
  --docker-password=$GITHUB_TOKEN \
  --docker-email=your-email@example.com

# 2. Создание секрета для Postgres
kubectl -n token-price-service create secret generic postgres-secret \
  --from-literal=password=postgres

# 3. Применение ArgoCD Application
kubectl apply -f gitops/argocd/application.yaml

# 4. ArgoCD автоматически развернет все ресурсы из gitops/overlays/production

# 5. Проверка статуса
kubectl -n token-price-service rollout status deploy/postgres
kubectl -n token-price-service rollout status deploy/kafka
kubectl -n token-price-service rollout status deploy/token-price-service

# 6. Включение CronJob (после стабилизации сервиса)
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

Приложение использует **GitOps** подход с **ArgoCD** и **Kustomize**:

- `gitops/base/` - базовые манифесты (Deployment, Service, ConfigMap, Secret, PVC, Kafka, Postgres, CronJob)
- `gitops/overlays/production/` - конфигурация для production (оптимизированные ресурсы, образы из GHCR)
- `gitops/argocd/application.yaml` - ArgoCD Application для автоматического деплоя

**Преимущества GitOps:**
- Декларативная конфигурация инфраструктуры
- Автоматическая синхронизация с кластером (automated sync + self-heal)
- История изменений через Git
- Откат через revert коммита
- Review процесс через Pull Requests

#### Структура GitOps
```
gitops/
├── argocd/
│   └── application.yaml          # ArgoCD Application manifest
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
        ├── deployment-patch.yaml # Оптимизированные ресурсы, образ из GHCR
        ├── configmap-patch.yaml  # Production переменные
        ├── cronjob-patch.yaml    # Suspend=true, минимальные ресурсы
        ├── ingress-patch.yaml    # Домены и TLS
        └── pvc-patch.yaml        # StorageClass для PVC
```

**Важно:** Версия образа в `deployment-patch.yaml` обновляется автоматически через CI/CD pipeline при создании релиза.

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

### Требования к окружению

**GitHub:**
- Repository с настроенными Actions workflows
- Secrets для GITHUB_TOKEN (предоставляется автоматически)
- GitHub Container Registry для хранения Docker образов

**Kubernetes кластер:**
- ArgoCD установлен и настроен
- Namespace `token-price-service` (создается автоматически через ArgoCD)
- Секреты `ghcr-cred` и `postgres-secret` (создаются вручную)

**Опционально:**
- cert-manager для автоматического получения SSL сертификатов
- Ingress controller (nginx/traefik) для внешнего доступа
- Prometheus/Grafana для мониторинга
- ELK/Loki stack для централизованных логов

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

### CI/CD Pipeline

Проект использует **GitHub Actions** для полностью автоматизированного CI/CD процесса.

#### Workflow: `.github/workflows/ci-cd.yml`

**Триггеры:**
- `pull_request` → `main` (игнорирует изменения в `gitops/**`)
- `push` тегов формата `v*.*.*`

**Этапы (Jobs):**

1. **test** - Запускается на PR и при создании тега
   - Устанавливает Node.js 18
   - Устанавливает зависимости (`npm ci`)
   - Запускает линтинг (`npm run lint`)
   - Запускает unit тесты (`npm run test`)
   - Запускает e2e тесты (`npm run test:e2e`)
   - Требует работающие Postgres и Kafka (через Docker services)

2. **build** - Запускается только для тегов после успешных тестов
   - Собирает Docker образ для `linux/amd64`
   - Публикует в GitHub Container Registry: `ghcr.io/uniwertz/token-price-service:v1.0.0`
   - Также создает тег `:latest`
   - Использует `docker buildx` для кросс-платформенной сборки

3. **security-scan** - Запускается после build
   - Сканирует Docker образ через **Trivy**
   - Проверяет уязвимости в зависимостях
   - Генерирует SARIF отчет

4. **gitops-update** - Запускается после security-scan
   - Обновляет версию образа в `gitops/overlays/production/deployment-patch.yaml`
   - **Создает Pull Request** с названием "🚀 Deploy v1.0.0 to production"
   - PR содержит описание изменений и версию образа
   - Использует action `peter-evans/create-pull-request@v6`
   - После мержа PR, ArgoCD автоматически синхронизирует изменения с кластером

#### Процесс релиза

```bash
# 1. Убедитесь что все изменения в main
git checkout main
git pull origin main

# 2. Создайте тег версии (следуя Semantic Versioning)
git tag v1.0.0
git push origin v1.0.0

# 3. GitHub Actions автоматически:
#    ✓ Запустит тесты
#    ✓ Соберет Docker образ
#    ✓ Опубликует в GHCR
#    ✓ Проверит безопасность
#    ✓ Создаст PR с обновлением production манифеста

# 4. Проверьте созданный PR и смержьте его
#    https://github.com/uniwertz/token-price-service/pulls

# 5. ArgoCD автоматически задеплоит новую версию в кластер
#    (если настроен syncPolicy.automated: true)

# 6. Проверьте статус деплоя
kubectl -n token-price-service get pods
kubectl -n token-price-service rollout status deploy/token-price-service
```

#### Мониторинг CI/CD

- **GitHub Actions**: `https://github.com/uniwertz/token-price-service/actions`
- **Pull Requests**: `https://github.com/uniwertz/token-price-service/pulls`
- **Container Registry**: `https://github.com/uniwertz/token-price-service/pkgs/container/token-price-service`
- **ArgoCD UI**: `kubectl -n argocd port-forward svc/argocd-server 8080:443`

#### Откат версии

Если нужно откатить деплой:

```bash
# Вариант 1: Через revert PR
git revert <commit-hash>
git push origin main

# Вариант 2: Создать новый тег с предыдущей версией кода
git tag -d v1.0.1  # удалить локально
git push origin :refs/tags/v1.0.1  # удалить на GitHub
git checkout v1.0.0  # вернуться к предыдущей версии
git tag v1.0.2  # создать новый тег
git push origin v1.0.2

# Вариант 3: Ручное изменение манифеста (не рекомендуется)
kubectl -n token-price-service set image deployment/token-price-service \
  token-price-service=ghcr.io/uniwertz/token-price-service:v1.0.0
```

## Лицензия

Этот проект создан в тестовых целях.