import crypto from 'crypto';
import NodeCache from 'node-cache';

const DEFAULT_TTL_SECONDS = parseInt(
  process.env.WEBHOOK_DEDUP_TTL_SECONDS || '86400',
  10,
);

export interface WebhookEventFingerprint {
  eventId: string;
  fingerprint: string;
  seenAt: string;
  expiresAt: string;
}

export interface WebhookDeduplicationMetrics {
  totalSeen: number;
  duplicatesRejected: number;
  activeFingerprints: number;
  evictions: number;
}

class WebhookDeduplicationStore {
  private readonly store: NodeCache;
  private _totalSeen = 0;
  private _duplicatesRejected = 0;
  private _evictions = 0;

  constructor(ttlSeconds: number = DEFAULT_TTL_SECONDS) {
    this.store = new NodeCache({
      stdTTL: ttlSeconds,
      checkperiod: Math.max(60, Math.floor(ttlSeconds / 10)),
      useClones: false,
    });

    this.store.on('expired', () => {
      this._evictions++;
    });
  }

  /**
   * Computes a stable SHA-256 fingerprint for a webhook event payload.
   * The fingerprint covers the event type, source endpoint id, and
   * a canonical serialisation of the payload so that retried deliveries
   * of the same logical event produce the same value.
   */
  static computeFingerprint(
    eventType: string,
    endpointId: string,
    payload: unknown,
  ): string {
    const canonical = JSON.stringify({ eventType, endpointId, payload });
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Returns true if the given event id has already been processed.
   * Records the event as processed when it is seen for the first time.
   *
   * @param eventId  Unique identifier for the event (e.g. delivery id).
   * @param fingerprint  Content fingerprint produced by computeFingerprint.
   * @returns true when a duplicate is detected, false on first occurrence.
   */
  isDuplicate(eventId: string, fingerprint: string): boolean {
    this._totalSeen++;

    const stored = this.store.get<WebhookEventFingerprint>(eventId);
    if (stored) {
      if (stored.fingerprint === fingerprint) {
        this._duplicatesRejected++;
        return true;
      }
      // Different fingerprint for the same event id — treat as first-seen
      // to allow corrected redeliveries without silent loss.
    }

    const ttl = this.store.options.stdTTL ?? DEFAULT_TTL_SECONDS;
    const now = new Date();
    const entry: WebhookEventFingerprint = {
      eventId,
      fingerprint,
      seenAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttl * 1000).toISOString(),
    };
    this.store.set(eventId, entry);
    return false;
  }

  /**
   * Checks whether an event id is present in the store without registering
   * it as processed.  Useful for inspection without side-effects.
   */
  has(eventId: string): boolean {
    return this.store.has(eventId);
  }

  /**
   * Removes a single event fingerprint from the store.
   * Returns true when the entry existed and was removed.
   */
  remove(eventId: string): boolean {
    const deleted = this.store.del(eventId);
    if (deleted > 0) {
      this._evictions++;
      return true;
    }
    return false;
  }

  /**
   * Flushes the entire fingerprint store.  Restricted to admin-initiated
   * calls; prefer remove() for targeted eviction.
   */
  flush(): void {
    const count = this.store.keys().length;
    this.store.flushAll();
    this._evictions += count;
  }

  /**
   * Returns a snapshot of store-wide observability counters.
   */
  getMetrics(): WebhookDeduplicationMetrics {
    return {
      totalSeen: this._totalSeen,
      duplicatesRejected: this._duplicatesRejected,
      activeFingerprints: this.store.keys().length,
      evictions: this._evictions,
    };
  }

  /**
   * Returns metadata for all fingerprints currently held in the store.
   * Optional prefix filter applies to eventId values.
   */
  inspect(prefix?: string): WebhookEventFingerprint[] {
    const results: WebhookEventFingerprint[] = [];
    for (const key of this.store.keys()) {
      if (prefix && !key.startsWith(prefix)) continue;
      const entry = this.store.get<WebhookEventFingerprint>(key);
      if (entry) results.push({ ...entry });
    }
    return results;
  }
}

export const webhookDeduplicationStore = new WebhookDeduplicationStore();

export { WebhookDeduplicationStore };
