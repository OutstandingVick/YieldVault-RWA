-- Align schema.prisma with the webhook and bulk export tables used by the backend.

-- AlterTable
ALTER TABLE "WebhookEndpoint" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "WebhookEndpoint" ADD COLUMN "deletedBy" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "BulkExportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "format" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "artifactId" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebhookEndpoint_deletedAt_idx" ON "WebhookEndpoint"("deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebhookEndpoint_createdAt_idx" ON "WebhookEndpoint"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BulkExportJob_status_idx" ON "BulkExportJob"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BulkExportJob_createdAt_idx" ON "BulkExportJob"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BulkExportJob_generatedBy_idx" ON "BulkExportJob"("generatedBy");
