import { query } from '../config/database.js';

/**
 * Add an email address to the suppression list for an account.
 * Idempotent — safe to call multiple times.
 *
 * @param {string} accountId  - UUID of the account
 * @param {string} email      - Email address to suppress
 * @param {string} reason     - 'bounce' | 'complaint' | 'unsubscribed' | 'soft_bounce_threshold' | 'admin'
 */
export async function suppress(accountId, email, reason = 'admin') {
  if (!accountId || !email) {
    throw new Error('accountId and email are required');
  }

  const normalizedEmail = email.toLowerCase().trim();

  await query(
    `INSERT INTO suppression_list (account_id, email, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT (account_id, email) DO UPDATE SET
       reason = EXCLUDED.reason,
       created_at = suppression_list.created_at`, // keep original suppression date
    [accountId, normalizedEmail, reason]
  );

  return { suppressed: true, email: normalizedEmail, reason };
}

/**
 * Check whether an email is suppressed for a given account.
 *
 * @param {string} accountId
 * @param {string} email
 * @returns {Promise<boolean>}
 */
export async function isSuppressed(accountId, email) {
  if (!accountId || !email) return false;

  const normalizedEmail = email.toLowerCase().trim();

  const result = await query(
    'SELECT id FROM suppression_list WHERE account_id = $1 AND email = $2 LIMIT 1',
    [accountId, normalizedEmail]
  );

  return result.rows.length > 0;
}

/**
 * Remove an email from the suppression list for an account.
 * This is an admin/exception operation — use sparingly.
 *
 * @param {string} accountId
 * @param {string} email
 * @returns {Promise<boolean>} true if a record was removed
 */
export async function unsuppress(accountId, email) {
  if (!accountId || !email) {
    throw new Error('accountId and email are required');
  }

  const normalizedEmail = email.toLowerCase().trim();

  const result = await query(
    'DELETE FROM suppression_list WHERE account_id = $1 AND email = $2 RETURNING id',
    [accountId, normalizedEmail]
  );

  return result.rows.length > 0;
}

/**
 * Get all suppressed emails for an account with optional pagination.
 *
 * @param {string} accountId
 * @param {object} options - { page, limit }
 * @returns {Promise<{ suppressed: Array, total: number }>}
 */
export async function listSuppressed(accountId, { page = 1, limit = 100 } = {}) {
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const [countResult, dataResult] = await Promise.all([
    query('SELECT COUNT(*) FROM suppression_list WHERE account_id = $1', [accountId]),
    query(
      `SELECT email, reason, created_at
       FROM suppression_list
       WHERE account_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [accountId, parseInt(limit), offset]
    ),
  ]);

  return {
    suppressed: dataResult.rows,
    total: parseInt(countResult.rows[0].count),
  };
}
