-- CreateTable
CREATE TABLE "ExportManifest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requester" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL,
    "fileName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "bulkExportJobId" TEXT,
    "artifactId" TEXT
);

-- CreateTable
CREATE TABLE "ReconciliationSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "generatedAt" DATETIME NOT NULL,
    "traceId" TEXT,
    "status" TEXT NOT NULL,
    "windowFrom" DATETIME NOT NULL,
    "windowTo" DATETIME NOT NULL,
    "summaryJson" TEXT NOT NULL,
    "driftCount" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "TransactionBackfillJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobKey" TEXT NOT NULL,
    "startLedger" INTEGER NOT NULL,
    "endLedger" INTEGER NOT NULL,
    "batchSize" INTEGER NOT NULL,
    "dryRun" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "rpcUrl" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "lastProcessedLedger" INTEGER,
    "progressJson" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "ExportManifest_generatedAt_idx" ON "ExportManifest"("generatedAt");
CREATE INDEX "ExportManifest_requester_idx" ON "ExportManifest"("requester");
CREATE INDEX "ExportManifest_reportType_idx" ON "ExportManifest"("reportType");
CREATE INDEX "ExportManifest_checksum_idx" ON "ExportManifest"("checksum");

-- CreateIndex
CREATE INDEX "ReconciliationSnapshot_generatedAt_idx" ON "ReconciliationSnapshot"("generatedAt");
CREATE INDEX "ReconciliationSnapshot_status_idx" ON "ReconciliationSnapshot"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionBackfillJob_jobKey_key" ON "TransactionBackfillJob"("jobKey");
CREATE INDEX "TransactionBackfillJob_status_idx" ON "TransactionBackfillJob"("status");
CREATE INDEX "TransactionBackfillJob_createdAt_idx" ON "TransactionBackfillJob"("createdAt");
CREATE INDEX "TransactionBackfillJob_dryRun_idx" ON "TransactionBackfillJob"("dryRun");
