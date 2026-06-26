const {
  ensureMigrationTable,
  loadMigrations,
  withDatabase,
} = require('./postgres-migrations');

withDatabase(async (pool) => {
  const client = await pool.connect();
  try {
    await ensureMigrationTable(client);
    const applied = await client.query('SELECT name, checksum FROM schema_migrations');
    const appliedByName = new Map(applied.rows.map((row) => [row.name, row.checksum]));

    for (const migration of loadMigrations()) {
      const existingChecksum = appliedByName.get(migration.name);
      if (existingChecksum && existingChecksum !== migration.checksum) {
        throw new Error(`Applied migration ${migration.name} has been modified`);
      }
      if (existingChecksum) {
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
          [migration.name, migration.checksum]
        );
        await client.query('COMMIT');
        console.log(`Applied ${migration.name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
  }
}).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
