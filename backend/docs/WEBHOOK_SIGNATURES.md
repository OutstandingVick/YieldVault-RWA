# Webhook Signature Verification

YieldVault signs outbound webhook payloads with `HMAC-SHA256` whenever a webhook endpoint is configured with a secret.

## Signature Contract

- Header: `X-YieldVault-Signature`
- Algorithm: `HMAC-SHA256`
- Encoding: lowercase hexadecimal
- Input: the exact JSON request body sent by YieldVault

For a delivery body like:

```json
{
  "eventType": "transaction.deposit.created",
  "sentAt": "2026-05-26T00:00:00.000Z",
  "payload": {
    "transactionId": "tx_123",
    "amount": "125.00",
    "asset": "USDC",
    "walletAddress": "G...",
    "transactionHash": "0xabc",
    "status": "pending",
    "timestamp": "2026-05-26T00:00:00.000Z"
  }
}
```

Compute the signature from the raw body bytes using your shared secret:

```ts
import crypto from 'crypto';

function verifyYieldVaultWebhook(rawBody: string, secret: string, providedSignature: string) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(providedSignature, 'utf8'),
    Buffer.from(expectedSignature, 'utf8'),
  );
}
```

## Test Endpoint

Use `POST /webhooks/verify` before going live to confirm your secret produces the expected signature.

Request body:

```json
{
  "secret": "your-shared-secret",
  "payload": {
    "eventType": "transaction.deposit.created",
    "payload": {
      "transactionId": "tx_123"
    }
  },
  "signature": "optional-signature-to-verify"
}
```

Response body:

```json
{
  "algorithm": "HMAC-SHA256",
  "signature": "computed-hex-signature",
  "verified": true
}
```

If you omit `signature`, YieldVault returns the computed signature and sets `verified` to `null`.