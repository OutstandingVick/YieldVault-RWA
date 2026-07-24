import {
  requestIdStorage,
  getActiveRequestId,
  getActiveCorrelationId,
  createRequestId,
  normalizeRequestId,
} from '../requestContext';

describe('requestContext', () => {
  describe('createRequestId', () => {
    it('returns a non-empty string', () => {
      expect(typeof createRequestId()).toBe('string');
      expect(createRequestId().length).toBeGreaterThan(0);
    });

    it('produces unique values on successive calls', () => {
      const ids = new Set(Array.from({ length: 50 }, () => createRequestId()));
      expect(ids.size).toBe(50);
    });
  });

  describe('normalizeRequestId', () => {
    it('returns null for non-string values', () => {
      expect(normalizeRequestId(null)).toBeNull();
      expect(normalizeRequestId(42)).toBeNull();
      expect(normalizeRequestId(undefined)).toBeNull();
      expect(normalizeRequestId({})).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(normalizeRequestId('')).toBeNull();
      expect(normalizeRequestId('   ')).toBeNull();
    });

    it('returns null for a string longer than 128 characters', () => {
      expect(normalizeRequestId('a'.repeat(129))).toBeNull();
    });

    it('returns the trimmed value for a valid id', () => {
      expect(normalizeRequestId('  req-123  ')).toBe('req-123');
    });

    it('returns null for strings with invalid characters', () => {
      expect(normalizeRequestId('req 123')).toBeNull();
      expect(normalizeRequestId('req@123')).toBeNull();
      expect(normalizeRequestId('req/123')).toBeNull();
    });

    it('accepts the full set of allowed characters', () => {
      expect(normalizeRequestId('Az09._:-')).toBe('Az09._:-');
    });
  });

  describe('requestIdStorage and helpers', () => {
    it('getActiveRequestId returns undefined outside a storage context', () => {
      expect(getActiveRequestId()).toBeUndefined();
    });

    it('getActiveCorrelationId returns undefined outside a storage context', () => {
      expect(getActiveCorrelationId()).toBeUndefined();
    });

    it('getActiveRequestId returns the stored request id inside a run callback', () => {
      let captured: string | undefined;
      requestIdStorage.run({ requestId: 'req-abc', correlationId: 'cor-abc' }, () => {
        captured = getActiveRequestId();
      });
      expect(captured).toBe('req-abc');
    });

    it('getActiveCorrelationId returns the stored correlation id inside a run callback', () => {
      let captured: string | undefined;
      requestIdStorage.run({ requestId: 'req-xyz', correlationId: 'cor-xyz' }, () => {
        captured = getActiveCorrelationId();
      });
      expect(captured).toBe('cor-xyz');
    });

    it('propagates the context into nested async callbacks', async () => {
      let captured: string | undefined;

      await requestIdStorage.run({ requestId: 'req-async', correlationId: 'cor-async' }, async () => {
        await Promise.resolve();
        captured = getActiveRequestId();
      });

      expect(captured).toBe('req-async');
    });

    it('does not leak context across separate run calls', () => {
      let firstCapture: string | undefined;
      let secondCapture: string | undefined;

      requestIdStorage.run({ requestId: 'req-1' }, () => {
        firstCapture = getActiveRequestId();
      });

      requestIdStorage.run({ requestId: 'req-2' }, () => {
        secondCapture = getActiveRequestId();
      });

      expect(firstCapture).toBe('req-1');
      expect(secondCapture).toBe('req-2');
    });

    it('restores undefined context after run completes', () => {
      requestIdStorage.run({ requestId: 'req-temp' }, () => {});
      expect(getActiveRequestId()).toBeUndefined();
    });
  });
});
