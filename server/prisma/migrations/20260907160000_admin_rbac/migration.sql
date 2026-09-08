-- Additive RBAC + audit. Existing users stay customers. No data deleted.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'customer';

CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");

ALTER TABLE "AuditLog"
  DROP CONSTRAINT IF EXISTS "AuditLog_actorId_fkey";
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "AdminBootstrapState" (
    "id" TEXT NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "consumedBy" TEXT,

    CONSTRAINT "AdminBootstrapState_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AdminBootstrapState" ("id", "consumedAt", "consumedBy")
VALUES ('http', NULL, NULL)
ON CONFLICT ("id") DO NOTHING;
