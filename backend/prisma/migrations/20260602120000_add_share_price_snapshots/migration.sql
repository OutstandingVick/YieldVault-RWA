-- CreateTable
CREATE TABLE IF NOT EXISTS "SharePriceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sharePrice" TEXT NOT NULL,
    "totalAssets" TEXT NOT NULL,
    "totalShares" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SharePriceSnapshot_recordedAt_idx" ON "SharePriceSnapshot"("recordedAt");
