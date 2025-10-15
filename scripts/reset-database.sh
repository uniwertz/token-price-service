#!/bin/bash
set -e

echo "=== Database Reset Script ==="
echo ""
echo "This will:"
echo "1. Drop all tables"
echo "2. Run migrations from scratch"
echo "3. Seed initial data (1311 chains + 24k+ tokens)"
echo ""

if [ "$1" != "--force" ]; then
  read -p "Are you sure? Type 'yes' to continue: " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
  fi
fi

echo ""
echo "Step 1: Dropping all tables..."
npx prisma migrate reset --force --skip-seed

echo ""
echo "Step 2: Running migrations..."
npx prisma migrate deploy

echo ""
echo "Step 3: Seeding will happen automatically on app start (AUTO_SEED_ON_STARTUP=true)"
echo "        This will load 1311 chains and 24k+ tokens (~3-5 min)"
echo ""
echo "✓ Database reset complete!"
echo ""
echo "Next steps:"
echo "  - Local: npm run start:dev"
echo "  - K8s: kubectl rollout restart deployment/token-price-service -n token-price-service"

# Bump version