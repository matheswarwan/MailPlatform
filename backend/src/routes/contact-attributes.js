import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const STANDARD_FIELDS = [
  { key: 'email',      label: 'Email',       type: 'text',   group: 'standard' },
  { key: 'first_name', label: 'First Name',  type: 'text',   group: 'standard' },
  { key: 'last_name',  label: 'Last Name',   type: 'text',   group: 'standard' },
  { key: 'company',    label: 'Company',     type: 'text',   group: 'standard' },
  { key: 'phone',      label: 'Phone',       type: 'text',   group: 'standard' },
  { key: 'sex',        label: 'Sex',         type: 'select', group: 'standard',
    options: ['male', 'female', 'non-binary', 'prefer_not_to_say'] },
  { key: 'age',        label: 'Age',         type: 'number', group: 'standard' },
  { key: 'birthday',   label: 'Birthday',    type: 'date',   group: 'standard' },
  { key: 'status',     label: 'Status',      type: 'select', group: 'standard',
    options: ['active', 'unsubscribed', 'bounced', 'complained'] },
  { key: 'tag',        label: 'Tag',         type: 'tag',    group: 'standard' },
  { key: 'source',     label: 'Source',      type: 'select', group: 'standard',
    options: ['import', 'manual', 'api', 'form'] },
  { key: 'created_at', label: 'Date Added',  type: 'date',   group: 'standard' },
];

const VALID_TYPES = ['text', 'number', 'date', 'boolean', 'select'];

function generateKey(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export default async function contactAttributeRoutes(fastify) {
  // GET /api/contact-attributes — all fields (standard + custom) for segment builder
  fastify.get('/api/contact-attributes', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;

    try {
      const result = await query(
        `SELECT id, name, key, type, options, created_at
         FROM custom_field_definitions
         WHERE account_id = $1
         ORDER BY created_at ASC`,
        [accountId]
      );

      const customFields = result.rows.map((def) => ({
        key: `custom:${def.key}`,
        label: def.name,
        type: def.type,
        group: 'custom',
        options: def.options || [],
        id: def.id,
      }));

      return reply.code(200).send({ fields: [...STANDARD_FIELDS, ...customFields] });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/contact-attributes/definitions — list custom field definitions
  fastify.get('/api/contact-attributes/definitions', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;

    try {
      const result = await query(
        `SELECT id, name, key, type, options, created_at
         FROM custom_field_definitions
         WHERE account_id = $1
         ORDER BY created_at ASC`,
        [accountId]
      );

      return reply.code(200).send({ definitions: result.rows });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/contact-attributes/definitions — create a new custom field definition
  fastify.post('/api/contact-attributes/definitions', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;
    const { name, type, options = [] } = request.body || {};

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return reply.code(400).send({ error: 'name is required' });
    }

    if (name.trim().length > 100) {
      return reply.code(400).send({ error: 'name must be 100 characters or fewer' });
    }

    if (!type || !VALID_TYPES.includes(type)) {
      return reply.code(400).send({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }

    if (type === 'select' && (!Array.isArray(options) || options.length === 0)) {
      return reply.code(400).send({ error: 'options is required and must be a non-empty array for type "select"' });
    }

    const key = generateKey(name.trim());

    if (!key) {
      return reply.code(400).send({ error: 'name must contain at least one alphanumeric character' });
    }

    try {
      const result = await query(
        `INSERT INTO custom_field_definitions (account_id, name, key, type, options)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [accountId, name.trim(), key, type, JSON.stringify(options)]
      );

      return reply.code(201).send({ definition: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') {
        return reply.code(409).send({ error: `A custom field with key "${key}" already exists` });
      }
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/contact-attributes/definitions/:id — update name and/or options only
  fastify.put('/api/contact-attributes/definitions/:id', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params;
    const { name, options } = request.body || {};

    try {
      const existing = await query(
        'SELECT id, type FROM custom_field_definitions WHERE id = $1 AND account_id = $2',
        [id, accountId]
      );

      if (existing.rows.length === 0) {
        return reply.code(404).send({ error: 'Custom field definition not found' });
      }

      if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
        return reply.code(400).send({ error: 'name must be a non-empty string' });
      }

      if (name !== undefined && name.trim().length > 100) {
        return reply.code(400).send({ error: 'name must be 100 characters or fewer' });
      }

      const def = existing.rows[0];

      if (options !== undefined && def.type === 'select' && (!Array.isArray(options) || options.length === 0)) {
        return reply.code(400).send({ error: 'options must be a non-empty array for type "select"' });
      }

      const result = await query(
        `UPDATE custom_field_definitions
         SET name    = COALESCE($1, name),
             options = COALESCE($2, options)
         WHERE id = $3 AND account_id = $4
         RETURNING *`,
        [
          name ? name.trim() : null,
          options !== undefined ? JSON.stringify(options) : null,
          id,
          accountId,
        ]
      );

      return reply.code(200).send({ definition: result.rows[0] });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/contact-attributes/definitions/:id — delete a custom field definition
  // NOTE: Data already stored in contacts.custom_fields is NOT deleted; it becomes
  // inaccessible through the builder but remains in the database.
  fastify.delete('/api/contact-attributes/definitions/:id', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params;

    try {
      const result = await query(
        'DELETE FROM custom_field_definitions WHERE id = $1 AND account_id = $2 RETURNING id',
        [id, accountId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Custom field definition not found' });
      }

      return reply.code(200).send({ message: 'Custom field definition deleted successfully' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
