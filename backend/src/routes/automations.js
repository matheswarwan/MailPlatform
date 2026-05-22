import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

export default async function automationRoutes(fastify) {
  // GET /api/automations — list automations
  fastify.get('/api/automations', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;
    const { page = 1, limit = 20 } = request.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
      const countResult = await query(
        'SELECT COUNT(*) FROM automations WHERE account_id = $1',
        [accountId]
      );

      const result = await query(
        `SELECT id, name, trigger_type, trigger_config, is_active, steps, created_at, updated_at
         FROM automations
         WHERE account_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [accountId, parseInt(limit), offset]
      );

      const total = parseInt(countResult.rows[0].count);

      return reply.code(200).send({
        automations: result.rows,
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

  // POST /api/automations — create automation
  fastify.post('/api/automations', { preHandler: authenticate }, async (request, reply) => {
    const {
      name,
      triggerType,
      triggerConfig = {},
      steps = [],
    } = request.body || {};
    const accountId = request.user.accountId;

    if (!name) {
      return reply.code(400).send({ error: 'Automation name is required' });
    }

    const validTriggerTypes = [
      'contact_added',
      'tag_added',
      'form_submission',
      'date_based',
      'campaign_opened',
      'campaign_clicked',
      'purchase',
      'manual',
    ];

    if (triggerType && !validTriggerTypes.includes(triggerType)) {
      return reply.code(400).send({
        error: `Invalid trigger type. Must be one of: ${validTriggerTypes.join(', ')}`,
      });
    }

    try {
      const result = await query(
        `INSERT INTO automations (account_id, name, trigger_type, trigger_config, steps, is_active)
         VALUES ($1, $2, $3, $4, $5, FALSE)
         RETURNING *`,
        [
          accountId,
          name,
          triggerType || null,
          JSON.stringify(triggerConfig),
          JSON.stringify(steps),
        ]
      );

      return reply.code(201).send({ automation: result.rows[0] });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/automations/:id — get automation
  fastify.get('/api/automations/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const accountId = request.user.accountId;

    try {
      const result = await query(
        `SELECT id, name, trigger_type, trigger_config, is_active, steps, created_at, updated_at
         FROM automations
         WHERE id = $1 AND account_id = $2`,
        [id, accountId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Automation not found' });
      }

      return reply.code(200).send({ automation: result.rows[0] });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/automations/:id — update automation
  fastify.put('/api/automations/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const {
      name,
      triggerType,
      triggerConfig,
      steps,
    } = request.body || {};
    const accountId = request.user.accountId;

    try {
      const existing = await query(
        'SELECT id FROM automations WHERE id = $1 AND account_id = $2',
        [id, accountId]
      );

      if (existing.rows.length === 0) {
        return reply.code(404).send({ error: 'Automation not found' });
      }

      const result = await query(
        `UPDATE automations
         SET name = COALESCE($1, name),
             trigger_type = COALESCE($2, trigger_type),
             trigger_config = COALESCE($3, trigger_config),
             steps = COALESCE($4, steps),
             updated_at = NOW()
         WHERE id = $5 AND account_id = $6
         RETURNING *`,
        [
          name,
          triggerType,
          triggerConfig ? JSON.stringify(triggerConfig) : null,
          steps ? JSON.stringify(steps) : null,
          id,
          accountId,
        ]
      );

      return reply.code(200).send({ automation: result.rows[0] });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/automations/:id — delete automation
  fastify.delete('/api/automations/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const accountId = request.user.accountId;

    try {
      const result = await query(
        'DELETE FROM automations WHERE id = $1 AND account_id = $2 RETURNING id',
        [id, accountId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Automation not found' });
      }

      return reply.code(200).send({ message: 'Automation deleted successfully' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // PATCH /api/automations/:id/toggle — toggle is_active
  fastify.patch('/api/automations/:id/toggle', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const accountId = request.user.accountId;

    try {
      const existing = await query(
        'SELECT id, is_active, trigger_type, steps FROM automations WHERE id = $1 AND account_id = $2',
        [id, accountId]
      );

      if (existing.rows.length === 0) {
        return reply.code(404).send({ error: 'Automation not found' });
      }

      const automation = existing.rows[0];

      // Validate automation has required fields before activating
      if (!automation.is_active) {
        if (!automation.trigger_type) {
          return reply.code(400).send({
            error: 'Cannot activate automation: trigger type is not set',
          });
        }

        const steps = automation.steps || [];
        if (!Array.isArray(steps) || steps.length === 0) {
          return reply.code(400).send({
            error: 'Cannot activate automation: no steps defined',
          });
        }
      }

      const result = await query(
        `UPDATE automations
         SET is_active = NOT is_active, updated_at = NOW()
         WHERE id = $1 AND account_id = $2
         RETURNING id, name, is_active, updated_at`,
        [id, accountId]
      );

      const updated = result.rows[0];

      return reply.code(200).send({
        automation: updated,
        message: updated.is_active ? 'Automation activated' : 'Automation deactivated',
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
