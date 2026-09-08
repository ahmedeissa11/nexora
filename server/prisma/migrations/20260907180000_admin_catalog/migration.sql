-- Additive: product archive flag + auditable inventory adjustments.
-- Does not drop data. Existing products remain active.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "Product_isActive_idx" ON "Product"("isActive");

CREATE TABLE IF NOT EXISTS "InventoryAdjustment" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "actorId" TEXT,
    "delta" INTEGER NOT NULL,
    "previousStock" INTEGER NOT NULL,
    "resultingStock" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryAdjustment_idempotencyKey_key" ON "InventoryAdjustment"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "InventoryAdjustment_productId_idx" ON "InventoryAdjustment"("productId");
CREATE INDEX IF NOT EXISTS "InventoryAdjustment_createdAt_idx" ON "InventoryAdjustment"("createdAt");
CREATE INDEX IF NOT EXISTS "InventoryAdjustment_actorId_idx" ON "InventoryAdjustment"("actorId");

ALTER TABLE "InventoryAdjustment"
  DROP CONSTRAINT IF EXISTS "InventoryAdjustment_productId_fkey";
ALTER TABLE "InventoryAdjustment"
  ADD CONSTRAINT "InventoryAdjustment_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryAdjustment"
  DROP CONSTRAINT IF EXISTS "InventoryAdjustment_actorId_fkey";
ALTER TABLE "InventoryAdjustment"
  ADD CONSTRAINT "InventoryAdjustment_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
