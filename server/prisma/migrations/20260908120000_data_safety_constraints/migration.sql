-- Forward-only data safety. Does not drop tables or rewrite existing rows.
-- CHECK constraints + reservation uniqueness + wishlist Restrict on product.

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryReservation_orderId_productId_key"
  ON "InventoryReservation" ("orderId", "productId");

DO $$
BEGIN
  ALTER TABLE "Wishlist" DROP CONSTRAINT IF EXISTS "Wishlist_productId_fkey";
  ALTER TABLE "Wishlist"
    ADD CONSTRAINT "Wishlist_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_stock_nonnegative" CHECK (stock >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_role_allowed" CHECK (role IN ('customer', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_status_allowed"
    CHECK (status IN ('pending_payment', 'paid', 'cancelled', 'expired', 'dispatched', 'placed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "InventoryReservation" ADD CONSTRAINT "Reservation_status_allowed"
    CHECK (status IN ('active', 'released', 'consumed', 'expired'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "InventoryReservation" ADD CONSTRAINT "Reservation_qty_positive" CHECK (qty >= 1);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_qty_positive" CHECK (qty >= 1);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_qty_positive" CHECK (qty >= 1);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "Adjustment_math_matches"
    CHECK ("resultingStock" = "previousStock" + delta);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "Adjustment_resulting_nonnegative"
    CHECK ("resultingStock" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_paidAt_not_before_created"
    CHECK ("paidAt" IS NULL OR "paidAt" >= "createdAt");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
