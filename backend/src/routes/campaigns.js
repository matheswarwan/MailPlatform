import {
  ListIdentitiesCommand,
  GetIdentityVerificationAttributesCommand,
} from '@aws-sdk/client-ses';
import { sesClient } from '../config/aws.js';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

/**
 * Check if an email address is a verified SES sender identity.
 * Passes if the exact email is verified OR if its domain is verified.
 * Returns { ok: true } or { ok: false, verifiedIdentities: [...] }
 */
async function validateFromEmail(fromEmail) {
  const domain = fromEmail.split('@')[1]?.toLowerCase();
  const emailLower = fromEmail.toLowerCase();

  const [emailRes, domainRes] = await Promise.all([
    sesClient.send(new ListIdentitiesCommand({ IdentityType: 'EmailAddress' })),
    sesClient.send(new ListIdentitiesCommand({ IdentityType: 'Domain' })),
  ]);

  const allIdentities = [
    ...(emailRes.Identities || []),
    ...(domainRes.Identities || []),
  ];

  if (allIdentities.length === 0) {
    return { ok: false, verifiedIdentities: [] };
  }

  const verifyRes = await sesClient.send(
    new GetIdentityVerificationAttributesCommand({ Identities: allIdentities })
  );
  const attrs = verifyRes.VerificationAttributes || {};

  const verifiedEmails = (emailRes.Identities || [])
    .filter((id) => attrs[id]?.VerificationStatus === 'Success')
    .map((id) => id.toLowerCase());

  const verifiedDomains = (domainRes.Identities || [])
    .filter((id) => attrs[id]?.VerificationStatus === 'Success')
    .map((id) => id.toLowerCase());

  const ok =
    verifiedEmails.includes(emailLower) ||
    (domain && verifiedDomains.includes(domain));

  return {
    ok,
    verifiedEmails,
    verifiedDomains,
  };
}

export default async function campaignRoutes(fastify) {
  // GET /api/campaigns — list campaigns with stats
  fastify.get('/api/campaigns', { preHandler: authenticate }, async (request, reply) => {
    const { status, page = 1, limit = 20 } = request.query;
    const accountId = request.user.accountId;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const params = [accountId];
    let whereClause = 'c.account_id = $1';

    if (status) {
      params.push(status);
      whereClause += ` AND c.status = $${params.length}`;
    }

    try {
      const countResult = await query(
        `SELECT COUNT(*) FROM campaigns c WHERE ${whereClause}`,
        params
      );

      const dataParams = [...params, parseInt(limit), offset];
      const result = await query(
        `SELECT
           c.id, c.name, c.subject_line, c.preview_text, c.from_name, c.from_email,
           c.reply_to, c.status, c.segment_id, c.template_id, c.scheduled_at,
           c.sent_at, c.created_at, c.updated_at,
           seg.name as segment_name,
           COUNT(s.id) FILTER (WHERE s.status IS NOT NULL) as total_sent,
           COUNT(s.id) FILTER (WHERE s.status = 'delivered') as total_delivered,
           COUNT(s.id) FILTER (WHERE s.opened_at IS NOT NULL) as total_opens,
           COUNT(s.id) FILTER (WHERE s.clicked_at IS NOT NULL) as total_clicks,
           COUNT(s.id) FILTER (WHERE s.status = 'bounced') as total_bounces,
           COUNT(s.id) FILTER (WHERE s.unsubscribed_at IS NOT NULL) as total_unsubscribes
         FROM campaigns c
         LEFT JOIN segments seg ON seg.id = c.segment_id
         LEFT JOIN sends s ON s.campaign_id = c.id
         WHERE ${whereClause}
         GROUP BY c.id, seg.name
         ORDER BY c.created_at DESC
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      );

      const total = parseInt(countResult.rows[0].count);

      const campaigns = result.rows.map((row) => {
        const delivered = parseInt(row.total_delivered) || 0;
        const opens = parseInt(row.total_opens) || 0;
        const clicks = parseInt(row.total_clicks) || 0;
        const bounces = parseInt(row.total_bounces) || 0;
        const unsubs = parseInt(row.total_unsubscribes) || 0;

        return {
          ...row,
          total_sent: parseInt(row.total_sent) || 0,
          total_delivered: delivered,
          total_opens: opens,
          total_clicks: clicks,
          total_bounces: bounces,
          total_unsubscribes: unsubs,
          open_rate: delivered > 0 ? parseFloat(((opens / delivered) * 100).toFixed(2)) : 0,
          click_rate: delivered > 0 ? parseFloat(((clicks / delivered) * 100).toFixed(2)) : 0,
          bounce_rate: parseInt(row.total_sent) > 0
            ? parseFloat(((bounces / parseInt(row.total_sent)) * 100).toFixed(2))
            : 0,
          unsubscribe_rate: delivered > 0 ? parseFloat(((unsubs / delivered) * 100).toFixed(2)) : 0,
        };
      });

      return reply.code(200).send({
        campaigns,
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

  // POST /api/campaigns — create campaign
  fastify.post('/api/campaigns', { preHandler: authenticate }, async (request, reply) => {
    const {
      name,
      subjectLine, subject,  // accept both
      previewText,
      fromName,
      fromEmail,
      replyTo,
      segmentId,
      templateId,
      blocks,               // auto-create template from blocks if provided
    } = request.body || {};
    const accountId = request.user.accountId;
    const resolvedSubject = subjectLine || subject || null;

    if (!name) {
      return reply.code(400).send({ error: 'Campaign name is required' });
    }

    try {
      if (segmentId) {
        const seg = await query(
          'SELECT id FROM segments WHERE id = $1 AND account_id = $2',
          [segmentId, accountId]
        );
        if (seg.rows.length === 0) {
          return reply.code(400).send({ error: 'Segment not found' });
        }
      }

      // Fall back to account defaults for from_name / from_email
      const account = await query(
        'SELECT from_name, from_email FROM accounts WHERE id = $1',
        [accountId]
      );
      const acct = account.rows[0] || {};

      // Auto-create a template from blocks if provided
      let resolvedTemplateId = templateId || null;
      if (blocks && Array.isArray(blocks) && blocks.length > 0) {
        const tmplResult = await query(
          `INSERT INTO templates (account_id, name, blocks) VALUES ($1, $2, $3) RETURNING id`,
          [accountId, `${name} — Template`, JSON.stringify(blocks)]
        );
        resolvedTemplateId = tmplResult.rows[0].id;
      }

      const result = await query(
        `INSERT INTO campaigns
           (account_id, name, subject_line, preview_text, from_name, from_email,
            reply_to, segment_id, template_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft')
         RETURNING *`,
        [
          accountId,
          name,
          resolvedSubject,
          previewText || null,
          fromName || acct.from_name || null,
          fromEmail || acct.from_email || null,
          replyTo || null,
          segmentId || null,
          resolvedTemplateId,
        ]
      );

      return reply.code(201).send({ campaign: result.rows[0] });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/campaigns/:id — get campaign detail
  fastify.get('/api/campaigns/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const accountId = request.user.accountId;

    try {
      const result = await query(
        `SELECT c.*, seg.name as segment_name, t.name as template_name, t.blocks as template_blocks
         FROM campaigns c
         LEFT JOIN segments seg ON seg.id = c.segment_id
         LEFT JOIN templates t ON t.id = c.template_id
         WHERE c.id = $1 AND c.account_id = $2`,
        [id, accountId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({ error: 'Campaign not found' });
      }

      return reply.code(200).send({ campaign: result.rows[0] });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // PUT /api/campaigns/:id — update campaign
  fastify.put('/api/campaigns/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const {
      name,
      subjectLine, subject,  // accept both
      previewText,
      fromName,
      fromEmail,
      replyTo,
      segmentId,
      templateId,
      blocks,
    } = request.body || {};
    const resolvedSubject = subjectLine || subject || undefined;
    const accountId = request.user.accountId;

    try {
      const existing = await query(
        'SELECT id, status FROM campaigns WHERE id = $1 AND account_id = $2',
        [id, accountId]
      );

      if (existing.rows.length === 0) {
        return reply.code(404).send({ error: 'Campaign not found' });
      }

      if (existing.rows[0].status === 'sent') {
        return reply.code(400).send({ error: 'Cannot edit a sent campaign' });
      }

      // Auto-create/update template from blocks if provided
      let resolvedTemplateId = templateId || undefined;
      if (blocks && Array.isArray(blocks) && blocks.length > 0) {
        const existingCampaign = await query(
          'SELECT template_id FROM campaigns WHERE id = $1',
          [id]
        );
        const existingTemplateId = existingCampaign.rows[0]?.template_id;

        if (existingTemplateId) {
          await query(
            'UPDATE templates SET blocks = $1, updated_at = NOW() WHERE id = $2 AND account_id = $3',
            [JSON.stringify(blocks), existingTemplateId, accountId]
          );
          resolvedTemplateId = existingTemplateId;
        } else {
          const tmplResult = await query(
            `INSERT INTO templates (account_id, name, blocks) VALUES ($1, $2, $3) RETURNING id`,
            [accountId, `${name || 'Campaign'} — Template`, JSON.stringify(blocks)]
          );
          resolvedTemplateId = tmplResult.rows[0].id;
        }
      }

      const result = await query(
        `UPDATE campaigns
         SET name = COALESCE($1, name),
             subject_line = COALESCE($2, subject_line),
             preview_text = COALESCE($3, preview_text),
             from_name = COALESCE($4, from_name),
             from_email = COALESCE($5, from_email),
             reply_to = COALESCE($6, reply_to),
             segment_id = COALESCE($7, segment_id),
             template_id = COALESCE($8, template_id),
             updated_at = NOW()
         WHERE id = $9 AND account_id = $10
         RETURNING *`,
        [
          name,
          resolvedSubject,
          previewText,
          fromName,
          fromEmail,
          replyTo,
          segmentId,
          resolvedTemplateId,
          id,
          accountId,
        ]
      );

      return reply.code(200).send({ campaign: result.rows[0] });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // DELETE /api/campaigns/:id — delete draft campaign
  fastify.delete('/api/campaigns/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const accountId = request.user.accountId;

    try {
      const existing = await query(
        'SELECT id, status FROM campaigns WHERE id = $1 AND account_id = $2',
        [id, accountId]
      );

      if (existing.rows.length === 0) {
        return reply.code(404).send({ error: 'Campaign not found' });
      }

      if (existing.rows[0].status === 'sent') {
        return reply.code(400).send({ error: 'Cannot delete a sent campaign' });
      }

      await query('DELETE FROM campaigns WHERE id = $1 AND account_id = $2', [id, accountId]);

      return reply.code(200).send({ message: 'Campaign deleted successfully' });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/campaigns/:id/send — trigger send NOW
  fastify.post('/api/campaigns/:id/send', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const accountId = request.user.accountId;

    try {
      const existing = await query(
        'SELECT id, status, subject_line, from_email, segment_id, template_id FROM campaigns WHERE id = $1 AND account_id = $2',
        [id, accountId]
      );

      if (existing.rows.length === 0) {
        return reply.code(404).send({ error: 'Campaign not found' });
      }

      const campaign = existing.rows[0];

      if (campaign.status === 'sent') {
        return reply.code(400).send({ error: 'Campaign has already been sent' });
      }

      if (campaign.status === 'sending') {
        return reply.code(400).send({ error: 'Campaign is already being sent' });
      }

      if (!campaign.subject_line) {
        return reply.code(400).send({ error: 'Campaign must have a subject line before sending' });
      }

      if (!campaign.from_email) {
        return reply.code(400).send({ error: 'Campaign must have a from email before sending' });
      }

      if (!campaign.template_id) {
        return reply.code(400).send({ error: 'Campaign must have a template before sending' });
      }

      // Validate from_email is a verified SES identity
      fastify.log.info(
        { campaignId: id, fromEmail: campaign.from_email },
        '[campaigns] Validating from_email against SES verified identities'
      );
      try {
        const sesCheck = await validateFromEmail(campaign.from_email);
        if (!sesCheck.ok) {
          const hint = sesCheck.verifiedEmails.length > 0 || sesCheck.verifiedDomains.length > 0
            ? ` Verified senders: ${[...sesCheck.verifiedEmails, ...sesCheck.verifiedDomains.map((d) => `*@${d}`)].join(', ')}`
            : ' No verified identities found in SES. Verify an email or domain in the AWS SES console first.';
          fastify.log.warn(
            { campaignId: id, fromEmail: campaign.from_email, verifiedEmails: sesCheck.verifiedEmails, verifiedDomains: sesCheck.verifiedDomains },
            '[campaigns] from_email is not a verified SES identity'
          );
          return reply.code(400).send({
            error: `From email "${campaign.from_email}" is not a verified SES identity.${hint}`,
          });
        }
        fastify.log.info(
          { campaignId: id, fromEmail: campaign.from_email },
          '[campaigns] from_email SES verification passed'
        );
      } catch (sesErr) {
        // Non-fatal: if SES identity check fails (e.g. no AWS creds in dev), log and proceed
        fastify.log.warn(
          { err: sesErr, campaignId: id },
          '[campaigns] Could not verify from_email against SES — skipping check'
        );
      }

      // Mark campaign as sending immediately (returns quickly, processing happens async)
      await query(
        'UPDATE campaigns SET status = $1, updated_at = NOW() WHERE id = $2',
        ['sending', id]
      );

      fastify.log.info(
        { campaignId: id, accountId, fromEmail: campaign.from_email, segmentId: campaign.segment_id },
        '[campaigns] Campaign send initiated'
      );

      // Import campaignEngine dynamically to avoid circular dependency issues at startup
      const { sendCampaign } = await import('../services/campaignEngine.js');

      // Run async — do not await so the HTTP response returns quickly
      sendCampaign(id, accountId).catch((err) => {
        fastify.log.error({ err, campaignId: id }, '[campaigns] Campaign send failed — resetting to draft');
        query(
          'UPDATE campaigns SET status = $1, updated_at = NOW() WHERE id = $2',
          ['draft', id]
        ).catch(() => {});
      });

      return reply.code(202).send({
        message: 'Campaign send initiated',
        campaignId: id,
      });
    } catch (err) {
      fastify.log.error({ err, campaignId: id }, '[campaigns] Send route error');
      return reply.code(500).send({ error: `Internal server error: ${err.message}` });
    }
  });

  // POST /api/campaigns/:id/schedule — schedule campaign
  fastify.post('/api/campaigns/:id/schedule', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const { scheduledAt } = request.body || {};
    const accountId = request.user.accountId;

    if (!scheduledAt) {
      return reply.code(400).send({ error: 'scheduledAt is required' });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return reply.code(400).send({ error: 'Invalid scheduledAt date' });
    }

    if (scheduledDate <= new Date()) {
      return reply.code(400).send({ error: 'scheduledAt must be in the future' });
    }

    try {
      const existing = await query(
        'SELECT id, status FROM campaigns WHERE id = $1 AND account_id = $2',
        [id, accountId]
      );

      if (existing.rows.length === 0) {
        return reply.code(404).send({ error: 'Campaign not found' });
      }

      if (existing.rows[0].status === 'sent') {
        return reply.code(400).send({ error: 'Campaign has already been sent' });
      }

      const result = await query(
        `UPDATE campaigns
         SET status = 'scheduled', scheduled_at = $1, updated_at = NOW()
         WHERE id = $2 AND account_id = $3
         RETURNING *`,
        [scheduledDate.toISOString(), id, accountId]
      );

      return reply.code(200).send({
        campaign: result.rows[0],
        message: `Campaign scheduled for ${scheduledDate.toISOString()}`,
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/campaigns/:id/stats — per-campaign analytics
  fastify.get('/api/campaigns/:id/stats', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const accountId = request.user.accountId;

    try {
      const campaignResult = await query(
        'SELECT id, name, subject_line, status, sent_at FROM campaigns WHERE id = $1 AND account_id = $2',
        [id, accountId]
      );

      if (campaignResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Campaign not found' });
      }

      const statsResult = await query(
        `SELECT
           COUNT(*) as total_sends,
           COUNT(*) FILTER (WHERE status = 'delivered') as total_delivered,
           COUNT(*) FILTER (WHERE status = 'bounced') as total_bounced,
           COUNT(*) FILTER (WHERE status = 'pending') as total_pending,
           COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as total_opens,
           COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as total_clicks,
           COUNT(*) FILTER (WHERE unsubscribed_at IS NOT NULL) as total_unsubscribes,
           MIN(created_at) as first_send,
           MAX(created_at) as last_send
         FROM sends
         WHERE campaign_id = $1 AND account_id = $2`,
        [id, accountId]
      );

      const stats = statsResult.rows[0];
      const totalSends = parseInt(stats.total_sends) || 0;
      const delivered = parseInt(stats.total_delivered) || 0;
      const opens = parseInt(stats.total_opens) || 0;
      const clicks = parseInt(stats.total_clicks) || 0;
      const bounced = parseInt(stats.total_bounced) || 0;
      const unsubscribes = parseInt(stats.total_unsubscribes) || 0;

      // Hourly send distribution (last 48 hours of sends)
      const hourlyResult = await query(
        `SELECT
           date_trunc('hour', created_at) as hour,
           COUNT(*) as count
         FROM sends
         WHERE campaign_id = $1 AND account_id = $2
         GROUP BY hour
         ORDER BY hour ASC`,
        [id, accountId]
      );

      return reply.code(200).send({
        campaign: campaignResult.rows[0],
        stats: {
          total_sends: totalSends,
          total_delivered: delivered,
          total_bounced: bounced,
          total_pending: parseInt(stats.total_pending) || 0,
          total_opens: opens,
          total_clicks: clicks,
          total_unsubscribes: unsubscribes,
          open_rate: delivered > 0 ? parseFloat(((opens / delivered) * 100).toFixed(2)) : 0,
          click_rate: delivered > 0 ? parseFloat(((clicks / delivered) * 100).toFixed(2)) : 0,
          bounce_rate: totalSends > 0 ? parseFloat(((bounced / totalSends) * 100).toFixed(2)) : 0,
          unsubscribe_rate: delivered > 0 ? parseFloat(((unsubscribes / delivered) * 100).toFixed(2)) : 0,
          first_send: stats.first_send,
          last_send: stats.last_send,
        },
        hourly_distribution: hourlyResult.rows,
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
