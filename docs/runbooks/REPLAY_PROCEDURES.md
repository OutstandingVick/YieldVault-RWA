# Operational Runbook: Replay and State Recovery Procedures

This runbook documents the procedures for manually replaying **ledger events** and **email queue items** in the YieldVault platform. Manual replays are typically performed during recovery from database restoration, RPC node sync lag, queue delivery failure, or to fix data inconsistencies.

---

## 1. Ledger Event Replay Procedure

Stellar blockchain event ingestion is handled automatically by the [EventPollingService](file:///Users/apple/YieldVault-RWA/backend/src/eventPollingService.ts). If the service is restarted, it automatically replays missed events from the last recorded cursor sequence to the current network ledger. 

However, if there is a data corruption event or database restore, operators can trigger a manual range replay.

### 1.1 Prerequisites
- **Admin API Key:** You must have an API key with the `admin` or `super-admin` role.
- **Ledger Sequence Numbers:** You need to know the target `fromLedger` and `toLedger` sequences.
- **Maximum Range Limit:** By default, manual replays are limited to `1000` ledgers per request to prevent overloading (configured via `EVENT_REPLAY_MAX_RANGE_SIZE`).

### 1.2 Step 1: Run a Dry-Run Preview
Always perform a dry-run first to validate your request schema and preview the range boundaries.

```bash
curl -X POST http://localhost:3000/admin/events/replay \
  -H "Authorization: ApiKey YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fromLedger": 152000,
    "toLedger": 152500,
    "dryRun": true
  }'
```

**Expected Response (200 OK):**
```json
{
  "dryRun": true,
  "message": "Event replay dry-run preview",
  "fromLedger": 152000,
  "toLedger": 152500,
  "ledgerCount": 501,
  "wouldReplay": true,
  "timestamp": "2026-06-26T18:00:00.000Z"
}
```

### 1.3 Step 2: Execute the Replay
Omit the `dryRun` flag or set it to `false` to execute the actual database updates and event reprocessing.

```bash
curl -X POST http://localhost:3000/admin/events/replay \
  -H "Authorization: ApiKey YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fromLedger": 152000,
    "toLedger": 152500
  }'
```

**Expected Response (200 OK):**
```json
{
  "message": "Event replay completed successfully",
  "fromLedger": 152000,
  "toLedger": 152500,
  "processedCount": 12,
  "duplicateCount": 489
}
```
*Note: `processedCount` tracks newly processed events; `duplicateCount` tracks events already processed and skipped due to idempotency verification.*

### 1.4 Step 3: Verification
1. **Monitor Server Logs:** Check the server logs for processed event logs:
   ```bash
   tail -n 100 /var/log/yieldvault/backend.log | grep -i "Event processed"
   ```
2. **Verify in Database:** Query the database using `psql` to check the updated events cursor and processed events count:
   ```sql
   -- Verify the current cursor
   SELECT * FROM "EventCursor" WHERE id = 1;

   -- Check recently processed events in range
   SELECT COUNT(*), "eventType" FROM "ProcessedEvent" 
   WHERE "ledgerSeq" >= 152000 AND "ledgerSeq" <= 152500 
   GROUP BY "eventType";
   ```

### 1.5 Troubleshooting Ledger Replays
* **API_400_EVENT_REPLAY (HTTP 400 Bad Request):** Occurs if `fromLedger` > `toLedger`, values are negative, or parameters are missing.
* **Ledger Range Too Large:** If you exceed the maximum allowed size (e.g. 1000 ledgers), split the request into smaller chunks (e.g., 152000–152499, and 152500–152999).

---

## 2. Email Queue Replay Procedure

When the system fails to deliver system notifications (such as deposit confirmations), failed jobs are placed in a queue. If an email fails repeatedly, it can be manually replayed.

### 2.1 Prerequisites
- **Admin API Key:** Authorization via `Authorization: ApiKey <api-key>`.
- **Email ID:** The UUID of the failed email record in the database.

### 2.2 Step 1: Identify Failed Emails
Find the IDs of failed emails that need recovery:
```bash
# Get failed emails via local query
psql $DATABASE_URL -c "SELECT id, recipient, subject, status, \"retryCount\" FROM \"EmailQueue\" WHERE status = 'failed' LIMIT 10;"
```

### 2.3 Step 2: Trigger Replay
Send a POST request to the replay endpoint using the specific email ID:

```bash
curl -X POST http://localhost:3000/admin/emails/replay/YOUR_EMAIL_UUID \
  -H "Authorization: ApiKey YOUR_ADMIN_API_KEY"
```

**Expected Response (200 OK):**
```json
{
  "message": "Email requeued successfully",
  "email": {
    "id": "YOUR_EMAIL_UUID",
    "status": "pending",
    "retryCount": 0,
    "lastError": null
  }
}
```

### 2.4 Step 3: Verification
Check the queue worker status or query the database to ensure the email was picked up and sent:
```sql
SELECT status, "retryCount", "lastError" FROM "EmailQueue" WHERE id = 'YOUR_EMAIL_UUID';
```
If successfully sent, the status changes to `sent`.
