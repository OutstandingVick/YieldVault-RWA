-- Migration: Add WriteAheadAuditEntry table
-- Issue #856: Persist write-ahead audit log entries to Prisma for
-- multi-instance durability (replaces the process-local in-memory store
-- used by the Issue #707 prepare/commit/rollback flow).

CREATE TABLE "WriteAheadAuditEntry" (
  "id"                 TEXT      NOT NULL PRIMARY KEY,
  "configType"         TEXT      NOT NULL,
  "action"             TEXT      NOT NULL,
  "actor"              TEXT      NOT NULL,
  "ipAddress"          TEXT,
  "userAgent"          TEXT,
  "preChangeSnapshot"  TEXT      NOT NULL,
  "postChangeSnapshot" TEXT,
  "metadata"           TEXT      NOT NULL,
  "status"             TEXT      NOT NULL DEFAULT 'pending',
  "requestId"          TEXT,
  "createdAt"          DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "committedAt"        DATETIME
);

CREATE INDEX "WriteAheadAuditEntry_status_idx"    ON "WriteAheadAuditEntry"("status");
CREATE INDEX "WriteAheadAuditEntry_createdAt_idx" ON "WriteAheadAuditEntry"("createdAt");
CREATE INDEX "WriteAheadAuditEntry_configType_idx" ON "WriteAheadAuditEntry"("configType");
CREATE INDEX "WriteAheadAuditEntry_actor_idx"     ON "WriteAheadAuditEntry"("actor");
