-- CreateTable
CREATE TABLE "chains" (
    "id" TEXT NOT NULL,
    "deployment_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_logos" (
    "id" TEXT NOT NULL,
    "token_id" TEXT,
    "large_image_path" TEXT NOT NULL,
    "medium_image_path" TEXT NOT NULL,
    "thumbnail_path" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "token_logos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
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

-- CreateIndex
CREATE UNIQUE INDEX "chains_deployment_id_key" ON "chains"("deployment_id");

-- CreateIndex
CREATE INDEX "chains_is_enabled_idx" ON "chains"("is_enabled");

-- CreateIndex
CREATE INDEX "chains_deployment_id_idx" ON "chains"("deployment_id");

-- CreateIndex
CREATE UNIQUE INDEX "token_logos_token_id_key" ON "token_logos"("token_id");

-- CreateIndex
CREATE INDEX "tokens_chain_id_idx" ON "tokens"("chain_id");

-- CreateIndex
CREATE INDEX "tokens_symbol_idx" ON "tokens"("symbol");

-- CreateIndex
CREATE INDEX "tokens_is_system_protected_idx" ON "tokens"("is_system_protected");

-- CreateIndex
CREATE INDEX "tokens_last_price_update_datetime_idx" ON "tokens"("last_price_update_datetime");

-- CreateIndex
CREATE INDEX "tokens_chain_id_is_system_protected_idx" ON "tokens"("chain_id", "is_system_protected");

-- CreateIndex
CREATE INDEX "tokens_last_price_update_datetime_chain_id_idx" ON "tokens"("last_price_update_datetime", "chain_id");

-- AddForeignKey
ALTER TABLE "token_logos" ADD CONSTRAINT "token_logos_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "chains"("id") ON DELETE CASCADE ON UPDATE CASCADE;
