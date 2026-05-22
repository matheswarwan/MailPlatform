import jwt from 'jsonwebtoken';

/**
 * Generate a signed preference token for a contact.
 * The token encodes the contact ID, account ID, and a 'preference' type.
 * Expires in 90 days.
 *
 * @param {string} contactId - UUID of the contact
 * @param {string} accountId - UUID of the account
 * @returns {string} Signed JWT
 */
export function generateToken(contactId, accountId) {
  if (!contactId || !accountId) {
    throw new Error('contactId and accountId are required');
  }

  return jwt.sign(
    {
      sub: contactId,
      acc: accountId,
      type: 'preference',
    },
    process.env.JWT_SECRET,
    { expiresIn: '90d' }
  );
}

/**
 * Verify and decode a preference token.
 *
 * @param {string} token - The JWT token to verify
 * @returns {{ sub: string, acc: string, type: string }} Decoded payload
 * @throws {Error} If token is invalid or expired
 */
export function verifyToken(token) {
  if (!token) {
    throw new Error('Token is required');
  }

  return jwt.verify(token, process.env.JWT_SECRET);
}

/**
 * Build the full preference centre URL for a contact.
 *
 * @param {string} contactId
 * @param {string} accountId
 * @returns {string} Full URL
 */
export function buildPreferenceUrl(contactId, accountId) {
  const token = generateToken(contactId, accountId);
  const baseUrl = process.env.APP_URL || 'http://localhost:3001';
  return `${baseUrl}/api/p/${token}`;
}

/**
 * Build the unsubscribe URL for a contact (uses same token, different frontend path).
 * The frontend can handle /unsubscribe?token=... and auto-post unsubscribe_all.
 *
 * @param {string} contactId
 * @param {string} accountId
 * @returns {string} Full URL
 */
export function buildUnsubscribeUrl(contactId, accountId) {
  const token = generateToken(contactId, accountId);
  const baseUrl = process.env.APP_URL || 'http://localhost:3001';
  return `${baseUrl}/api/p/${token}?action=unsubscribe`;
}
