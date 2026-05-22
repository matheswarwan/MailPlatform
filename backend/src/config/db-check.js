import 'dotenv/config';
import { pool } from './database.js';

const TABLES = [
  'accounts',
  'contacts',
  'segments',
  'templates',
  'campaigns',
  'sends',
  'automations',
  'preference_centre_configs',
  'contact_preferences',
  'suppression_list',
];

async function check() {
  for (const table of TABLES) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`TABLE: ${table}`);
    console.log('='.repeat(60));

    // Schema
    const schema = await pool.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = $1
       ORDER BY ordinal_position`,
      [table]
    );
    console.log('\nSchema:');
    console.table(schema.rows);

    // Row count
    const count = await pool.query(`SELECT COUNT(*) FROM ${table}`);
    console.log(`Row count: ${count.rows[0].count}`);

    // Sample rows
    const rows = await pool.query(`SELECT * FROM ${table} LIMIT 3`);
    if (rows.rows.length > 0) {
      console.log('\nSample rows:');
      console.table(rows.rows);
    } else {
      console.log('Sample rows: (empty)');
    }
  }

  await pool.end();
}

check().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
