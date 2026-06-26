import { getPrismaClient } from './prismaClient';
import { logger } from './middleware/structuredLogging';

const prisma = getPrismaClient();

export interface BackfillRequest {
  startLedger: number;
  endLedger: number;
  rpcUrl: string;
  contractId: string;
  batchSize?: number;
  dryRun?: boolean;
}

export interface BackfillProgress {
  totalLedgers: number;
  missingLedgers: number;
  scannedLedgers: number;
  insertedEvents: number;
  duplicateEvents: number;
}

export interface BackfillJob {
  id: string;
  key: string;
  startLedger: number;
  endLedger: number;
  batchSize: number;
  dryRun: boolean;
  status: 'running' | 'completed' | 'failed';
  progress: BackfillProgress;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

interface StellarEvent {
  id: string;
  type: string;
  ledger: number;
  contractId: string;
  txHash: string;
}

const jobs = new Map<string, BackfillJob>();
const jobsByKey = new Map<string, string>();

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 500;
const MAX_LEDGER_RANGE = 20000;

function nowIso(): string {
  return new Date().toISOString();
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function jobKey(input: BackfillRequest): string {
  return `${input.contractId}:${input.startLedger}-${input.endLedger}:${input.dryRun ? 'dry' : 'live'}`;
}

async function fetchEventsForRange(
  rpcUrl: string,
  contractId: string,
  startLedger: number,
  endLedger: number
): Promise<StellarEvent[]> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getEvents',
      params: {
        startLedger,
        filters: [
          {
            type: 'contract',
            contractIds: [contractId],
          },
        ],
        pagination: {
          limit: 1000,
        },
      },
    }),
  });

  const body = await response.json();
  const events = body?.result?.events ?? [];

  return events
    .filter((event: any) => event.ledger >= startLedger && event.ledger <= endLedger)
    .map((event: any) => ({
      id: String(event.id),
      type: String(event.type || 'unknown'),
      ledger: Number(event.ledger || 0),
      contractId: String(event.contractId || contractId),
      txHash: String(event.txHash || ''),
    }));
}

async function getMissingLedgers(startLedger: number, endLedger: number): Promise<number[]> {
  const rows = await prisma.processedEvent.findMany({
    where: {
      ledgerSeq: {
        gte: startLedger,
        lte: endLedger,
      },
    },
    select: { ledgerSeq: true },
  });

  const indexed = new Set(rows.map((row) => row.ledgerSeq));
  const missing: number[] = [];

  for (let ledger = startLedger; ledger <= endLedger; ledger += 1) {
    if (!indexed.has(ledger)) {
      missing.push(ledger);
    }
  }

  return missing;
}

function createJob(input: BackfillRequest, key: string, missingLedgers: number[], batchSize: number): BackfillJob {
  const createdAt = nowIso();
  return {
    id: `bf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    key,
    startLedger: input.startLedger,
    endLedger: input.endLedger,
    batchSize,
    dryRun: Boolean(input.dryRun),
    status: 'running',
    progress: {
      totalLedgers: input.endLedger - input.startLedger + 1,
      missingLedgers: missingLedgers.length,
      scannedLedgers: 0,
      insertedEvents: 0,
      duplicateEvents: 0,
    },
    createdAt,
    updatedAt: createdAt,
  };
}

function touchJob(job: BackfillJob): void {
  job.updatedAt = nowIso();
  jobs.set(job.id, job);
}

export async function createOrResumeTransactionBackfill(input: BackfillRequest): Promise<BackfillJob> {
  if (!Number.isInteger(input.startLedger) || !Number.isInteger(input.endLedger)) {
    throw new Error('startLedger and endLedger must be integers');
  }
  if (input.startLedger <= 0 || input.endLedger <= 0) {
    throw new Error('startLedger and endLedger must be greater than 0');
  }
  if (input.endLedger < input.startLedger) {
    throw new Error('endLedger must be greater than or equal to startLedger');
  }

  const range = input.endLedger - input.startLedger + 1;
  if (range > MAX_LEDGER_RANGE) {
    throw new Error(`ledger range exceeds maximum of ${MAX_LEDGER_RANGE}`);
  }

  const batchSize = Math.min(Math.max(input.batchSize || DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE);
  const key = jobKey(input);
  const previousId = jobsByKey.get(key);

  if (previousId) {
    const existing = jobs.get(previousId);
    if (existing && existing.status !== 'failed') {
      return existing;
    }
  }

  const missingLedgers = await getMissingLedgers(input.startLedger, input.endLedger);
  const job = createJob(input, key, missingLedgers, batchSize);
  jobs.set(job.id, job);
  jobsByKey.set(key, job.id);

  try {
    if (!input.dryRun && missingLedgers.length > 0) {
      for (const ledgerChunk of chunk(missingLedgers, batchSize)) {
        const startLedger = ledgerChunk[0];
        const endLedger = ledgerChunk[ledgerChunk.length - 1];
        const events = await fetchEventsForRange(
          input.rpcUrl,
          input.contractId,
          startLedger,
          endLedger
        );

        for (const event of events) {
          const result = await prisma.processedEvent.upsert({
            where: { id: event.id },
            update: {},
            create: {
              id: event.id,
              ledgerSeq: event.ledger,
              eventType: event.type,
              contractId: event.contractId,
              txHash: event.txHash,
            },
          });

          if (result.id) {
            job.progress.insertedEvents += 1;
          }
        }

        job.progress.scannedLedgers += ledgerChunk.length;
        touchJob(job);
      }
    } else {
      job.progress.scannedLedgers = job.progress.missingLedgers;
      touchJob(job);
    }

    job.status = 'completed';
    touchJob(job);
    return job;
  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : String(error);
    touchJob(job);

    logger.log('error', 'Transaction backfill failed', {
      jobId: job.id,
      error: job.error,
      startLedger: job.startLedger,
      endLedger: job.endLedger,
    });

    return job;
  }
}

export function getTransactionBackfillJob(jobId: string): BackfillJob | null {
  return jobs.get(jobId) || null;
}

export function listTransactionBackfillJobs(limit: number = 20): BackfillJob[] {
  return Array.from(jobs.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, Math.max(1, Math.min(limit, 200)));
}

export function resetTransactionBackfillJobsForTests(): void {
  jobs.clear();
  jobsByKey.clear();
}
