import crypto from 'crypto';
import type { WebhookDelivery as PrismaWebhookDelivery, WebhookEndpoint as PrismaWebhookEndpoint } from '@prisma/client';
import { prisma } from './prisma';

export type TransactionEventType =
  | 'transaction.deposit.created'
  | 'transaction.withdrawal.created';

export interface TransactionEventPayload {
  transactionId: string;
  amount: string;
  asset: string;
  walletAddress: string;
  transactionHash: string;
  status: string;
  timestamp: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  eventTypes: TransactionEventType[];
  enabled: boolean;
  hasSecret: boolean;
  createdAt: string;
  updatedAt: string;
}

interface InternalWebhookEndpoint {
  id: string;
  url: string;
  eventTypes: TransactionEventType[];
  enabled: boolean;
  secret?: string;
  secretHash?: string;
  createdAt: string;
  updatedAt: string;
}

export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed';

export interface WebhookDeliveryRecord {
  id: string;
  endpointId: string;
  endpointUrl: string;
  eventType: TransactionEventType;
  status: WebhookDeliveryStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  lastError?: string;
}

export interface WebhookDeliveryPage {
  deliveries: WebhookDeliveryRecord[];
  nextCursor?: string;
  hasNextPage: boolean;
}

interface RegisterWebhookInput {
  url: string;
  eventTypes?: TransactionEventType[];
  enabled?: boolean;
  secret?: string;
}

interface UpdateWebhookInput {
  enabled?: boolean;
  eventTypes?: TransactionEventType[];
  secret?: string;
}

const defaultEventTypes: TransactionEventType[] = [
  'transaction.deposit.created',
  'transaction.withdrawal.created',
];

const maxAttempts = parseInt(process.env.WEBHOOK_MAX_ATTEMPTS || '3', 10);
const deliveryTimeoutMs = parseInt(process.env.WEBHOOK_DELIVERY_TIMEOUT_MS || '5000', 10);
const retryBaseDelayMs = parseInt(process.env.WEBHOOK_RETRY_BASE_DELAY_MS || '500', 10);
const deliveryRetention = parseInt(process.env.WEBHOOK_DELIVERY_RETENTION || '200', 10);

export async function registerWebhookEndpoint(input: RegisterWebhookInput): Promise<WebhookEndpoint> {
  assertValidWebhookUrl(input.url);

  const eventTypes = resolveEventTypes(input.eventTypes);
  const created = await prisma.webhookEndpoint.create({
    data: {
      id: `wh_${crypto.randomBytes(6).toString('hex')}`,
      url: input.url,
      eventTypes: serializeEventTypes(eventTypes),
      enabled: input.enabled ?? true,
      secret: input.secret ?? null,
      secretHash: input.secret ? hashWebhookSecret(input.secret) : null,
    },
  });

  return sanitizeWebhookEndpoint(mapInternalEndpoint(created));
}

export async function updateWebhookEndpoint(
  id: string,
  input: UpdateWebhookInput,
): Promise<WebhookEndpoint | null> {
  const existing = await prisma.webhookEndpoint.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }

  if (input.eventTypes && input.eventTypes.length === 0) {
    throw new Error('eventTypes cannot be empty');
  }

  const updated = await prisma.webhookEndpoint.update({
    where: { id },
    data: {
      enabled: typeof input.enabled === 'boolean' ? input.enabled : undefined,
      eventTypes: input.eventTypes ? serializeEventTypes(input.eventTypes) : undefined,
      secret: typeof input.secret === 'string' ? input.secret : undefined,
      secretHash: typeof input.secret === 'string' ? hashWebhookSecret(input.secret) : undefined,
      updatedAt: new Date(),
    },
  });

  return sanitizeWebhookEndpoint(mapInternalEndpoint(updated));
}

export async function listWebhookEndpoints(): Promise<WebhookEndpoint[]> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return endpoints.map((endpoint) => sanitizeWebhookEndpoint(mapInternalEndpoint(endpoint)));
}

export async function listWebhookDeliveries(limit = 100): Promise<WebhookDeliveryRecord[]> {
  const page = await listWebhookDeliveryPage({ limit });
  return page.deliveries;
}

export async function listWebhookDeliveryPage(
  input: { limit?: number; cursor?: string } = {},
): Promise<WebhookDeliveryPage> {
  const normalizedLimit = Math.max(1, Math.min(input.limit ?? 100, 500));
  let cursorId: string | undefined;

  if (input.cursor) {
    const decoded = decodeDeliveryCursor(input.cursor);
    const cursorRecord = await prisma.webhookDelivery.findUnique({
      where: { id: decoded.id },
    });

    if (!cursorRecord || cursorRecord.createdAt.toISOString() !== decoded.createdAt) {
      throw new Error('Invalid or expired cursor');
    }

    cursorId = cursorRecord.id;
  }

  const pageItems = await prisma.webhookDelivery.findMany({
    take: normalizedLimit + 1,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
  });

  const hasNextPage = pageItems.length > normalizedLimit;
  const deliveriesPage = hasNextPage ? pageItems.slice(0, normalizedLimit) : pageItems;
  const mapped = deliveriesPage.map((delivery) => mapWebhookDelivery(delivery));

  return {
    deliveries: mapped,
    hasNextPage,
    nextCursor: hasNextPage && mapped.length > 0 ? encodeDeliveryCursor(mapped[mapped.length - 1]) : undefined,
  };
}

export async function getWebhookDeliveryMetrics() {
  const [
    totalEndpoints,
    enabledEndpoints,
    totalDeliveries,
    delivered,
    failed,
    pending,
  ] = await Promise.all([
    prisma.webhookEndpoint.count(),
    prisma.webhookEndpoint.count({ where: { enabled: true } }),
    prisma.webhookDelivery.count(),
    prisma.webhookDelivery.count({ where: { status: 'delivered' } }),
    prisma.webhookDelivery.count({ where: { status: 'failed' } }),
    prisma.webhookDelivery.count({ where: { status: 'pending' } }),
  ]);

  return {
    totalEndpoints,
    enabledEndpoints,
    totalDeliveries,
    delivered,
    failed,
    pending,
    maxAttempts,
    deliveryTimeoutMs,
  };
}

export async function resetWebhookState(): Promise<void> {
  await prisma.webhookDelivery.deleteMany();
  await prisma.webhookEndpoint.deleteMany();
}

export function createWebhookSignature(secret: string, payload: unknown): string {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

export function verifyWebhookSignature(
  secret: string,
  payload: unknown,
  signature: string,
): boolean {
  const expected = createWebhookSignature(secret, payload);
  const providedBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function encodeDeliveryCursor(delivery: WebhookDeliveryRecord): string {
  return Buffer.from(JSON.stringify({ createdAt: delivery.createdAt, id: delivery.id })).toString('base64url');
}

function decodeDeliveryCursor(cursor: string): { createdAt: string; id: string } {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const payload = JSON.parse(decoded) as { createdAt?: string; id?: string };
    if (!payload.createdAt || !payload.id) {
      throw new Error('Invalid cursor payload');
    }

    return { createdAt: payload.createdAt, id: payload.id };
  } catch {
    throw new Error('Invalid or expired cursor');
  }
}

export async function emitTransactionEvent(
  eventType: TransactionEventType,
  payload: TransactionEventPayload,
): Promise<number> {
  const enabledEndpoints = await prisma.webhookEndpoint.findMany({
    where: { enabled: true },
  });
  const activeEndpoints = enabledEndpoints
    .map((endpoint) => mapInternalEndpoint(endpoint))
    .filter((endpoint) => endpoint.eventTypes.includes(eventType));

  for (const endpoint of activeEndpoints) {
    const delivery = await prisma.webhookDelivery.create({
      data: {
        id: `whd_${crypto.randomBytes(8).toString('hex')}`,
        endpointId: endpoint.id,
        endpointUrl: endpoint.url,
        eventType,
        status: 'pending',
        attempts: 0,
      },
    });

    void deliverWithRetry(endpoint, { id: delivery.id, eventType }, payload, 1);
  }

  if (activeEndpoints.length > 0) {
    await trimDeliveryRetention();
  }

  return activeEndpoints.length;
}

function assertValidWebhookUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Webhook url must be a valid URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Webhook url protocol must be http or https');
  }
}

async function deliverWithRetry(
  endpoint: InternalWebhookEndpoint,
  delivery: { id: string; eventType: TransactionEventType },
  payload: TransactionEventPayload,
  attempt: number,
): Promise<void> {
  try {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { attempts: attempt },
    });
  } catch {
    // Ignore persistence failures to avoid breaking delivery retries.
  }

  const envelope = {
    eventType: delivery.eventType,
    sentAt: new Date().toISOString(),
    payload,
  };

  const body = JSON.stringify(envelope);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'YieldVault-Webhook-Delivery/1.0',
    'X-YieldVault-Event': delivery.eventType,
    'X-YieldVault-Delivery-Id': delivery.id,
  };

  if (endpoint.secret) {
    headers['X-YieldVault-Signature'] = createWebhookSignature(endpoint.secret, envelope);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, deliveryTimeoutMs);

  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Webhook returned HTTP ${response.status}`);
    }

    try {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'delivered',
          deliveredAt: new Date(),
          lastError: null,
        },
      });
    } catch {
      // Ignore persistence failures to avoid breaking delivery retries.
    }
  } catch (error) {
    const normalized = error instanceof Error ? error.message : String(error);

    if (attempt < maxAttempts) {
      try {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { lastError: normalized },
        });
      } catch {
        // Ignore persistence failures to avoid breaking delivery retries.
      }

      const delayMs = calculateBackoffDelay(attempt);
      setTimeout(() => {
        void deliverWithRetry(endpoint, delivery, payload, attempt + 1);
      }, delayMs);
      return;
    }

    try {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'failed',
          lastError: normalized,
        },
      });
    } catch {
      // Ignore persistence failures to avoid breaking delivery retries.
    }
  } finally {
    clearTimeout(timeout);
  }
}

function calculateBackoffDelay(attempt: number): number {
  return Math.round(retryBaseDelayMs * Math.pow(2, attempt - 1));
}

function sanitizeWebhookEndpoint(endpoint: InternalWebhookEndpoint): WebhookEndpoint {
  return {
    id: endpoint.id,
    url: endpoint.url,
    eventTypes: [...endpoint.eventTypes],
    enabled: endpoint.enabled,
    hasSecret: Boolean(endpoint.secretHash || endpoint.secret),
    createdAt: endpoint.createdAt,
    updatedAt: endpoint.updatedAt,
  };
}

function hashWebhookSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function resolveEventTypes(eventTypes?: TransactionEventType[]): TransactionEventType[] {
  if (eventTypes && eventTypes.length > 0) {
    return eventTypes;
  }

  return [...defaultEventTypes];
}

function parseEventTypes(raw: string): TransactionEventType[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'string')) {
      return parsed as TransactionEventType[];
    }
  } catch {
    // Fall back to default event types when parsing fails.
  }

  return [...defaultEventTypes];
}

function serializeEventTypes(eventTypes: TransactionEventType[]): string {
  return JSON.stringify(eventTypes);
}

function mapInternalEndpoint(endpoint: PrismaWebhookEndpoint): InternalWebhookEndpoint {
  return {
    id: endpoint.id,
    url: endpoint.url,
    eventTypes: parseEventTypes(endpoint.eventTypes),
    enabled: endpoint.enabled,
    secret: endpoint.secret ?? undefined,
    secretHash: endpoint.secretHash ?? undefined,
    createdAt: endpoint.createdAt.toISOString(),
    updatedAt: endpoint.updatedAt.toISOString(),
  };
}

function mapWebhookDelivery(delivery: PrismaWebhookDelivery): WebhookDeliveryRecord {
  return {
    id: delivery.id,
    endpointId: delivery.endpointId,
    endpointUrl: delivery.endpointUrl,
    eventType: delivery.eventType as TransactionEventType,
    status: delivery.status as WebhookDeliveryStatus,
    attempts: delivery.attempts,
    createdAt: delivery.createdAt.toISOString(),
    updatedAt: delivery.updatedAt.toISOString(),
    deliveredAt: delivery.deliveredAt ? delivery.deliveredAt.toISOString() : undefined,
    lastError: delivery.lastError ?? undefined,
  };
}

async function trimDeliveryRetention(): Promise<void> {
  if (deliveryRetention <= 0) {
    await prisma.webhookDelivery.deleteMany();
    return;
  }

  const overflow = await prisma.webhookDelivery.findMany({
    select: { id: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: deliveryRetention,
  });

  if (overflow.length === 0) {
    return;
  }

  await prisma.webhookDelivery.deleteMany({
    where: { id: { in: overflow.map((delivery) => delivery.id) } },
  });
}
