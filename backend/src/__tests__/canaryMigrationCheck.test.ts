/**
 * Tests for the canary-safe migration checker (Issue #958).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { checkMigrationFile, MigrationCheckResult } from '../../scripts/canary-migration-check';

// ── helpers ───────────────────────────────────────────────────────────────────

function withTempFile(content: string, fn: (filePath: string) => void): void {
  const tmpFile = path.join(os.tmpdir(), `migration-check-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  fs.writeFileSync(tmpFile, content, 'utf8');
  try {
    fn(tmpFile);
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

function check(sql: string): MigrationCheckResult {
  let result!: MigrationCheckResult;
  withTempFile(sql, (f) => {
    result = checkMigrationFile(f);
  });
  return result;
}

// ── Safe migrations ───────────────────────────────────────────────────────────

describe('checkMigrationFile — safe migrations', () => {
  it('passes a simple CREATE TABLE', () => {
    const result = check(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    expect(result.safe).toBe(true);
    expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('passes ADD COLUMN with a DEFAULT value', () => {
    const result = check(`
      ALTER TABLE transactions ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
    `);
    expect(result.safe).toBe(true);
  });

  it('passes ADD COLUMN that is nullable (no NOT NULL)', () => {
    const result = check(`
      ALTER TABLE transactions ADD COLUMN notes TEXT;
    `);
    expect(result.safe).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('passes CREATE INDEX CONCURRENTLY', () => {
    const result = check(`
      CREATE INDEX CONCURRENTLY idx_tx_user ON transactions (user_id);
    `);
    expect(result.safe).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('passes UPDATE with WHERE clause', () => {
    const result = check(`
      UPDATE transactions SET status = 'active' WHERE status IS NULL;
    `);
    // May warn or not — but must not produce an error
    expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('passes an entirely empty migration', () => {
    const result = check('-- Initial migration\n');
    expect(result.safe).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});

// ── Unsafe migrations — errors ────────────────────────────────────────────────

describe('checkMigrationFile — error cases', () => {
  it('fails on DROP COLUMN', () => {
    const result = check(`
      ALTER TABLE users DROP COLUMN legacy_field;
    `);
    expect(result.safe).toBe(false);
    const err = result.issues.find((i) => i.rule === 'no-drop-column');
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
  });

  it('fails on DROP TABLE', () => {
    const result = check(`DROP TABLE old_events;`);
    expect(result.safe).toBe(false);
    expect(result.issues.some((i) => i.rule === 'no-drop-table')).toBe(true);
  });

  it('fails on RENAME COLUMN', () => {
    const result = check(`
      ALTER TABLE transactions RENAME COLUMN amount TO amount_usd;
    `);
    expect(result.safe).toBe(false);
    expect(result.issues.some((i) => i.rule === 'no-rename-column')).toBe(true);
  });

  it('fails on RENAME TABLE', () => {
    const result = check(`
      ALTER TABLE events RENAME TO legacy_events;
    `);
    expect(result.safe).toBe(false);
    expect(result.issues.some((i) => i.rule === 'no-rename-table')).toBe(true);
  });

  it('fails on ADD COLUMN NOT NULL without DEFAULT', () => {
    const result = check(`
      ALTER TABLE users ADD COLUMN verified BOOLEAN NOT NULL;
    `);
    expect(result.safe).toBe(false);
    const err = result.issues.find((i) => i.rule === 'no-not-null-without-default');
    expect(err).toBeDefined();
    expect(err?.message).toContain('phase 1');
  });

  it('fails on TRUNCATE', () => {
    const result = check(`TRUNCATE TABLE audit_logs;`);
    expect(result.safe).toBe(false);
    expect(result.issues.some((i) => i.rule === 'no-truncate')).toBe(true);
  });

  it('fails on column type change', () => {
    const result = check(`
      ALTER TABLE transactions ALTER COLUMN amount TYPE BIGINT;
    `);
    expect(result.safe).toBe(false);
    expect(result.issues.some((i) => i.rule === 'no-type-change')).toBe(true);
  });
});

// ── Warnings ──────────────────────────────────────────────────────────────────

describe('checkMigrationFile — warning cases', () => {
  it('warns on CREATE INDEX without CONCURRENTLY', () => {
    const result = check(`
      CREATE INDEX idx_user_email ON users (email);
    `);
    // Must be a warning, not an error → still "safe"
    expect(result.safe).toBe(true);
    const warn = result.issues.find((i) => i.rule === 'index-concurrent');
    expect(warn).toBeDefined();
    expect(warn?.severity).toBe('warning');
  });

  it('warns on unbounded UPDATE', () => {
    const result = check(`
      UPDATE transactions SET migrated = true;
    `);
    const warn = result.issues.find((i) => i.rule === 'mass-update-backfill');
    expect(warn).toBeDefined();
    expect(warn?.severity).toBe('warning');
  });
});

// ── Annotation opt-outs ────────────────────────────────────────────────────────

describe('checkMigrationFile — annotation opt-outs', () => {
  it('allows DROP COLUMN with allow-drop annotation', () => {
    const result = check(`
      -- migration-safety: allow-drop
      ALTER TABLE users DROP COLUMN legacy_field;
    `);
    expect(result.safe).toBe(true);
    expect(result.issues.some((i) => i.rule === 'no-drop-column')).toBe(false);
  });

  it('allows non-concurrent index with allow-nonconcurrent-indexes annotation', () => {
    const result = check(`
      -- migration-safety: allow-nonconcurrent-indexes
      CREATE INDEX idx_email ON users (email);
    `);
    expect(result.safe).toBe(true);
    expect(result.issues.some((i) => i.rule === 'index-concurrent')).toBe(false);
  });

  it('allows NOT NULL without DEFAULT with allow-not-null-add annotation', () => {
    const result = check(`
      -- migration-safety: allow-not-null-add
      ALTER TABLE users ADD COLUMN verified BOOLEAN NOT NULL;
    `);
    expect(result.safe).toBe(true);
    expect(result.issues.some((i) => i.rule === 'no-not-null-without-default')).toBe(false);
  });
});

// ── Line numbers ───────────────────────────────────────────────────────────────

describe('checkMigrationFile — line numbers', () => {
  it('reports the correct line number for an error', () => {
    const result = check(`-- line 1
-- line 2
ALTER TABLE users DROP COLUMN old_col; -- line 3
`);
    const err = result.issues.find((i) => i.rule === 'no-drop-column');
    expect(err?.line).toBe(3);
  });
});

// ── IO error ──────────────────────────────────────────────────────────────────

describe('checkMigrationFile — IO error', () => {
  it('returns safe=false for a non-existent file', () => {
    const result = checkMigrationFile('/tmp/definitely-does-not-exist-abc123.sql');
    expect(result.safe).toBe(false);
    expect(result.issues[0].rule).toBe('io-error');
  });
});
