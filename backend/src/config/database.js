import pg from 'pg';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('rds.amazonaws.com') ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

export const query = (text, params) => pool.query(text, params);

export { pool };

export async function runMigrations() {
  const migration001 = join(__dirname, '../../migrations/001_initial_schema.sql');
  const sql001 = await readFile(migration001, 'utf8');
  await pool.query(sql001);
  console.log('Migration 001_initial_schema.sql complete');

  try {
    const migration002 = join(__dirname, '../../migrations/002_contact_attributes.sql');
    const sql002 = await readFile(migration002, 'utf8');
    await pool.query(sql002);
    console.log('Migration 002_contact_attributes.sql complete');
  } catch (err) {
    // IF NOT EXISTS guards are in place; only re-throw unexpected errors
    if (err.code !== '42701' && err.code !== '42P07') {
      throw err;
    }
    console.log('Migration 002_contact_attributes.sql skipped (already applied)');
  }

  try {
    const migration003 = join(__dirname, '../../migrations/003_assets.sql');
    const sql003 = await readFile(migration003, 'utf8');
    await pool.query(sql003);
    console.log('Migration 003_assets.sql complete');
  } catch (err) {
    if (err.code !== '42701' && err.code !== '42P07') {
      throw err;
    }
    console.log('Migration 003_assets.sql skipped (already applied)');
  }

  console.log('All migrations complete');
}
