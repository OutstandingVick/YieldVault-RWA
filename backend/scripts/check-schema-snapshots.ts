#!/usr/bin/env tsx
/**
 * Verify API contract schema snapshots remain backward-compatible (Issue #711).
 *
 * Snapshots guard high-traffic public endpoints (health, readiness, vault summary,
 * and transaction list) against silent response-shape regressions.
 *
 * Usage:
 *   tsx scripts/check-schema-snapshots.ts          # fail on breaking changes
 *   tsx scripts/check-schema-snapshots.ts --write  # regenerate snapshot files
 *
 * Intentional breaking changes:
 *   1. Update the Zod schema in src/apiContractSnapshots.ts
 *   2. Run: npm run snapshots:write
 *   3. Commit the updated files under schema-snapshots/
 *   4. Align OpenAPI annotations and run: npm run generate:openapi
 */

import {
  checkSnapshotCompatibility,
  writeAllSnapshots,
} from '../src/apiContractSnapshots';

const shouldWrite = process.argv.includes('--write');

if (shouldWrite) {
  writeAllSnapshots();
  console.log('✅ Wrote API contract schema snapshots.');
  process.exit(0);
}

const issues = checkSnapshotCompatibility();
if (issues.length > 0) {
  console.error('❌ API contract schema compatibility check failed:');
  for (const issue of issues) {
    console.error(`  - ${issue.path}: ${issue.message}`);
  }
  console.error('\nIf the breaking change is intentional, run: npm run snapshots:write');
  process.exit(1);
}

console.log('✅ API contract schema snapshots are backward-compatible.');
