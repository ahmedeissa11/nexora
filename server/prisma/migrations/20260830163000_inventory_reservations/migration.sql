-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'pending_payment';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "dispatchedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cancelRequestedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentProvider" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentReference" TEXT;

CREATE INDEX IF NOT EXISTS "Order_expiresAt_idx" ON "Order"("expiresAt");

-- Historical orders with status 'placed' remain 'placed'.
-- They already decremented physical stock under the previous architecture
-- and are treated as a legacy terminal state. They are not rewritten to 'paid'.

CREATE TABLE IF NOT EXISTS "InventoryReservation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryReservation_productId_idx" ON "InventoryReservation"("productId");
CREATE INDEX IF NOT EXISTS "InventoryReservation_orderId_idx" ON "InventoryReservation"("orderId");
CREATE INDEX IF NOT EXISTS "InventoryReservation_status_idx" ON "InventoryReservation"("status");
CREATE INDEX IF NOT EXISTS "InventoryReservation_expiresAt_idx" ON "InventoryReservation"("expiresAt");
CREATE INDEX IF NOT EXISTS "InventoryReservation_productId_status_idx" ON "InventoryReservation"("productId", "status");
CREATE INDEX IF NOT EXISTS "InventoryReservation_status_expiresAt_idx" ON "InventoryReservation"("status", "expiresAt");

ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT "InventoryReservation_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryReservation"
  ADD CONSTRAINT "InventoryReservation_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
