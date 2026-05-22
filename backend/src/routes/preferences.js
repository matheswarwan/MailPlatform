import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { generateToken, verifyToken } from '../services/preferenceService.js';
import { suppress } from '../services/suppressionService.js';

export default async function preferenceRoutes(fastify) {
  // ─────────────────────────────────────────────────────────────────
  // Authenticated routes — account configuration
  // ─────────────────────────────────────────────────────────────────

  // GET /api/preferences/config
  fastify.get('/api/preferences/config', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;

    try {
      const result = await query(
        `SELECT id, logo_url, brand_color, headline, description, subscription_types, updated_at
         FROM preference_centre_configs
         WHERE account_id = $1`,
        [accountId]
      );

      if (result.rows.length === 0) {
        // Return a sensible default if not yet configured
        return reply.code(200).send({
          config: {
            logo_url: null,
            brand_color: '#4F7FFF',
            headline: 'Manage Your Email Preferences',
            description: 'Choose the types of emails you want to receive from us.',
            subscription_types: [],
          },
        });
      }

      return reply.code(200).send({ config: result.rows[0] });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/preferences/config
  fastify.put('/api/preferences/config', { preHandler: authenticate }, async (request, reply) => {
    const { logoUrl, brandColor, headline, description, subscriptionTypes } = request.body || {};
    const accountId = request.user.accountId;

    if (brandColor && !/^#[0-9A-Fa-f]{6}$/.test(brandColor)) {
      return reply.code(400).send({ error: 'brandColor must be a valid hex color (e.g. #4F7FFF)' });
    }

    if (headline && headline.length > 80) {
      return reply.code(400).send({ error: 'headline must be 80 characters or fewer' });
    }

    if (description && description.length > 300) {
      return reply.code(400).send({ error: 'description must be 300 characters or fewer' });
    }

    try {
      const result = await query(
        `INSERT INTO preference_centre_configs
           (account_id, logo_url, brand_color, headline, description, subscription_types, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (account_id) DO UPDATE SET
           logo_url = COALESCE($2, preference_centre_configs.logo_url),
           brand_color = COALESCE($3, preference_centre_configs.brand_color),
           headline = COALESCE($4, preference_centre_configs.headline),
           description = COALESCE($5, preference_centre_configs.description),
           subscription_types = COALESCE($6, preference_centre_configs.subscription_types),
           updated_at = NOW()
         RETURNING *`,
        [
          accountId,
          logoUrl || null,
          brandColor || null,
          headline || null,
          description || null,
          subscriptionTypes ? JSON.stringify(subscriptionTypes) : null,
        ]
      );

      return reply.code(200).send({ config: result.rows[0] });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/preferences/generate-token/:contactId — generate preference token
  fastify.post(
    '/api/preferences/generate-token/:contactId',
    { preHandler: authenticate },
    async (request, reply) => {
      const { contactId } = request.params;
      const accountId = request.user.accountId;

      try {
        const contactResult = await query(
          'SELECT id, email FROM contacts WHERE id = $1 AND account_id = $2',
          [contactId, accountId]
        );

        if (contactResult.rows.length === 0) {
          return reply.code(404).send({ error: 'Contact not found' });
        }

        const token = generateToken(contactId, accountId);
        const prefUrl = `${process.env.APP_URL}/api/p/${token}`;

        return reply.code(200).send({
          token,
          url: prefUrl,
          contact: contactResult.rows[0],
        });
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ error: 'Internal server error' });
      }
    }
  );

  // ─────────────────────────────────────────────────────────────────
  // Public preference centre routes (no auth — for end subscribers)
  // ─────────────────────────────────────────────────────────────────

  // GET /api/p/:token — resolve token, return contact preferences + branding
  fastify.get('/api/p/:token', async (request, reply) => {
    const { token } = request.params;

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return reply.code(400).send({ error: 'Invalid or expired preference link' });
    }

    if (decoded.type !== 'preference') {
      return reply.code(400).send({ error: 'Invalid token type' });
    }

    const { sub: contactId, acc: accountId } = decoded;

    try {
      // Load contact
      const contactResult = await query(
        `SELECT id, email, first_name, last_name, status
         FROM contacts
         WHERE id = $1 AND account_id = $2`,
        [contactId, accountId]
      );

      if (contactResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Contact not found' });
      }

      const contact = contactResult.rows[0];

      // Load preference centre config (branding)
      const configResult = await query(
        `SELECT logo_url, brand_color, headline, description, subscription_types
         FROM preference_centre_configs
         WHERE account_id = $1`,
        [accountId]
      );

      const config = configResult.rows[0] || {
        logo_url: null,
        brand_color: '#4F7FFF',
        headline: 'Manage Your Email Preferences',
        description: 'Choose the types of emails you want to receive from us.',
        subscription_types: [],
      };

      // Load existing contact preferences
      const prefsResult = await query(
        `SELECT subscription_type_id, opted_in, changed_at
         FROM contact_preferences
         WHERE contact_id = $1 AND account_id = $2`,
        [contactId, accountId]
      );

      // Build a map of type_id -> opted_in
      const prefsMap = {};
      for (const pref of prefsResult.rows) {
        prefsMap[pref.subscription_type_id] = pref.opted_in;
      }

      // Merge subscription types with current opt-in state
      const subscriptionTypes = (config.subscription_types || []).map((st) => ({
        ...st,
        opted_in: prefsMap[st.id] !== undefined ? prefsMap[st.id] : true, // default opted in
      }));

      return reply.code(200).send({
        contact: {
          id: contact.id,
          email: contact.email,
          first_name: contact.first_name,
          last_name: contact.last_name,
          is_unsubscribed: contact.status === 'unsubscribed',
        },
        config: {
          ...config,
          subscription_types: subscriptionTypes,
        },
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/p/:token — save preference changes
  fastify.post('/api/p/:token', async (request, reply) => {
    const { token } = request.params;
    const { subscription_types = [], unsubscribe_all = false } = request.body || {};
    const clientIp = request.ip;

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return reply.code(400).send({ error: 'Invalid or expired preference link' });
    }

    if (decoded.type !== 'preference') {
      return reply.code(400).send({ error: 'Invalid token type' });
    }

    const { sub: contactId, acc: accountId } = decoded;

    try {
      // Verify contact exists
      const contactResult = await query(
        'SELECT id, email, status FROM contacts WHERE id = $1 AND account_id = $2',
        [contactId, accountId]
      );

      if (contactResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Contact not found' });
      }

      const contact = contactResult.rows[0];

      if (unsubscribe_all) {
        // Unsubscribe from everything
        await query(
          `UPDATE contacts SET status = 'unsubscribed', updated_at = NOW()
           WHERE id = $1 AND account_id = $2`,
          [contactId, accountId]
        );

        // Add to suppression list
        await suppress(accountId, contact.email, 'unsubscribed');

        // Opt out of all subscription types in contact_preferences
        const configResult = await query(
          'SELECT subscription_types FROM preference_centre_configs WHERE account_id = $1',
          [accountId]
        );

        if (configResult.rows.length > 0) {
          const allTypes = configResult.rows[0].subscription_types || [];
          for (const st of allTypes) {
            await query(
              `INSERT INTO contact_preferences
                 (contact_id, account_id, subscription_type_id, opted_in, changed_at, ip_address)
               VALUES ($1, $2, $3, FALSE, NOW(), $4::inet)
               ON CONFLICT (contact_id, subscription_type_id) DO UPDATE SET
                 opted_in = FALSE,
                 changed_at = NOW(),
                 ip_address = $4::inet`,
              [contactId, accountId, st.id, clientIp]
            );
          }
        }

        return reply.code(200).send({
          message: 'You have been unsubscribed from all emails.',
          unsubscribed: true,
        });
      }

      // Save individual subscription type preferences
      for (const pref of subscription_types) {
        const { id: typeId, opted_in } = pref;
        if (!typeId) continue;

        await query(
          `INSERT INTO contact_preferences
             (contact_id, account_id, subscription_type_id, opted_in, changed_at, ip_address)
           VALUES ($1, $2, $3, $4, NOW(), $5::inet)
           ON CONFLICT (contact_id, subscription_type_id) DO UPDATE SET
             opted_in = $4,
             changed_at = NOW(),
             ip_address = $5::inet`,
          [contactId, accountId, typeId, opted_in !== false, clientIp]
        );
      }

      // If all are opted out, mark contact as unsubscribed + suppress
      const allOptedOut =
        subscription_types.length > 0 && subscription_types.every((p) => p.opted_in === false);

      if (allOptedOut) {
        await query(
          `UPDATE contacts SET status = 'unsubscribed', updated_at = NOW()
           WHERE id = $1 AND account_id = $2`,
          [contactId, accountId]
        );
        await suppress(accountId, contact.email, 'unsubscribed');
      } else if (contact.status === 'unsubscribed' && subscription_types.some((p) => p.opted_in)) {
        // Re-subscribing to at least one type — restore active status
        await query(
          `UPDATE contacts SET status = 'active', updated_at = NOW()
           WHERE id = $1 AND account_id = $2`,
          [contactId, accountId]
        );
      }

      return reply.code(200).send({
        message: 'Your preferences have been saved.',
        unsubscribed: false,
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
