import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

/**
 * Evaluate segment rules against contacts.
 * Supported rule types in v1:
 *   { field: 'tag',    operator: 'contains',    value: 'newsletter' }
 *   { field: 'status', operator: 'equals',      value: 'active' }
 *   { field: 'email',  operator: 'contains',    value: '@gmail.com' }
 *   { field: 'created_at', operator: 'after',   value: '2024-01-01' }
 *   { field: 'created_at', operator: 'before',  value: '2025-01-01' }
 *
 * Returns { whereClause, params } to append to a base accounts query.
 * Caller must supply the first param ($1) as account_id.
 */
function buildSegmentQuery(rules, baseParams = []) {
  const conditions = [];
  const params = [...baseParams];

  if (!Array.isArray(rules) || rules.length === 0) {
    return { conditions: [], params };
  }

  for (const rule of rules) {
    const { field, operator, value } = rule;
    if (!field || !operator || value === undefined || value === null) continue;

    if (field === 'tag') {
      if (operator === 'contains' || operator === 'equals') {
        params.push(value);
        conditions.push(`$${params.length} = ANY(tags)`);
      } else if (operator === 'not_contains') {
        params.push(value);
        conditions.push(`NOT ($${params.length} = ANY(tags))`);
      }
    } else if (field === 'status') {
      if (operator === 'equals') {
        params.push(value);
        conditions.push(`status = $${params.length}`);
      } else if (operator === 'not_equals') {
        params.push(value);
        conditions.push(`status != $${params.length}`);
      }
    } else if (field === 'email') {
      if (operator === 'contains') {
        params.push(`%${value}%`);
        conditions.push(`email ILIKE $${params.length}`);
      } else if (operator === 'equals') {
        params.push(value);
        conditions.push(`email = $${params.length}`);
      }
    } else if (field === 'created_at') {
      if (operator === 'after') {
        params.push(value);
        conditions.push(`created_at > $${params.length}`);
      } else if (operator === 'before') {
        params.push(value);
        conditions.push(`created_at < $${params.length}`);
      }
    } else if (field === 'source') {
      if (operator === 'equals') {
        params.push(value);
        conditions.push(`source = $${params.length}`);
      }
    }
  }

  return { conditions, params };
}

export default async function segmentRoutes(fastify) {
  // GET /api/segments — list segments with contact count
  fastify.get('/api/segments', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;

    try {
      const result = await query(
        `SELECT s.id, s.name, s.color, s.rules, s.is_default, s.created_at,
                COUNT(c.id) FILTER (WHERE c.status = 'active') as contact_count
         FROM segments s
         LEFT JOIN contacts c ON c.account_id = s.account_id
         WHERE s.account_id = $1
         GROUP BY s.id
         ORDER BY s.is_default DESC, s.name ASC`,
        [accountId]
      );

      // For segments with rules, we need to compute the actual filtered count.
      // For performance, we do this only for segments that have rules defined.
      const segments = await Promise.all(
        result.rows.map(async (seg) => {
          const rules = seg.rules || [];
          if (rules.length === 0) {
            // No rules: count all active contacts in account
            return { ...seg, contact_count: parseInt(seg.contact_count) };
          }

          const { conditions, params } = buildSegmentQuery(rules, [accountId]);
          let whereClause = 'account_id = $1 AND status = \'active\'';
          if (conditions.length > 0) {
            whereClause += ' AND ' + conditions.join(' AND ');
          }

          const countResult = await query(
            `SELECT COUNT(*) FROM contacts WHERE ${whereClause}`,
            params
          );

          return {
            ...seg,
            contact_count: parseInt(countResult.rows[0].count),
          };
        })
      );

      return reply.code(200).send({ segments });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/segments — create segment
  fastify.post('/api/segments', { preHandler: authenticate }, async (request, reply) => {
    const { name, color = '#4F7FFF', rules = [] } = request.body || {};
    const accountId = request.user.accountId;

    if (!name) {
      return reply.code(400).send({ error: 'Segment name is required' });
    }

    try {
      const result = await query(
        `INSERT INTO segments (account_id, name, color, rules)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [accountId, name, color, JSON.stringify(rules)]
      );

      return reply.code(201).send({ segment: result.rows[0] });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/segments/:id — update segment
  fastify.put('/api/segments/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const { name, color, rules } = request.body || {};
    const accountId = request.user.accountId;

    try {
      const existing = await query(
        'SELECT id FROM segments WHERE id = $1 AND account_id = $2',
        [id, accountId]
      );

      if (existing.rows.length === 0) {
        return reply.code(404).send({ error: 'Segment not found' });
      }

      const result = await query(
        `UPDATE segments
         SET name = COALESCE($1, name),
             color = COALESCE($2, color),
             rules = COALESCE($3, rules)
         WHERE id = $4 AND account_id = $5
         RETURNING *`,
        [name, color, rules ? JSON.stringify(rules) : null, id, accountId]
      );

      return reply.code(200).send({ segment: result.rows[0] });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/segments/:id — delete segment
  fastify.delete('/api/segments/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const accountId = request.user.accountId;

    try {
      const seg = await query(
        'SELECT id, is_default FROM segments WHERE id = $1 AND account_id = $2',
        [id, accountId]
      );

      if (seg.rows.length === 0) {
        return reply.code(404).send({ error: 'Segment not found' });
      }

      if (seg.rows[0].is_default) {
        return reply.code(400).send({ error: 'Cannot delete a default segment' });
      }

      await query('DELETE FROM segments WHERE id = $1 AND account_id = $2', [id, accountId]);

      return reply.code(200).send({ message: 'Segment deleted successfully' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/segments/:id/contacts — contacts matching segment rules
  fastify.get('/api/segments/:id/contacts', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const { page = 1, limit = 50 } = request.query;
    const accountId = request.user.accountId;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
      const segResult = await query(
        'SELECT * FROM segments WHERE id = $1 AND account_id = $2',
        [id, accountId]
      );

      if (segResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Segment not found' });
      }

      const segment = segResult.rows[0];
      const rules = segment.rules || [];

      const { conditions, params } = buildSegmentQuery(rules, [accountId]);
      let whereClause = 'account_id = $1 AND status = \'active\'';
      if (conditions.length > 0) {
        whereClause += ' AND ' + conditions.join(' AND ');
      }

      const countResult = await query(
        `SELECT COUNT(*) FROM contacts WHERE ${whereClause}`,
        params
      );

      const dataParams = [...params, parseInt(limit), offset];
      const contactsResult = await query(
        `SELECT id, email, first_name, last_name, company, phone, status, source,
                tags, custom_fields, birthday, created_at, updated_at
         FROM contacts
         WHERE ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );

      const total = parseInt(countResult.rows[0].count);

      return reply.code(200).send({
        segment,
        contacts: contactsResult.rows,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/segments/seed — seed default segments
  fastify.post('/api/segments/seed', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;

    const defaultSegments = [
      {
        name: 'All Contacts',
        color: '#4F7FFF',
        rules: [],
        is_default: true,
      },
      {
        name: 'Active Subscribers',
        color: '#22C55E',
        rules: [{ field: 'status', operator: 'equals', value: 'active' }],
        is_default: false,
      },
      {
        name: 'Newsletter Subscribers',
        color: '#F59E0B',
        rules: [{ field: 'tag', operator: 'contains', value: 'newsletter' }],
        is_default: false,
      },
      {
        name: 'Recent Signups (30 days)',
        color: '#8B5CF6',
        rules: [
          {
            field: 'created_at',
            operator: 'after',
            value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        is_default: false,
      },
      {
        name: 'Customers',
        color: '#EC4899',
        rules: [{ field: 'tag', operator: 'contains', value: 'customer' }],
        is_default: false,
      },
    ];

    try {
      const created = [];

      for (const seg of defaultSegments) {
        const result = await query(
          `INSERT INTO segments (account_id, name, color, rules, is_default)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING
           RETURNING *`,
          [accountId, seg.name, seg.color, JSON.stringify(seg.rules), seg.is_default]
        );

        if (result.rows.length > 0) {
          created.push(result.rows[0]);
        }
      }

      return reply.code(201).send({
        message: `Seeded ${created.length} default segments`,
        segments: created,
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
