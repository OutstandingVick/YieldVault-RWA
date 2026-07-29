import {
  WebhookDeduplicationStore,
  webhookDeduplicationStore,
} from '../webhookDeduplication';

describe('WebhookDeduplicationStore', () => {
  let store: WebhookDeduplicationStore;

  beforeEach(() => {
    store = new WebhookDeduplicationStore(60);
  });

  describe('computeFingerprint', () => {
    it('returns a 64-character hex string', () => {
      const fp = WebhookDeduplicationStore.computeFingerprint(
        'transaction.deposit.created',
        'ep_001',
        { transactionId: 'tx_abc' },
      );
      expect(fp).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(fp)).toBe(true);
    });

    it('produces the same value for identical inputs', () => {
      const payload = { transactionId: 'tx_abc', amount: '100' };
      const a = WebhookDeduplicationStore.computeFingerprint(
        'transaction.deposit.created',
        'ep_001',
        payload,
      );
      const b = WebhookDeduplicationStore.computeFingerprint(
        'transaction.deposit.created',
        'ep_001',
        payload,
      );
      expect(a).toBe(b);
    });

    it('produces different values when event type differs', () => {
      const payload = { transactionId: 'tx_abc' };
      const a = WebhookDeduplicationStore.computeFingerprint(
        'transaction.deposit.created',
        'ep_001',
        payload,
      );
      const b = WebhookDeduplicationStore.computeFingerprint(
        'transaction.withdrawal.created',
        'ep_001',
        payload,
      );
      expect(a).not.toBe(b);
    });

    it('produces different values when endpoint id differs', () => {
      const payload = { transactionId: 'tx_abc' };
      const a = WebhookDeduplicationStore.computeFingerprint(
        'transaction.deposit.created',
        'ep_001',
        payload,
      );
      const b = WebhookDeduplicationStore.computeFingerprint(
        'transaction.deposit.created',
        'ep_002',
        payload,
      );
      expect(a).not.toBe(b);
    });
  });

  describe('isDuplicate', () => {
    it('returns false on first occurrence and true on repeat', () => {
      const fp = 'abc123fingerprint';
      expect(store.isDuplicate('evt_1', fp)).toBe(false);
      expect(store.isDuplicate('evt_1', fp)).toBe(true);
    });

    it('returns false for different event ids with the same fingerprint', () => {
      const fp = 'same_fingerprint';
      expect(store.isDuplicate('evt_1', fp)).toBe(false);
      expect(store.isDuplicate('evt_2', fp)).toBe(false);
    });

    it('allows re-registration when the fingerprint differs for the same event id', () => {
      expect(store.isDuplicate('evt_1', 'fp_v1')).toBe(false);
      expect(store.isDuplicate('evt_1', 'fp_v2')).toBe(false);
    });

    it('increments totalSeen on every call', () => {
      store.isDuplicate('evt_a', 'fp_a');
      store.isDuplicate('evt_b', 'fp_b');
      store.isDuplicate('evt_a', 'fp_a');
      expect(store.getMetrics().totalSeen).toBe(3);
    });

    it('increments duplicatesRejected only when a true duplicate is found', () => {
      store.isDuplicate('evt_a', 'fp_a');
      store.isDuplicate('evt_a', 'fp_a');
      store.isDuplicate('evt_a', 'fp_a');
      expect(store.getMetrics().duplicatesRejected).toBe(2);
    });
  });

  describe('has', () => {
    it('returns false before first registration', () => {
      expect(store.has('evt_unseen')).toBe(false);
    });

    it('returns true after registration', () => {
      store.isDuplicate('evt_x', 'fp_x');
      expect(store.has('evt_x')).toBe(true);
    });

    it('does not affect metrics', () => {
      store.isDuplicate('evt_y', 'fp_y');
      const before = store.getMetrics();
      store.has('evt_y');
      const after = store.getMetrics();
      expect(after.totalSeen).toBe(before.totalSeen);
    });
  });

  describe('remove', () => {
    it('returns false when the entry does not exist', () => {
      expect(store.remove('evt_missing')).toBe(false);
    });

    it('returns true and removes the entry', () => {
      store.isDuplicate('evt_r', 'fp_r');
      expect(store.remove('evt_r')).toBe(true);
      expect(store.has('evt_r')).toBe(false);
    });

    it('allows the same event id to be registered again after removal', () => {
      store.isDuplicate('evt_s', 'fp_s');
      store.remove('evt_s');
      expect(store.isDuplicate('evt_s', 'fp_s')).toBe(false);
    });

    it('increments evictions counter', () => {
      store.isDuplicate('evt_e', 'fp_e');
      store.remove('evt_e');
      expect(store.getMetrics().evictions).toBe(1);
    });
  });

  describe('flush', () => {
    it('removes all entries', () => {
      store.isDuplicate('evt_1', 'fp_1');
      store.isDuplicate('evt_2', 'fp_2');
      store.flush();
      expect(store.getMetrics().activeFingerprints).toBe(0);
      expect(store.has('evt_1')).toBe(false);
      expect(store.has('evt_2')).toBe(false);
    });

    it('increments evictions by the number of flushed entries', () => {
      store.isDuplicate('evt_a', 'fp_a');
      store.isDuplicate('evt_b', 'fp_b');
      store.flush();
      expect(store.getMetrics().evictions).toBe(2);
    });
  });

  describe('inspect', () => {
    it('returns all entries when no prefix is given', () => {
      store.isDuplicate('deposit:ep1:tx1', 'fp1');
      store.isDuplicate('withdrawal:ep1:tx2', 'fp2');
      const entries = store.inspect();
      expect(entries).toHaveLength(2);
    });

    it('filters by prefix', () => {
      store.isDuplicate('deposit:ep1:tx1', 'fp1');
      store.isDuplicate('withdrawal:ep1:tx2', 'fp2');
      const entries = store.inspect('deposit:');
      expect(entries).toHaveLength(1);
      expect(entries[0].eventId).toBe('deposit:ep1:tx1');
    });

    it('returns entries with the correct shape', () => {
      store.isDuplicate('evt_z', 'fp_z');
      const [entry] = store.inspect();
      expect(entry).toHaveProperty('eventId', 'evt_z');
      expect(entry).toHaveProperty('fingerprint', 'fp_z');
      expect(entry).toHaveProperty('seenAt');
      expect(entry).toHaveProperty('expiresAt');
    });
  });

  describe('getMetrics', () => {
    it('starts with all counters at zero', () => {
      const m = store.getMetrics();
      expect(m.totalSeen).toBe(0);
      expect(m.duplicatesRejected).toBe(0);
      expect(m.activeFingerprints).toBe(0);
      expect(m.evictions).toBe(0);
    });
  });

  describe('singleton', () => {
    it('exports a shared instance', () => {
      expect(webhookDeduplicationStore).toBeInstanceOf(WebhookDeduplicationStore);
    });
  });
});
