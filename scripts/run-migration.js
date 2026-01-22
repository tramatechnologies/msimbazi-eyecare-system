/**
 * Run EMR migration against Supabase Postgres.
 * Requires: DATABASE_URL (Supabase Project Settings → Database → Connection string)
 * Or: SUPABASE_DB_URL
 *
 * Usage: node scripts/run-migration.js [migration-file]
 * Default: scripts/migrations/001_emr_tables_and_patients_extensions.sql
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

async function main() {
  const file = process.argv[2] || path.join(__dirname, 'migrations', '001_emr_tables_and_patients_extensions.sql');
  const sql = readFileSync(file, 'utf8');

  if (!DATABASE_URL) {
    console.error('Missing DATABASE_URL or SUPABASE_DB_URL.');
    console.error('Set it in .env.local (Supabase → Project Settings → Database → Connection string).');
    process.exit(1);
  }

  let pg;
  try {
    pg = await import('pg');
  } catch {
    console.error('Install pg: npm install pg');
    process.exit(1);
  }

  const client = new pg.default.Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    await client.query(sql);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
