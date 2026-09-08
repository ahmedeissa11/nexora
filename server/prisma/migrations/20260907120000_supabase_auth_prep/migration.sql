-- Non-destructive: map application users to Supabase Auth without
-- rewriting primary keys (orders, carts, wishlists stay attached).
-- passwordHash becomes nullable; new Supabase-backed users never store it.
-- Legacy bcrypt hashes remain until the user next signs in, then are nulled.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_authId_key" ON "User"("authId");

ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
