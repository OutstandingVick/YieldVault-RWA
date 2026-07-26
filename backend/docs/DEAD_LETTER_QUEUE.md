# Dead-Letter Queue (DLQ) Processing System

This document describes the production-hardened Dead-Letter Queue (DLQ) mechanism for failed asynchronous background jobs in the YieldVault RWA backend.

---

## 1. Architecture Overview

Asynchronous background jobs (such as price refreshes, position reconciliations, report exports, database backups, and APY snapshots) execute according to configured retry and backoff policies in `jobGovernance.ts`.

When job execution attempts exhaust their policy maximums (`maxAttempts`), the system captures a **Dead-Letter Record** containing the failure payload, error message, and execution metadata, preventing silent job failures and enabling administrative inspection and replay.

```
+------------------+         Retry Exhausted          +-----------------------+
|  Async Job Task  |  ----------------------------->  |   JobGovernanceStore  |
|  (runJobWithRetry)                                  |   Record Dead-Letter  |
+------------------+                                  +-----------------------+
                                                                  |
                                                                  v
+---------------------------------------------------------------------------------+
|                              Dead-Letter Queue                                  |
|   Status: 'dead-letter' | 'processing' | 'requeued' | 'resolved' | 'discarded'  |
+---------------------------------------------------------------------------------+
          |                                   |                              |
          v                                   v                              v
+-------------------+               +-------------------+          +-------------------+
|  Retry / Requeue  |               |  Manual Resolve   |          |  Discard Record   |
| (Single/Bulk/Proc)|               | (Notes & Audited) |          | (Single / Bulk)   |
+-------------------+               +-------------------+          +-------------------+
```

---

## 2. Job Policies & Dead-Letter Thresholds

Each background job type is configured with explicit governance parameters in `JOB_POLICIES`:

| Job Name | Max Attempts | Base Delay | Backoff Multiplier | DLQ Alert Threshold |
| :--- | :--- | :--- | :--- | :--- |
| `priceRefresh` | 3 | 1,000 ms | 2x | 3 failures |
| `positionReconciliation` | 4 | 2,000 ms | 2x | 2 failures |
| `reportGeneration` | 5 | 5,000 ms | 2x | 2 failures |
| `databaseBackup` | 3 | 10,000 ms | 2x | 2 failures |
| `apySnapshot` | 3 | 1,000 ms | 2x | 3 failures |

---

## 3. Dead-Letter Record Structure

Each dead-letter record tracks the complete execution lifecycle:

```typescript
export interface DeadLetterRecord {
  id: string;                                   // Unique ID (e.g., dlq_1719234_a1b2c3d4)
  jobName: JobName;                            // Job type identifier
  attempts: number;                            // Total failed attempts before DLQ
  error: string;                               // Normalized error message
  payload: unknown;                            // Original task payload
  failedAt: string;                            // ISO 8601 timestamp of failure
  status: 'dead-letter' | 'processing' |       // Current queue status
          'requeued' | 'resolved' | 'discarded';
  retriedAt?: string;                          // Timestamp of last retry attempt
  resolvedAt?: string;                         // Timestamp of resolution
  resolvedBy?: string;                         // Admin wallet/ID who resolved
  notes?: string;                              // Operator notes
}
```

---

## 4. Admin Management REST API

All DLQ management routes require API Key authentication (`validateApiKey`) and log immutable audit trail events.

### Endpoints Overview

#### 1. List Dead Letters
- **GET** `/admin/jobs/dead-letters`
- **Query Params**:
  - `jobName`: Filter by job type (e.g. `priceRefresh`, `databaseBackup`)
  - `status`: Filter by status (`dead-letter`, `requeued`, `resolved`, `discarded`)
  - `limit`: Number of records (default 50, max 500)
  - `offset`: Pagination offset
- **Response**: `{ data: DeadLetterRecord[], total: number, limit: number, offset: number, timestamp: string }`

#### 2. Get Single Dead Letter
- **GET** `/admin/jobs/dead-letters/:id`
- **Response**: `{ record: DeadLetterRecord, timestamp: string }`

#### 3. Retry Single Dead Letter
- **POST** `/admin/jobs/dead-letters/:id/retry`
- **Query Params**: `?dryRun=true` (optional preview)
- **Response**: `{ message: string, result?: unknown, record: DeadLetterRecord }`

#### 4. Resolve Dead Letter
- **POST** `/admin/jobs/dead-letters/:id/resolve`
- **Body**: `{ "notes": "Optional operator resolution explanation" }`
- **Response**: `{ message: string, record: DeadLetterRecord }`

#### 5. Discard Dead Letter
- **DELETE** `/admin/jobs/dead-letters/:id`
- **Query Params**: `?dryRun=true` (optional preview)
- **Response**: `{ message: string, record: DeadLetterRecord }`

#### 6. Bulk Retry Dead Letters
- **POST** `/admin/jobs/dead-letters/bulk-retry`
- **Body**: `{ "ids": ["dlq_1", "dlq_2"] }`
- **Response**: `{ message: string, retried: number, failed: number, results: Array<{ id: string, success: boolean }> }`

#### 7. Bulk Discard Dead Letters
- **POST** `/admin/jobs/dead-letters/bulk-discard`
- **Body**: `{ "ids": ["dlq_1", "dlq_2"] }`
- **Response**: `{ message: string, discardedCount: number, ids: string[] }`

#### 8. Run DLQ Batch Processor Worker
- **POST** `/admin/jobs/dead-letters/process`
- **Body**: `{ "batchSize": 10 }`
- **Response**: `{ message: string, batchSize: number, processed: number, succeeded: number, failed: number }`

---

## 5. Operator Runbook

1. **Monitoring Alerts**: If job health degrades (`getJobHealthStatus() === 'degraded'`), query `GET /admin/jobs/metrics` to identify the failing job type.
2. **Inspecting Failures**: Query `GET /admin/jobs/dead-letters?status=dead-letter` to view details of failed jobs and error root causes.
3. **Replaying Failures**: After fixing downstream issues (e.g. database connection or external API rate limit), run `POST /admin/jobs/dead-letters/process` or `POST /admin/jobs/dead-letters/bulk-retry` to replay queued jobs.
4. **Resolution Audit**: If a failed job was addressed manually without replaying, use `POST /admin/jobs/dead-letters/:id/resolve` with explanation notes for compliance auditing.
