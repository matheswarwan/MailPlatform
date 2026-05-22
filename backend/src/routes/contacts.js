import { parse } from 'csv-parse';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

export default async function contactRoutes(fastify) {
  // GET /api/contacts
  fastify.get('/api/contacts', { preHandler: authenticate }, async (request, reply) => {
    const {
      q,
      status,
      tag,
      page = 1,
      limit = 50,
    } = request.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [request.user.accountId];
    const conditions = ['account_id = $1'];

    if (q) {
      params.push(`%${q}%`);
      conditions.push(
        `(email ILIKE $${params.length} OR first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR company ILIKE $${params.length})`
      );
    }

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    if (tag) {
      params.push(tag);
      conditions.push(`$${params.length} = ANY(tags)`);
    }

    const whereClause = conditions.join(' AND ');

    try {
      const countResult = await query(
        `SELECT COUNT(*) FROM contacts WHERE ${whereClause}`,
        params
      );

      params.push(parseInt(limit));
      params.push(offset);

      const result = await query(
        `SELECT id, email, first_name, last_name, company, phone, status, source,
                tags, custom_fields, birthday, created_at, updated_at
         FROM contacts
         WHERE ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      const total = parseInt(countResult.rows[0].count);

      return reply.code(200).send({
        contacts: result.rows,
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

  // POST /api/contacts
  fastify.post('/api/contacts', { preHandler: authenticate }, async (request, reply) => {
    const {
      email,
      firstName,
      lastName,
      company,
      phone,
      status = 'active',
      source = 'manual',
      tags = [],
      customFields = {},
      birthday,
    } = request.body || {};

    if (!email) {
      return reply.code(400).send({ error: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return reply.code(400).send({ error: 'Invalid email address' });
    }

    try {
      const existing = await query(
        'SELECT id FROM contacts WHERE account_id = $1 AND email = $2',
        [request.user.accountId, email.toLowerCase()]
      );

      if (existing.rows.length > 0) {
        return reply.code(409).send({ error: 'A contact with this email already exists' });
      }

      const result = await query(
        `INSERT INTO contacts (account_id, email, first_name, last_name, company, phone, status, source, tags, custom_fields, birthday)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          request.user.accountId,
          email.toLowerCase(),
          firstName || null,
          lastName || null,
          company || null,
          phone || null,
          status,
          source,
          tags,
          JSON.stringify(customFields),
          birthday || null,
        ]
      );

      return reply.code(201).send({ contact: result.rows[0] });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/contacts/:id
  fastify.get('/api/contacts/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;

    try {
      const result = await query(
        `SELECT id, email, first_name, last_name, company, phone, status, source,
                tags, custom_fields, birthday, created_at, updated_at
         FROM contacts
         WHERE id = $1 AND account_id = $2`,
        [id, request.user.accountId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Contact not found' });
      }

      const contact = result.rows[0];

      // Get email history
      const historyResult = await query(
        `SELECT s.id, s.status, s.ses_message_id, s.opened_at, s.clicked_at,
                s.unsubscribed_at, s.created_at,
                c.name as campaign_name, c.subject_line
         FROM sends s
         JOIN campaigns c ON c.id = s.campaign_id
         WHERE s.contact_id = $1 AND s.account_id = $2
         ORDER BY s.created_at DESC
         LIMIT 50`,
        [id, request.user.accountId]
      );

      return reply.code(200).send({
        contact,
        emailHistory: historyResult.rows,
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/contacts/:id
  fastify.put('/api/contacts/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const {
      email,
      firstName,
      lastName,
      company,
      phone,
      status,
      tags,
      customFields,
      birthday,
    } = request.body || {};

    try {
      const existing = await query(
        'SELECT id FROM contacts WHERE id = $1 AND account_id = $2',
        [id, request.user.accountId]
      );

      if (existing.rows.length === 0) {
        return reply.code(404).send({ error: 'Contact not found' });
      }

      const result = await query(
        `UPDATE contacts
         SET email = COALESCE($1, email),
             first_name = COALESCE($2, first_name),
             last_name = COALESCE($3, last_name),
             company = COALESCE($4, company),
             phone = COALESCE($5, phone),
             status = COALESCE($6, status),
             tags = COALESCE($7, tags),
             custom_fields = COALESCE($8, custom_fields),
             birthday = COALESCE($9, birthday),
             updated_at = NOW()
         WHERE id = $10 AND account_id = $11
         RETURNING *`,
        [
          email ? email.toLowerCase() : null,
          firstName,
          lastName,
          company,
          phone,
          status,
          tags,
          customFields ? JSON.stringify(customFields) : null,
          birthday,
          id,
          request.user.accountId,
        ]
      );

      return reply.code(200).send({ contact: result.rows[0] });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/contacts/:id
  fastify.delete('/api/contacts/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;

    try {
      const result = await query(
        'DELETE FROM contacts WHERE id = $1 AND account_id = $2 RETURNING id',
        [id, request.user.accountId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Contact not found' });
      }

      return reply.code(200).send({ message: 'Contact deleted successfully' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/contacts/:id/history
  fastify.get('/api/contacts/:id/history', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const { page = 1, limit = 20 } = request.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
      const contactCheck = await query(
        'SELECT id FROM contacts WHERE id = $1 AND account_id = $2',
        [id, request.user.accountId]
      );

      if (contactCheck.rows.length === 0) {
        return reply.code(404).send({ error: 'Contact not found' });
      }

      const countResult = await query(
        'SELECT COUNT(*) FROM sends WHERE contact_id = $1 AND account_id = $2',
        [id, request.user.accountId]
      );

      const result = await query(
        `SELECT s.id, s.status, s.ses_message_id, s.opened_at, s.clicked_at,
                s.unsubscribed_at, s.created_at,
                c.id as campaign_id, c.name as campaign_name, c.subject_line,
                c.sent_at as campaign_sent_at
         FROM sends s
         JOIN campaigns c ON c.id = s.campaign_id
         WHERE s.contact_id = $1 AND s.account_id = $2
         ORDER BY s.created_at DESC
         LIMIT $3 OFFSET $4`,
        [id, request.user.accountId, parseInt(limit), offset]
      );

      const total = parseInt(countResult.rows[0].count);

      return reply.code(200).send({
        history: result.rows,
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

  // POST /api/contacts/import - CSV import
  fastify.post('/api/contacts/import', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;

    try {
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      const mimeType = data.mimetype;
      if (!mimeType.includes('csv') && !mimeType.includes('text')) {
        return reply.code(400).send({ error: 'Only CSV files are supported' });
      }

      const chunks = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const csvContent = Buffer.concat(chunks).toString('utf8');

      const records = await new Promise((resolve, reject) => {
        parse(csvContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          bom: true,
        }, (err, records) => {
          if (err) reject(err);
          else resolve(records);
        });
      });

      if (records.length === 0) {
        return reply.code(400).send({ error: 'CSV file is empty or has no valid records' });
      }

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      const errors = [];

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNum = i + 2; // account for header row

        // Normalize column names (support various common header names)
        const email = (row.email || row.Email || row.EMAIL || '').trim().toLowerCase();
        const firstName = row.first_name || row.firstName || row.FirstName || row['First Name'] || '';
        const lastName = row.last_name || row.lastName || row.LastName || row['Last Name'] || '';
        const company = row.company || row.Company || row.COMPANY || '';
        const phone = row.phone || row.Phone || row.PHONE || '';
        const tagsRaw = row.tags || row.Tags || '';
        const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

        if (!email) {
          errors.push({ row: rowNum, error: 'Missing email' });
          skipped++;
          continue;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          errors.push({ row: rowNum, email, error: 'Invalid email format' });
          skipped++;
          continue;
        }

        try {
          const result = await query(
            `INSERT INTO contacts (account_id, email, first_name, last_name, company, phone, tags, source)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'import')
             ON CONFLICT (account_id, email) DO UPDATE SET
               first_name = EXCLUDED.first_name,
               last_name = EXCLUDED.last_name,
               company = EXCLUDED.company,
               phone = EXCLUDED.phone,
               tags = CASE
                 WHEN array_length(EXCLUDED.tags, 1) > 0
                 THEN array(SELECT DISTINCT unnest(contacts.tags || EXCLUDED.tags))
                 ELSE contacts.tags
               END,
               updated_at = NOW()
             RETURNING (xmax = 0) as is_insert`,
            [
              accountId,
              email,
              firstName || null,
              lastName || null,
              company || null,
              phone || null,
              tags,
            ]
          );

          if (result.rows[0].is_insert) {
            imported++;
          } else {
            updated++;
          }
        } catch (rowErr) {
          errors.push({ row: rowNum, email, error: rowErr.message });
          skipped++;
        }
      }

      return reply.code(200).send({
        summary: {
          total: records.length,
          imported,
          updated,
          skipped,
        },
        errors: errors.slice(0, 50), // cap error list
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Failed to process CSV file' });
    }
  });

  // POST /api/contacts/bulk
  fastify.post('/api/contacts/bulk', { preHandler: authenticate }, async (request, reply) => {
    const { action, contactIds, tag } = request.body || {};
    const accountId = request.user.accountId;

    if (!action || !contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return reply.code(400).send({ error: 'action and contactIds are required' });
    }

    const validActions = ['addTag', 'removeTag', 'delete', 'unsubscribe'];
    if (!validActions.includes(action)) {
      return reply.code(400).send({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` });
    }

    try {
      let affected = 0;

      if (action === 'addTag') {
        if (!tag) {
          return reply.code(400).send({ error: 'tag is required for addTag action' });
        }
        const result = await query(
          `UPDATE contacts
           SET tags = array(SELECT DISTINCT unnest(tags || ARRAY[$1::text])),
               updated_at = NOW()
           WHERE id = ANY($2::uuid[]) AND account_id = $3`,
          [tag, contactIds, accountId]
        );
        affected = result.rowCount;
      } else if (action === 'removeTag') {
        if (!tag) {
          return reply.code(400).send({ error: 'tag is required for removeTag action' });
        }
        const result = await query(
          `UPDATE contacts
           SET tags = array_remove(tags, $1),
               updated_at = NOW()
           WHERE id = ANY($2::uuid[]) AND account_id = $3`,
          [tag, contactIds, accountId]
        );
        affected = result.rowCount;
      } else if (action === 'delete') {
        const result = await query(
          'DELETE FROM contacts WHERE id = ANY($1::uuid[]) AND account_id = $2',
          [contactIds, accountId]
        );
        affected = result.rowCount;
      } else if (action === 'unsubscribe') {
        const result = await query(
          `UPDATE contacts
           SET status = 'unsubscribed', updated_at = NOW()
           WHERE id = ANY($1::uuid[]) AND account_id = $2`,
          [contactIds, accountId]
        );
        affected = result.rowCount;
      }

      return reply.code(200).send({
        message: `Bulk action '${action}' completed`,
        affected,
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
