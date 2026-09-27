require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

/**
 * Minimal migration runner: applies every .sql file in /migrations, in
 * filename order, that hasn't already been applied. Tracks applied
 * migrations in a `schema_migrations` table.
 *
 * Good enough for a starter project. For a production SaaS, consider
 * swapping this for `node-pg-migrate` or `knex` migrations once you
 * need rollback support and more complex schema changes.
 */
async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await client.query(
      `SELECT 1 FROM schema_migrations WHERE filename = $1`,
      [file]
    );

    if (rows.length > 0) {
      console.log(`Skipping already-applied migration: ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Applying migration: ${file}`);

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Migration ${file} failed:`, err.message);
      process.exit(1);
    }
  }

  console.log('All migrations applied.');
  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
