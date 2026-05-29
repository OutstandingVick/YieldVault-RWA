-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "eventTypes" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "secret" TEXT,
    "secretHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpointId" TEXT NOT NULL,
    "endpointUrl" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "deliveredAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WebhookDelivery_createdAt_idx" ON "WebhookDelivery"("createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_idx" ON "WebhookDelivery"("endpointId");
