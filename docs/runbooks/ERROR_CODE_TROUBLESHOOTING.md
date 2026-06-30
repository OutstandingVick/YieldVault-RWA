# Backend Error Code Troubleshooting Cookbook

**Purpose:** Step-by-step guide to diagnose and fix common backend errors  
**Last Updated:** June 30, 2026  
**Maintained By:** Backend Team

---

## Overview

This cookbook maps backend error codes (from REST API, Soroban contracts, and internal systems) to:
- Likely causes
- Step-by-step troubleshooting procedures
- Fixes and workarounds

For reference on error codes, see [API Error Code Catalog](../api/ERROR_CODE_CATALOG.md).

---

## Table of Contents

1. [Client Errors (4xx)](#1-client-errors-4xx)
2. [Server Errors (5xx)](#2-server-errors-5xx)
3. [Soroban Contract Errors](#3-soroban-contract-errors)
4. [Internal System Errors](#4-internal-system-errors)
5. [Quick Reference](#5-quick-reference)

---

## 1. Client Errors (4xx)

### API_400_VALIDATION (Validation Failed)
**Error Pattern:** Zod validation failed with `details` array  
**HTTP Status:** 400 Bad Request

#### Likely Causes
- Missing required fields in request
- Invalid data types (string instead of number, etc.)
- Values out of allowed range
- Malformed JSON body

#### Troubleshooting Steps
1. **Check error details**
   ```bash
   # Look at the `details` array in the error response
   curl -X POST <endpoint> -d <payload> | jq .details
   ```
   The `details` array contains field-specific errors:
   ```json
   [{"field": "amount", "message": "Amount must be positive"}]
   ```

2. **Verify request against OpenAPI schema**
   ```bash
   # Check backend/src/schemas for validation rules
   ls backend/src/schemas
   ```

3. **Fix the request payload**
   - Ensure all required fields are present
   - Correct data types
   - Respect min/max constraints

---

### API_400_SANITIZATION (Sanitization Failed)
**Error Pattern:** Invalid or unsafe input detected  
**HTTP Status:** 400 Bad Request

#### Likely Causes
- Prototype pollution attempts
- XSS payloads
- Out-of-range integers
- Malformed strings

#### Troubleshooting Steps
1. **Inspect request payload**
   ```bash
   # Log the full request (in non-production)
   cat backend/logs/requests.log | grep <correlation-id>
   ```

2. **Remove forbidden patterns**
   - Remove fields starting with `__` or `constructor`
   - Sanitize user-generated content
   - Ensure numeric values are within safe integer range

---

### API_401_BEARER (Bearer Token Missing/Invalid)
**Error Pattern:** Missing or malformed Authorization header  
**HTTP Status:** 401 Unauthorized

#### Likely Causes
- No Authorization header sent
- Header format is incorrect (not `Bearer <token>`)
- Token expired
- Token revoked

#### Troubleshooting Steps
1. **Verify header format**
   ```bash
   # Check if header is present and correct
   curl -v -H "Authorization: Bearer <token>" <endpoint>
   ```
   The header should look exactly like:
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. **Check token validity**
   ```bash
   # Inspect token (without secret, just payload)
   echo "<token>" | cut -d '.' -f2 | base64 -d | jq .
   # Check `exp` field for expiration
   ```

3. **Refresh token**
   ```bash
   # Use refresh token to get new access token
   curl -X POST /auth/refresh -d '{"refreshToken": "<refresh-token>"}'
   ```

---

### API_401_API_KEY (API Key Missing/Invalid)
**Error Pattern:** Invalid API key for admin endpoints  
**HTTP Status:** 401 Unauthorized

#### Likely Causes
- No `Authorization: ApiKey <key>` header
- Wrong API key provided
- API key revoked or expired

#### Troubleshooting Steps
1. **Check admin database for key**
   ```sql
   -- Verify key exists and is active
   SELECT id, name, active FROM api_keys WHERE key_hash = '<key-hash>';
   ```

2. **Regenerate API key if needed**
   - Use admin panel to rotate key
   - Update integrations with new key

---

### API_403_ALLOWLIST_MISSING (Allowlist Header Missing)
**Error Pattern:** Wallet required for private beta  
**HTTP Status:** 403 Forbidden

#### Likely Causes
- `x-wallet-address` header not sent
- Wallet not in allowlist

#### Troubleshooting Steps
1. **Check allowlist entry**
   ```sql
   SELECT * FROM allowlist WHERE wallet_address = '<wallet-address>';
   ```

2. **Add wallet to allowlist**
   ```bash
   curl -X POST /admin/allowlist \
     -H "Authorization: ApiKey <admin-key>" \
     -d '{"walletAddress": "<wallet-address>"}'
   ```

---

### API_403_ALLOWLIST_DENIED (Wallet Not Allowlisted)
**Error Pattern:** Wallet not found in allowlist  
**HTTP Status:** 403 Forbidden

#### Troubleshooting Steps
1. **Verify wallet address format**
   - Must start with `G`
   - 56 characters long
   - Valid Stellar public key

2. **Check allowlist status**
   ```sql
   SELECT * FROM allowlist WHERE wallet_address = '<wallet-address>';
   ```

3. **Request access** if needed

---

### API_404_ROUTE (Route Not Found)
**Error Pattern:** `${method} ${path} not found`  
**HTTP Status:** 404 Not Found

#### Likely Causes
- Typo in URL path
- Wrong HTTP method (POST instead of GET, etc.)
- Endpoint removed or deprecated

#### Troubleshooting Steps
1. **Check backend routes**
   ```bash
   # List all registered routes
   cat backend/src/index.ts | grep -E 'app\.(get|post|put|delete|patch)'
   ```

2. **Verify path and method**
   - Ensure path matches exactly (case-sensitive)
   - Use correct HTTP verb

---

### API_409_IDEMPOTENCY (Idempotency Conflict)
**Error Pattern:** Idempotency key reused with different body  
**HTTP Status:** 409 Conflict

#### Likely Causes
- Same idempotency key used for different requests
- Request body changed between retries

#### Troubleshooting Steps
1. **Check idempotency store**
   ```sql
   SELECT * FROM idempotency_keys WHERE key = '<key>';
   ```

2. **Fix request**
   - Use new idempotency key for new requests
   - Use identical body if retrying same request

---

### API_429_RATE_LIMIT (Rate Limit Exceeded)
**Error Pattern:** Too many requests; includes `Retry-After` header  
**HTTP Status:** 429 Too Many Requests

#### Likely Causes
- IP or API key making too many requests
- Burst traffic above configured limit

#### Troubleshooting Steps
1. **Honor Retry-After header**
   ```bash
   # Wait the specified number of seconds
   sleep $(curl -s -o /dev/null -w "%{header_retry_after}" <endpoint>)
   ```

2. **Implement exponential backoff**
   - Wait 1s, 2s, 4s, 8s, etc. between retries

3. **Check rate limit config**
   ```bash
   # Look for rate limit settings in .env
   cat backend/.env | grep RATE_LIMIT
   ```

---

### API_451_GEOFENCE (Geographically Blocked)
**Error Pattern:** Jurisdiction blocklisted; includes `country` field  
**HTTP Status:** 451 Unavailable For Legal Reasons

#### Troubleshooting Steps
1. **Check geofence rules**
   ```sql
   SELECT * FROM geofence_rules;
   ```

2. **Verify user's country**
   - Check `X-Client-Country` header (from Cloudflare or similar)

---

## 2. Server Errors (5xx)

### API_500_GENERIC (Internal Server Error)
**Error Pattern:** Unhandled exception; includes `correlationId`  
**HTTP Status:** 500 Internal Server Error

#### Likely Causes
- Prisma/Database errors
- Unhandled exceptions in code
- Network issues to external services

#### Troubleshooting Steps
1. **Find logs by correlation ID**
   ```bash
   # Search backend logs for the correlationId
   grep -r "<correlation-id>" /var/log/yieldvault/
   ```

2. **Check database connection**
   ```bash
   # Test database connectivity
   psql -h <db-host> -U <db-user> -d <db-name> -c "SELECT 1;"
   ```

3. **Check health endpoint**
   ```bash
   curl -s http://localhost:3000/health | jq .
   ```

4. **Redeploy backend** if needed (see [Backend Redeploy](./BACKEND_REDEPLOY.md))

---

### API_500_VAULT_OP (Vault Operation Failed)
**Error Pattern:** Vault deposit/withdrawal failed after idempotency check  
**HTTP Status:** 500 Internal Server Error

#### Likely Causes
- Soroban contract errors
- RPC connection issues
- Gas fee estimation failures
- Wallet sequence number issues

#### Troubleshooting Steps
1. **Check Stellar transaction status**
   - Use Stellar Explorer to look up transaction hash (if logged)
   - Verify transaction succeeded or failed on-chain

2. **Check Soroban RPC connectivity**
   ```bash
   curl -X POST <rpc-url> \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
   ```
   (see [RPC Failover](./RPC_FAILOVER.md) for more)

3. **Check contract error code** (see [Soroban Contract Errors](#3-soroban-contract-errors))

---

### API_500_LIST (List Endpoint Failed)
**Error Pattern:** Failed to fetch transactions, portfolio, etc.  
**HTTP Status:** 500 Internal Server Error

#### Troubleshooting Steps
1. **Check database query performance**
   ```sql
   -- Enable query logging temporarily
   SET log_statement = 'all';
   -- Run problematic query and check execution plan
   EXPLAIN ANALYZE SELECT * FROM transactions WHERE ...;
   ```

2. **Verify database indexes exist**
   ```sql
   SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'transactions';
   ```

---

### API_503_MAINTENANCE (Maintenance Mode)
**Error Pattern:** Maintenance mode active; includes `maintenanceMode`  
**HTTP Status:** 503 Service Unavailable

#### Troubleshooting Steps
1. **Wait for maintenance to complete**
2. **Check maintenance status**
   ```bash
   curl -s http://localhost:3000/health | jq .checks.maintenance
   ```

3. **Disable maintenance mode** (if authorized)
   ```bash
   curl -X POST /admin/maintenance \
     -H "Authorization: ApiKey <admin-key>" \
     -d '{"enabled": false}'
   ```

---

### API_503_SOROBAN_CIRCUIT (Soroban Circuit Breaker Open)
**Error Pattern:** Soroban RPC circuit open; includes `retryAfterMs`  
**HTTP Status:** 503 Service Unavailable

#### Troubleshooting Steps
1. **Check circuit breaker state**
   ```bash
   # Look at application logs
   tail -100 /var/log/yieldvault/backend.log | grep -i circuit
   ```

2. **Failover to backup RPC** (see [RPC Failover](./RPC_FAILOVER.md))

3. **Wait for circuit to close automatically**
   - Typically 30-60 seconds

---

## 3. Soroban Contract Errors

### Error 1: AlreadyInitialized
**Error Pattern:** `initialize` called twice  
**Troubleshooting:** Contract is already deployed, use operational methods only

---

### Error 2: InsufficientShares
**Error Pattern:** Withdrawing more shares than user owns  
**Troubleshooting:**
1. Check user's share balance first
2. Reduce withdrawal amount to available shares

---

### Error 3: InvalidAmount
**Error Pattern:** Zero/negative amount or amount too small  
**Troubleshooting:**
1. Increase deposit amount above `min_deposit`
2. Read contract config to see minimum:
   ```bash
   curl -s /api/v1/vault/config | jq .minDeposit
   ```

---

### Error 4: ContractPaused
**Error Pattern:** Any user op while contract is paused  
**Troubleshooting:**
1. Wait for admin to unpause
2. Check pause status:
   ```bash
   curl -s /api/v1/vault/status | jq .paused
   ```

---

### Error 5: ExceedsUserCap
**Error Pattern:** Deposit exceeds per-user cap  
**Troubleshooting:**
1. Reduce deposit amount
2. Request cap increase from admin

---

### Error 6: MinDepositNotMet
**Error Pattern:** Deposit below configured minimum  
**Troubleshooting:**
1. Check min deposit:
   ```bash
   curl -s /api/v1/vault/config | jq .minDeposit
   ```
2. Deposit at least that amount

---

### Error 7: TimelockNotExpired
**Error Pattern:** Executing withdrawal before 24h timelock  
**Troubleshooting:**
1. Check unlock timestamp
2. Wait until timelock expires

---

### Error 8: NoPendingWithdrawal
**Error Pattern:** Executing withdrawal with no pending record  
**Troubleshooting:**
1. First call `withdraw` to create pending record
2. Wait for timelock, then call `execute_withdrawal`

---

### Error 14: MathOverflow
**Error Pattern:** Arithmetic overflow guard triggered  
**Troubleshooting:**
1. Reduce amounts
2. Check if amount is within supported range

---

## 4. Internal System Errors

### Prisma Errors
**Error Patterns:**
- `PrismaClientKnownRequestError` with code `P2002` (unique constraint violation)
- `P2025` (record not found)

**Troubleshooting Steps:**
1. Look up Prisma error code in [Prisma docs](https://www.prisma.io/docs/reference/api-reference/error-reference)
2. Handle specific error cases in code
3. Check database schema and constraints

---

### Soroban Simulation Errors
**Error Codes (from backend/src/sorobanClient.ts):**
- `SIMULATION_ERROR`: Contract simulation failed
- `RESTORE_REQUIRED`: Contract state needs restore
- `SUBMISSION_FAILED`: Transaction submission failed
- `RPC_ERROR`: Stellar RPC returned error
- `INTERNAL_ERROR`: Unexpected wrapper error

**Troubleshooting Steps:**
1. Check simulation error details for contract error code
2. Verify contract arguments are correct
3. Ensure contract is deployed and initialized
4. Check RPC health (see [RPC Failover](./RPC_FAILOVER.md))

---

## 5. Quick Reference

### Decision Tree
```
Error occurred?
├─ 4xx → Client error - check request (headers, body, auth)
├─ 5xx → Server error - check logs by correlationId
└─ Contract error → Check contract error code table

For 500 errors:
1. Get correlationId from response
2. Search logs for that ID
3. Follow specific troubleshooting steps for error pattern
```

### Most Common Fixes
| Error | Quick Fix |
|-------|-----------|
| API_401_BEARER | Refresh auth token |
| API_401_API_KEY | Check API key in admin panel |
| API_429_RATE_LIMIT | Wait Retry-After seconds |
| API_503_SOROBAN_CIRCUIT | Failover RPC (see [RPC Failover](./RPC_FAILOVER.md)) |
| API_500_GENERIC | Search logs by correlationId |

---

## Related Documentation

- [API Error Code Catalog](../api/ERROR_CODE_CATALOG.md)
- [API Error Format](../api/ERROR_FORMAT.md)
- [RPC Failover Runbook](./RPC_FAILOVER.md)
- [Backend Redeploy Runbook](./BACKEND_REDEPLOY.md)
- [Contract Upgrade Playbook](./CONTRACT_UPGRADE_PLAYBOOK.md)

---

**Next Review:** September 30, 2026
