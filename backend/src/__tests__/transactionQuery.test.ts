/**
 * Unit tests for the transaction history query helpers (Issue #890).
 *
 * These tests intentionally import only the pure helper module so they run
 * independently of the Express app wiring.
 */
import {
  resolveTransactionSort,
  buildTransactionOrderBy,
  buildTransactionCursorFilter,
  parseTypeFilter,
  parseStatusFilter,
  isSortableField,
  DEFAULT_SORT_FIELD,
} from '../transactionQuery';

describe('resolveTransactionSort', () => {
  it('defaults to timestamp desc when nothing is supplied', () => {
    expect(resolveTransactionSort(undefined, undefined)).toEqual({
      field: 'timestamp',
      order: 'desc',
      valid: true,
    });
  });

  it('accepts allowlisted fields and honours asc order', () => {
    expect(resolveTransactionSort('type', 'asc')).toEqual({
      field: 'type',
      order: 'asc',
      valid: true,
    });
    expect(resolveTransactionSort('status', 'desc')).toEqual({
      field: 'status',
      order: 'desc',
      valid: true,
    });
  });

  it('flags unknown fields as invalid and falls back to the default', () => {
    const result = resolveTransactionSort('amount', 'asc');
    expect(result.valid).toBe(false);
    expect(result.field).toBe(DEFAULT_SORT_FIELD);
    expect(result.requested).toBe('amount');
  });

  it('treats any non-"asc" order as desc', () => {
    expect(resolveTransactionSort('timestamp', 'sideways').order).toBe('desc');
    expect(resolveTransactionSort('timestamp', 'ASC').order).toBe('desc');
  });
});

describe('isSortableField', () => {
  it('recognises only allowlisted fields', () => {
    expect(isSortableField('timestamp')).toBe(true);
    expect(isSortableField('type')).toBe(true);
    expect(isSortableField('status')).toBe(true);
    expect(isSortableField('user')).toBe(false);
    expect(isSortableField('__proto__')).toBe(false);
  });
});

describe('buildTransactionOrderBy', () => {
  it('adds a deterministic id tie-breaker in the same direction', () => {
    expect(buildTransactionOrderBy({ field: 'status', order: 'asc' })).toEqual([
      { status: 'asc' },
      { id: 'asc' },
    ]);
    expect(buildTransactionOrderBy({ field: 'timestamp', order: 'desc' })).toEqual([
      { timestamp: 'desc' },
      { id: 'desc' },
    ]);
  });
});

describe('buildTransactionCursorFilter', () => {
  const cursorRow = {
    id: 'tx-42',
    timestamp: new Date('2026-01-02T00:00:00.000Z'),
    status: 'completed',
  };

  it('selects rows before the cursor for desc ordering (gt)', () => {
    const filter = buildTransactionCursorFilter(
      { field: 'timestamp', order: 'desc' },
      cursorRow,
    );
    expect(filter).toEqual({
      OR: [
        { timestamp: { gt: cursorRow.timestamp } },
        { AND: [{ timestamp: cursorRow.timestamp }, { id: { gt: 'tx-42' } }] },
      ],
    });
  });

  it('selects rows before the cursor for asc ordering (lt)', () => {
    const filter = buildTransactionCursorFilter(
      { field: 'status', order: 'asc' },
      cursorRow,
    );
    expect(filter).toEqual({
      OR: [
        { status: { lt: 'completed' } },
        { AND: [{ status: 'completed' }, { id: { lt: 'tx-42' } }] },
      ],
    });
  });
});

describe('parseTypeFilter', () => {
  it('returns an empty list when no filter is given', () => {
    expect(parseTypeFilter(undefined)).toEqual({ types: [] });
  });

  it('parses comma-separated valid types', () => {
    expect(parseTypeFilter('deposit,withdrawal')).toEqual({
      types: ['deposit', 'withdrawal'],
    });
  });

  it('rejects unknown types with an error message', () => {
    const result = parseTypeFilter('deposit,transfer');
    expect(result.types).toEqual([]);
    expect(result.error).toMatch(/Invalid type filter/);
  });
});

describe('parseStatusFilter', () => {
  it('passes through recognised statuses', () => {
    expect(parseStatusFilter('completed')).toEqual({ status: 'completed' });
  });

  it('rejects unknown statuses', () => {
    const result = parseStatusFilter('archived');
    expect(result.status).toBeUndefined();
    expect(result.error).toMatch(/Invalid status filter/);
  });

  it('returns empty object when no status is provided', () => {
    expect(parseStatusFilter(undefined)).toEqual({});
  });
});
