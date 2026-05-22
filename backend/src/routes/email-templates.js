import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { renderTemplate } from '../services/templateService.js';

export default async function emailTemplateRoutes(fastify) {
  // GET /api/email-templates — list templates
  fastify.get('/api/email-templates', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;

    try {
      const result = await query(
        `SELECT id, account_id, name, description, subject,
                jsonb_array_length(blocks) AS block_count,
                created_at, updated_at
         FROM email_templates
         WHERE account_id = $1
         ORDER BY updated_at DESC`,
        [accountId]
      );
      return reply.send({ templates: result.rows });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to fetch email templates');
      return reply.code(500).send({ error: 'Failed to fetch email templates', detail: err.message });
    }
  });

  // POST /api/email-templates — create template
  fastify.post('/api/email-templates', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;
    const { name, description, subject, blocks } = request.body || {};

    if (!name || !name.trim()) {
      return reply.code(400).send({ error: 'Template name is required' });
    }

    try {
      const result = await query(
        `INSERT INTO email_templates (account_id, name, description, subject, blocks)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [accountId, name.trim(), description || null, subject || null, JSON.stringify(blocks || [])]
      );
      return reply.code(201).send({ template: result.rows[0] });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to create email template');
      return reply.code(500).send({ error: 'Failed to create email template', detail: err.message, stack: err.stack });
    }
  });

  // GET /api/email-templates/:id — get single template
  fastify.get('/api/email-templates/:id', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params;

    try {
      const result = await query(
        'SELECT * FROM email_templates WHERE id = $1 AND account_id = $2',
        [id, accountId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Email template not found' });
      }

      return reply.send({ template: result.rows[0] });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to fetch email template');
      return reply.code(500).send({ error: 'Failed to fetch email template', detail: err.message });
    }
  });

  // PUT /api/email-templates/:id — update template
  fastify.put('/api/email-templates/:id', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params;
    const { name, description, subject, blocks } = request.body || {};

    if (!name || !name.trim()) {
      return reply.code(400).send({ error: 'Template name is required' });
    }

    try {
      const result = await query(
        `UPDATE email_templates
         SET name = $1, description = $2, subject = $3, blocks = $4, updated_at = NOW()
         WHERE id = $5 AND account_id = $6
         RETURNING *`,
        [name.trim(), description || null, subject || null, JSON.stringify(blocks || []), id, accountId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Email template not found' });
      }

      return reply.send({ template: result.rows[0] });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to update email template');
      return reply.code(500).send({ error: 'Failed to update email template', detail: err.message, stack: err.stack });
    }
  });

  // DELETE /api/email-templates/:id — delete template
  fastify.delete('/api/email-templates/:id', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params;

    try {
      const result = await query(
        'DELETE FROM email_templates WHERE id = $1 AND account_id = $2 RETURNING id',
        [id, accountId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Email template not found' });
      }

      return reply.send({ success: true });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to delete email template');
      return reply.code(500).send({ error: 'Failed to delete email template', detail: err.message });
    }
  });

  // POST /api/email-templates/seed-presets — create starter templates for the account
  fastify.post('/api/email-templates/seed-presets', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;

    const PRESETS = [
      {
        name: 'Welcome Email',
        description: 'First email sent to new subscribers',
        subject: 'Welcome to {{company_name}}, {{first_name}}!',
        blocks: [
          { id: 1, type: 'hero', label: 'Hero Banner', content: { headline: 'Welcome, {{first_name}}!', subheadline: "We're thrilled to have you on board.", bgColor: '#4F7FFF' } },
          { id: 2, type: 'text', label: 'Text Block', content: { content: "Hi {{first_name}},\n\nThank you for joining us! We're excited to have you as part of our community.\n\nWe'll be sending you updates, tips, and exclusive content to help you get the most out of our platform." } },
          { id: 3, type: 'button', label: 'CTA Button', content: { label: 'Get Started', url: '{{preference_url}}', bgColor: '#4F7FFF' } },
          { id: 4, type: 'footer', label: 'Footer', content: { company: '{{company_name}}', address: '' } },
        ],
      },
      {
        name: 'Getting Started Guide',
        description: 'Onboarding email with key steps',
        subject: 'Your getting started guide, {{first_name}}',
        blocks: [
          { id: 1, type: 'hero', label: 'Hero Banner', content: { headline: "Let's get you started", subheadline: 'A few steps to make the most of your account', bgColor: '#0F172A' } },
          { id: 2, type: 'text', label: 'Text Block', content: { content: "Hi {{first_name}},\n\nHere are 3 quick steps to get you up and running:\n\n1. Complete your profile\n2. Explore the dashboard\n3. Set up your preferences\n\nWe're here to help every step of the way." } },
          { id: 3, type: 'button', label: 'CTA Button', content: { label: 'Go to Dashboard', url: '#', bgColor: '#22C55E' } },
          { id: 4, type: 'divider', label: 'Divider', content: {} },
          { id: 5, type: 'footer', label: 'Footer', content: { company: '{{company_name}}', address: '' } },
        ],
      },
      {
        name: 'Win-Back Campaign',
        description: 'Re-engage inactive subscribers',
        subject: "{{first_name}}, we miss you!",
        blocks: [
          { id: 1, type: 'hero', label: 'Hero Banner', content: { headline: 'We miss you, {{first_name}}', subheadline: "It's been a while. Come see what's new.", bgColor: '#7C3AED' } },
          { id: 2, type: 'text', label: 'Text Block', content: { content: "Hi {{first_name}},\n\nWe noticed you haven't been around in a while, and we wanted to reach out.\n\nWe've made some exciting improvements since you last visited. Come take a look!" } },
          { id: 3, type: 'button', label: 'CTA Button', content: { label: 'See What\'s New', url: '#', bgColor: '#7C3AED' } },
          { id: 4, type: 'footer', label: 'Footer', content: { company: '{{company_name}}', address: '' } },
        ],
      },
      {
        name: 'Birthday Greeting',
        description: 'Automated birthday email',
        subject: '🎉 Happy Birthday, {{first_name}}!',
        blocks: [
          { id: 1, type: 'hero', label: 'Hero Banner', content: { headline: '🎂 Happy Birthday, {{first_name}}!', subheadline: 'Wishing you a wonderful day', bgColor: '#F59E0B' } },
          { id: 2, type: 'text', label: 'Text Block', content: { content: "Hi {{first_name}},\n\nOn behalf of everyone at {{company_name}}, we want to wish you a very happy birthday!\n\nWe hope your day is filled with joy and celebration." } },
          { id: 3, type: 'button', label: 'CTA Button', content: { label: 'Claim Your Birthday Gift', url: '#', bgColor: '#F59E0B' } },
          { id: 4, type: 'footer', label: 'Footer', content: { company: '{{company_name}}', address: '' } },
        ],
      },
    ];

    try {
      const created = [];
      for (const preset of PRESETS) {
        // Skip if a template with this name already exists for this account
        const existing = await query(
          'SELECT id FROM email_templates WHERE account_id = $1 AND name = $2',
          [accountId, preset.name]
        );
        if (existing.rows.length > 0) continue;

        const result = await query(
          `INSERT INTO email_templates (account_id, name, description, subject, blocks)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [accountId, preset.name, preset.description, preset.subject, JSON.stringify(preset.blocks)]
        );
        created.push(result.rows[0]);
      }
      return reply.send({ created, skipped: PRESETS.length - created.length });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to seed preset templates');
      return reply.code(500).send({ error: 'Failed to seed presets', detail: err.message });
    }
  });

  // POST /api/email-templates/preview — render blocks with a contact for preview
  fastify.post('/api/email-templates/preview', { preHandler: authenticate }, async (request, reply) => {
    const accountId = request.user.accountId;
    const { blocks = [], contactId } = request.body || {};

    try {
      let contact = {};
      if (contactId) {
        const result = await query(
          `SELECT id, email, first_name, last_name, company, phone, sex, birthday, custom_fields
           FROM contacts WHERE id = $1 AND account_id = $2`,
          [contactId, accountId]
        );
        if (result.rows.length > 0) contact = result.rows[0];
      }

      const { html } = renderTemplate({
        blocks,
        contact,
        unsubscribeUrl: '#unsubscribe',
        preferenceUrl: '#preferences',
      });

      return reply.send({ html });
    } catch (err) {
      fastify.log.error({ err }, 'Failed to render preview');
      return reply.code(500).send({ error: 'Failed to render preview', detail: err.message });
    }
  });
}
