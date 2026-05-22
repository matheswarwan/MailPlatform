import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

/**
 * Evaluate segment rules against contacts.
 *
 * Rule format: { field, operator, value, value2?, fieldType? }
 *   - field: standard field key OR 'custom:fieldkey' for custom JSONB fields
 *   - value2: only used for 'between' operator on numbers
 *   - fieldType: required for custom fields to determine SQL casting
 *
 * Returns { conditions, params } to append to a base accounts query.
 * Caller must supply the first param ($1) as account_id.
 */
export function buildSegmentQuery(rules, baseParams = []) {
  const conditions = [];
  const params = [...baseParams];

  if (!Array.isArray(rules) || rules.length === 0) {
    return { conditions: [], params };
  }

  const TEXT_FIELDS = ['email', 'first_name', 'last_name', 'company', 'phone'];
  const DATE_FIELDS = ['birthday', 'created_at'];

  for (const rule of rules) {
    const { field, operator, value, value2, fieldType } = rule;
    if (!field || !operator) continue;

    // ── Custom JSONB fields ────────────────────────────────────────────────────
    if (field.startsWith('custom:')) {
      const fieldKey = field.slice(7); // strip 'custom:' prefix
      const col = `custom_fields->>'${fieldKey}'`;

      if (operator === 'is_empty') {
        conditions.push(`(${col} IS NULL OR ${col} = '')`);
        continue;
      }
      if (operator === 'is_not_empty') {
        conditions.push(`(${col} IS NOT NULL AND ${col} != '')`);
        continue;
      }

      if (value === undefined || value === null) continue;

      if (fieldType === 'text') {
        if (operator === 'contains') {
          params.push(`%${value}%`);
          conditions.push(`${col} ILIKE $${params.length}`);
        } else if (operator === 'not_contains') {
          params.push(`%${value}%`);
          conditions.push(`${col} NOT ILIKE $${params.length}`);
        } else if (operator === 'equals') {
          params.push(value);
          conditions.push(`${col} = $${params.length}`);
        } else if (operator === 'not_equals') {
          params.push(value);
          conditions.push(`${col} != $${params.length}`);
        } else if (operator === 'starts_with') {
          params.push(`${value}%`);
          conditions.push(`${col} ILIKE $${params.length}`);
        } else if (operator === 'ends_with') {
          params.push(`%${value}`);
          conditions.push(`${col} ILIKE $${params.length}`);
        }
      } else if (fieldType === 'number') {
        const numCol = `(${col})::numeric`;
        if (operator === 'equals') {
          params.push(value);
          conditions.push(`${numCol} = $${params.length}::numeric`);
        } else if (operator === 'not_equals') {
          params.push(value);
          conditions.push(`${numCol} != $${params.length}::numeric`);
        } else if (operator === 'greater_than') {
          params.push(value);
          conditions.push(`${numCol} > $${params.length}::numeric`);
        } else if (operator === 'less_than') {
          params.push(value);
          conditions.push(`${numCol} < $${params.length}::numeric`);
        } else if (operator === 'between' && value2 !== undefined && value2 !== null) {
          params.push(value);
          const p1 = params.length;
          params.push(value2);
          const p2 = params.length;
          conditions.push(`${numCol} BETWEEN $${p1}::numeric AND $${p2}::numeric`);
        }
      } else if (fieldType === 'date') {
        const dateCol = `(${col})::date`;
        if (operator === 'before') {
          params.push(value);
          conditions.push(`${dateCol} < $${params.length}::date`);
        } else if (operator === 'after') {
          params.push(value);
          conditions.push(`${dateCol} > $${params.length}::date`);
        } else if (operator === 'equals') {
          params.push(value);
          conditions.push(`${dateCol} = $${params.length}::date`);
        } else if (operator === 'within_last_days') {
          params.push(value);
          conditions.push(`${dateCol} >= (NOW() - INTERVAL '1 day' * $${params.length}::int)`);
        }
      } else if (fieldType === 'boolean') {
        if (operator === 'equals') {
          params.push(value);
          conditions.push(`(${col})::boolean = $${params.length}::boolean`);
        }
      }

      continue;
    }

    // ── Standard text fields ──────────────────────────────────────────────────
    if (TEXT_FIELDS.includes(field)) {
      if (operator === 'is_empty') {
        conditions.push(`(${field} IS NULL OR ${field} = '')`);
      } else if (operator === 'is_not_empty') {
        conditions.push(`(${field} IS NOT NULL AND ${field} != '')`);
      } else {
        if (value === undefined || value === null) continue;
        if (operator === 'contains') {
          params.push(`%${value}%`);
          conditions.push(`${field} ILIKE $${params.length}`);
        } else if (operator === 'not_contains') {
          params.push(`%${value}%`);
          conditions.push(`${field} NOT ILIKE $${params.length}`);
        } else if (operator === 'equals') {
          params.push(value);
          conditions.push(`${field} ILIKE $${params.length}`);
        } else if (operator === 'not_equals') {
          params.push(value);
          conditions.push(`${field} NOT ILIKE $${params.length}`);
        } else if (operator === 'starts_with') {
          params.push(`${value}%`);
          conditions.push(`${field} ILIKE $${params.length}`);
        } else if (operator === 'ends_with') {
          params.push(`%${value}`);
          conditions.push(`${field} ILIKE $${params.length}`);
        }
      }
      continue;
    }

    // ── sex ───────────────────────────────────────────────────────────────────
    if (field === 'sex') {
      if (operator === 'is_empty') {
        conditions.push(`sex IS NULL`);
      } else if (operator === 'is_not_empty') {
        conditions.push(`sex IS NOT NULL`);
      } else {
        if (value === undefined || value === null) continue;
        if (operator === 'equals') {
          params.push(value);
          conditions.push(`sex = $${params.length}`);
        } else if (operator === 'not_equals') {
          params.push(value);
          conditions.push(`sex != $${params.length}`);
        }
      }
      continue;
    }

    // ── age (derived from birthday) ───────────────────────────────────────────
    if (field === 'age') {
      if (value === undefined || value === null) continue;
      const ageExpr = `EXTRACT(YEAR FROM AGE(birthday::date))`;
      let cond = '';
      if (operator === 'equals') {
        params.push(value);
        cond = `${ageExpr} = $${params.length}::numeric`;
      } else if (operator === 'not_equals') {
        params.push(value);
        cond = `${ageExpr} != $${params.length}::numeric`;
      } else if (operator === 'greater_than') {
        params.push(value);
        cond = `${ageExpr} > $${params.length}::numeric`;
      } else if (operator === 'less_than') {
        params.push(value);
        cond = `${ageExpr} < $${params.length}::numeric`;
      } else if (operator === 'between' && value2 !== undefined && value2 !== null) {
        params.push(value);
        const p1 = params.length;
        params.push(value2);
        const p2 = params.length;
        cond = `${ageExpr} BETWEEN $${p1}::numeric AND $${p2}::numeric`;
      }
      if (cond) {
        conditions.push(`birthday IS NOT NULL AND (${cond})`);
      }
      continue;
    }

    // ── date fields (birthday, created_at) ────────────────────────────────────
    if (DATE_FIELDS.includes(field)) {
      if (value === undefined || value === null) continue;
      if (operator === 'before') {
        params.push(value);
        conditions.push(`${field}::date < $${params.length}::date`);
      } else if (operator === 'after') {
        params.push(value);
        conditions.push(`${field}::date > $${params.length}::date`);
      } else if (operator === 'equals') {
        params.push(value);
        conditions.push(`${field}::date = $${params.length}::date`);
      } else if (operator === 'within_last_days') {
        params.push(value);
        conditions.push(`${field}::date >= (NOW() - INTERVAL '1 day' * $${params.length}::int)`);
      }
      continue;
    }

    // ── status ────────────────────────────────────────────────────────────────
    if (field === 'status') {
      if (value === undefined || value === null) continue;
      if (operator === 'equals') {
        params.push(value);
        conditions.push(`status = $${params.length}`);
      } else if (operator === 'not_equals') {
        params.push(value);
        conditions.push(`status != $${params.length}`);
      }
      continue;
    }

    // ── tag (array) ───────────────────────────────────────────────────────────
    if (field === 'tag') {
      if (value === undefined || value === null) continue;
      if (operator === 'contains' || operator === 'equals') {
        params.push(value);
        conditions.push(`$${params.length} = ANY(tags)`);
      } else if (operator === 'not_contains') {
        params.push(value);
        conditions.push(`NOT ($${params.length} = ANY(tags))`);
      }
      continue;
    }

    // ── source ────────────────────────────────────────────────────────────────
    if (field === 'source') {
      if (value === undefined || value === null) continue;
      if (operator === 'equals') {
        params.push(value);
        conditions.push(`source = $${params.length}`);
      } else if (operator === 'not_equals') {
        params.push(value);
        conditions.push(`source != $${params.length}`);
      }
      continue;
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

  // POST /api/segments/preview — evaluate rules without saving, return matching count
  fastify.post('/api/segments/preview', { preHandler: authenticate }, async (request, reply) => {
    const { rules } = request.body || {};
    const accountId = request.user.accountId;

    if (!Array.isArray(rules)) {
      return reply.code(400).send({ error: 'rules must be an array' });
    }

    try {
      const { conditions, params } = buildSegmentQuery(rules, [accountId]);
      let whereClause = "account_id = $1 AND status = 'active'";
      if (conditions.length > 0) {
        whereClause += ' AND ' + conditions.join(' AND ');
      }

      const countResult = await query(
        `SELECT COUNT(*) FROM contacts WHERE ${whereClause}`,
        params
      );

      return reply.code(200).send({ count: parseInt(countResult.rows[0].count) });
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
