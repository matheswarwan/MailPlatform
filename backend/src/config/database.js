import pg from 'pg';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

export const query = (text, params) => pool.query(text, params);

export { pool };

export async function runMigrations() {
  const migrationPath = join(__dirname, '../../migrations/001_initial_schema.sql');
  const sql = await readFile(migrationPath, 'utf8');
  await pool.query(sql);
  console.log('Migrations complete');
}
