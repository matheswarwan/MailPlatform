import 'dotenv/config';
import { runMigrations, pool } from './database.js';

try {
  await runMigrations();
  console.log('All migrations ran successfully.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
