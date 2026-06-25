const {
  ensureMigrationTable,
  loadMigrations,
  withDatabase,
} = require('./postgres-migrations');

const expectedTables = [
  'transactions',
  'idempotency_keys',
  'vault_metrics_snapshots',
  'apy_snapshots',
];

withDatabase(async (pool) => {
  await ensureMigrationTable(pool);

  const [appliedResult, tableResult] = await Promise.all([
    pool.query('SELECT name, checksum FROM schema_migrations ORDER BY name'),
    pool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [expectedTables]
    ),
  ]);

  const applied = new Map(appliedResult.rows.map((row) => [row.name, row.checksum]));
  const errors = [];
  for (const migration of loadMigrations()) {
    if (!applied.has(migration.name)) {
      errors.push(`migration not applied: ${migration.name}`);
    } else if (applied.get(migration.name) !== migration.checksum) {
      errors.push(`migration checksum mismatch: ${migration.name}`);
    }
  }

  const existingTables = new Set(tableResult.rows.map((row) => row.table_name));
  for (const table of expectedTables) {
    if (!existingTables.has(table)) {
      errors.push(`required table missing: ${table}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`PostgreSQL schema drift detected:\n- ${errors.join('\n- ')}`);
  }

  console.log(
    `PostgreSQL schema matches ${applied.size} applied migration(s) and ${expectedTables.length} required tables`
  );
}).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
