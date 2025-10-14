# GitHub Actions Setup

## Настройка разрешений для GitHub Container Registry (GHCR)

Для работы CI/CD пайплайна необходимо настроить следующие разрешения:

### 1. Настройка репозитория

1. Перейдите в Settings → Actions → General
2. В разделе "Workflow permissions" выберите:
   - Read and write permissions
   - Allow GitHub Actions to create and approve pull requests

### 2. Настройка пакетов

1. Перейдите в Settings → Actions → General
2. В разделе "Packages" выберите:
   - Allow GitHub Actions to create and update packages

### 3. Настройка переменных окружения

В Settings → Secrets and variables → Actions должны быть настроены:

- `KUBE_CONFIG_STAGING` - содержимое kubeconfig файла для staging кластера (base64 encoded)
- `KUBE_CONFIG_PRODUCTION` - содержимое kubeconfig файла для production кластера (base64 encoded)
- `SLACK_WEBHOOK` - URL webhook для уведомлений в Slack (опционально)

#### Формат SLACK_WEBHOOK:
```
https://hooks.slack.com/services/T[TEAM_ID]/B[CHANNEL_ID]/[WEBHOOK_TOKEN]
```

#### Получение kubeconfig:

```bash
# Для staging
kubectl config view --raw --minify > staging-kubeconfig.yaml
base64 -w 0 staging-kubeconfig.yaml

# Для production
kubectl config view --raw --minify > production-kubeconfig.yaml
base64 -w 0 production-kubeconfig.yaml
```

### 4. Настройка окружений

Создайте окружения в Settings → Environments:
- `staging` - для развертывания в staging
- `production` - для развертывания в production

### 5. Проверка разрешений

После настройки разрешений:
1. Сделайте push в ветку `main` или `develop`
2. Проверьте, что Docker образ успешно загружается в GHCR
3. Убедитесь, что все джобы выполняются без ошибок

## Troubleshooting

### Ошибка "installation not allowed to Create organization package"

Эта ошибка возникает, когда у GitHub Actions нет разрешения на создание пакетов в организации.

Решение:
1. Перейдите в Settings → Actions → General
2. Включите "Allow GitHub Actions to create and update packages"
3. Убедитесь, что в workflow файле указаны правильные permissions

### Ошибка доступа к GHCR

Решение:
1. Проверьте, что `GITHUB_TOKEN` имеет необходимые разрешения
2. Убедитесь, что имя пакета соответствует формату `owner/package-name`
3. Проверьте, что репозиторий имеет правильные настройки видимости