-- Additive Stripe payment fields. Does not rewrite orders or inventory.

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'usd';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "guestAccessHash" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "stripeCheckoutSessionId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_stripeCheckoutSessionId_key" ON "Order"("stripeCheckoutSessionId");
CREATE INDEX IF NOT EXISTS "Order_guestAccessHash_idx" ON "Order"("guestAccessHash");
CREATE INDEX IF NOT EXISTS "Order_paymentReference_idx" ON "Order"("paymentReference");

CREATE TABLE IF NOT EXISTS "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StripeEvent_orderId_idx" ON "StripeEvent"("orderId");
CREATE INDEX IF NOT EXISTS "StripeEvent_createdAt_idx" ON "StripeEvent"("createdAt");
