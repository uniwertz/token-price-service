#!/bin/bash
set -euo pipefail

# Цветные сообщения
info() { echo -e "\033[1;34m[INFO]\033[0m $*"; }
success() { echo -e "\033[1;32m[SUCCESS]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $*"; }

# Пути
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.deploy"

if [[ ! -f "$ENV_FILE" ]]; then
  error "Не найден файл $ENV_FILE. Создайте его по примеру и заполните секреты."
  exit 1
fi

# Загружаем переменные окружения из .env.deploy
set -o allexport
source "$ENV_FILE"
set +o allexport

# Значения по умолчанию для новых опций
USE_SINGLE_DOMAIN=${USE_SINGLE_DOMAIN:-true}
TLS_MODE=${TLS_MODE:-existing}
TLS_SECRET_NAME=${TLS_SECRET_NAME:-token-price-service-tls}
TLS_API_SECRET_NAME=${TLS_API_SECRET_NAME:-}

# Проверка требуемых переменных
REQUIRED_VARS=(NAMESPACE ENVIRONMENT GITOPS_REPO_URL GITOPS_TARGET_REVISION GITOPS_PATH DOMAIN CLUSTER_ISSUER PRICING_SERVICE_URL)
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    error "Переменная $var не задана в .env.deploy"
    exit 1
  fi
done

# Если используется единый домен — API_DOMAIN берём из DOMAIN
if [[ "$USE_SINGLE_DOMAIN" == "true" ]]; then
  API_DOMAIN="$DOMAIN"
fi

# Необязательные переменные
API_DOMAIN=${API_DOMAIN:-$DOMAIN}

# Необязательные секреты, но предупредим, если пусто
OPTIONAL_SECRETS=(DATABASE_URL KAFKA_BROKERS)
for var in "${OPTIONAL_SECRETS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    warn "Переменная $var пуста. Убедитесь, что это ожидаемо."
  fi
done

info "Проверка доступа к кластеру..."
kubectl cluster-info >/dev/null

# 1) Namespace
info "Применение namespace $NAMESPACE"
cat <<YAML | kubectl apply -f -
apiVersion: v1
kind: Namespace
metadata:
  name: $NAMESPACE
  labels:
    name: $NAMESPACE
    app.kubernetes.io/name: token-price-service
    app.kubernetes.io/version: "1.0.0"
YAML

# 2) Secrets (application)
info "Применение Secret token-price-service-secrets"
DATABASE_URL_B64=$(printf "%s" "${DATABASE_URL:-}" | base64 | tr -d '\n')
KAFKA_BROKERS_B64=$(printf "%s" "${KAFKA_BROKERS:-}" | base64 | tr -d '\n')
PRICING_SERVICE_URL_B64=$(printf "%s" "${PRICING_SERVICE_URL}" | base64 | tr -d '\n')
cat <<YAML | kubectl -n "$NAMESPACE" apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: token-price-service-secrets
  labels:
    app.kubernetes.io/name: token-price-service
    app.kubernetes.io/managed-by: deploy.sh
type: Opaque
data:
  DATABASE_URL: ${DATABASE_URL_B64}
  KAFKA_BROKERS: ${KAFKA_BROKERS_B64}
  PRICING_SERVICE_URL: ${PRICING_SERVICE_URL_B64}
YAML

# 3) ConfigMap (application)
info "Применение ConfigMap token-price-service-config"
cat <<YAML | kubectl -n "$NAMESPACE" apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: token-price-service-config
  labels:
    app.kubernetes.io/name: token-price-service
    app.kubernetes.io/managed-by: deploy.sh
data:
  NODE_ENV: "${NODE_ENV:-production}"
  PORT: "${PORT:-3000}"
  KAFKA_CLIENT_ID: "${KAFKA_CLIENT_ID:-token-price-service}"
  KAFKA_TOPIC: "${KAFKA_TOPIC:-token-price-updates}"
  AUTO_SEED_ON_STARTUP: "${AUTO_SEED_ON_STARTUP:-false}"
  UPDATE_INTERVAL_SECONDS: "${UPDATE_INTERVAL_SECONDS:-10}"
  MAX_RETRIES: "${MAX_RETRIES:-5}"
  TIMEOUT_MS: "${TIMEOUT_MS:-60000}"
YAML

# 4) ServiceAccount для price-updater
info "Применение ServiceAccount price-updater"
cat <<YAML | kubectl -n "$NAMESPACE" apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: price-updater
  labels:
    app: price-updater
    app.kubernetes.io/name: price-updater
    app.kubernetes.io/version: "1.0.0"
YAML

###############################################
# 5) Сначала GitOps base и overlay (Ingress и т.д.)
###############################################
info "Применение базовых GitOps ресурсов (base)"
set +e
kubectl apply -k "$ROOT_DIR/gitops/base" || true
set -e

OVERLAY_PATH="$ROOT_DIR/gitops/overlays/$ENVIRONMENT"
if [[ -d "$OVERLAY_PATH" ]]; then
  info "Применение оверлея $ENVIRONMENT"
  set +e
  kubectl apply -k "$OVERLAY_PATH" || true
  set -e
else
  warn "Оверлей $ENVIRONMENT не найден по пути $OVERLAY_PATH. Пропускаю."
fi

## Патч пути Ingress (переводим pathType на ImplementationSpecific для regex пути)
info "Патч pathType=ImplementationSpecific для token-price-service-api-ingress"
kubectl -n "$NAMESPACE" patch ingress token-price-service-api-ingress \
  --type='json' -p='[{"op":"replace","path":"/spec/rules/0/http/paths/0/pathType","value":"ImplementationSpecific"}]' || true

## Целиком полагаемся на GitOps манифесты для price-updater и сервиса

# 8) Никакого патчинга Ingress — домены заданы в overlays/production/ingress-patch.yaml

# 9) Установка/настройка ArgoCD (опционально)
if [[ "${INSTALL_ARGOCD:-false}" == "true" ]]; then
  info "Установка ArgoCD в namespace argocd"
  kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
  kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
  info "Ожидание готовности ArgoCD"
  kubectl rollout status deployment/argocd-server -n argocd --timeout=300s || true

  if [[ -n "${ARGOCD_DOMAIN:-}" ]]; then
cat <<YAML | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: argocd-server-ingress
  namespace: argocd
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "$CLUSTER_ISSUER"
spec:
  tls:
  - hosts:
    - $ARGOCD_DOMAIN
    secretName: argocd-tls
  rules:
  - host: $ARGOCD_DOMAIN
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: argocd-server
            port:
              number: 80
YAML
  fi

  info "Создание/обновление ArgoCD Application"
cat <<YAML | kubectl apply -f -
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: token-price-service
  namespace: argocd
spec:
  project: default
  source:
    repoURL: $GITOPS_REPO_URL
    targetRevision: $GITOPS_TARGET_REVISION
    path: $GITOPS_PATH
  destination:
    server: https://kubernetes.default.svc
    namespace: $NAMESPACE
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
YAML
fi

# 10) Ожидание готовности основных компонентов
info "Ожидание готовности deployment/price-updater"
kubectl wait --for=condition=available --timeout=300s deployment/price-updater -n "$NAMESPACE" || true

# 11) Вывод статуса
info "Сервисы:"
kubectl get svc -n "$NAMESPACE"
info "Ingress:"
kubectl get ingress -n "$NAMESPACE"
info "Подробности по подам:"
kubectl get pods -n "$NAMESPACE" -o wide

success "Деплой завершен. Проверьте доступность: https://$DOMAIN и https://$API_DOMAIN"
