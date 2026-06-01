import crypto from 'crypto';
import { prisma } from './prisma';

export interface AdminActionReceipt {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  inputHash: string;
  resultingState: Record<string, unknown>;
  signature: string;
}

const RECEIPT_SECRET = process.env.ADMIN_ACTION_RECEIPT_SECRET || 'dev-receipt-secret-change-me';

/**
 * Generates an immutable, signed receipt for a critical admin action.
 */
export async function generateAdminReceipt(params: {
  action: string;
  actor: string;
  input: unknown;
  resultingState: Record<string, unknown>;
}): Promise<AdminActionReceipt> {
  const { action, actor, input, resultingState } = params;
  const timestamp = new Date().toISOString();
  
  // 1. Calculate input hash
  const inputHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex');

  // 2. Prepare payload for signing
  const payload = {
    action,
    actor,
    timestamp,
    inputHash,
    resultingState,
  };

  // 3. Generate HMAC signature
  const signature = crypto
    .createHmac('sha256', RECEIPT_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  // 4. Persist to database
  const record = await prisma.adminActionReceipt.create({
    data: {
      action,
      actor,
      timestamp: new Date(timestamp),
      inputHash,
      resultingState: JSON.stringify(resultingState),
      signature,
    },
  });

  return {
    id: record.id,
    action: record.action,
    actor: record.actor,
    timestamp: record.timestamp.toISOString(),
    inputHash: record.inputHash,
    resultingState: resultingState,
    signature: record.signature,
  };
}

/**
 * Verifies the integrity of a receipt signature.
 */
export function verifyReceiptSignature(receipt: AdminActionReceipt): boolean {
  const payload = {
    action: receipt.action,
    actor: receipt.actor,
    timestamp: receipt.timestamp,
    inputHash: receipt.inputHash,
    resultingState: receipt.resultingState,
  };

  const expectedSignature = crypto
    .createHmac('sha256', RECEIPT_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  const providedBuffer = Buffer.from(receipt.signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Retrieves a receipt by ID.
 */
export async function getAdminReceipt(id: string): Promise<AdminActionReceipt | null> {
  const record = await prisma.adminActionReceipt.findUnique({
    where: { id },
  });

  if (!record) return null;

  return {
    id: record.id,
    action: record.action,
    actor: record.actor,
    timestamp: record.timestamp.toISOString(),
    inputHash: record.inputHash,
    resultingState: JSON.parse(record.resultingState),
    signature: record.signature,
  };
}

/**
 * Lists receipts with filters.
 */
export async function listAdminReceipts(filters: {
  action?: string;
  actor?: string;
  limit?: number;
}): Promise<AdminActionReceipt[]> {
  const records = await prisma.adminActionReceipt.findMany({
    where: {
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.actor ? { actor: filters.actor } : {}),
    },
    orderBy: {
      timestamp: 'desc',
    },
    take: filters.limit || 50,
  });

  return records.map((record) => ({
    id: record.id,
    action: record.action,
    actor: record.actor,
    timestamp: record.timestamp.toISOString(),
    inputHash: record.inputHash,
    resultingState: JSON.parse(record.resultingState),
    signature: record.signature,
  }));
}
