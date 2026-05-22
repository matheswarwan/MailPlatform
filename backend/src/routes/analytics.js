import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

/**
 * Translate period string to a PostgreSQL interval
 */
function periodToInterval(period) {
  const map = {
    '7d': '7 days',
    '30d': '30 days',
    '90d': '90 days',
    '1y': '1 year',
  };
  return map[period] || '30 days';
}

export default async function analyticsRoutes(fastify) {
  // GET /api/analytics/overview
  fastify.get('/api/analytics/overview', { preHandler: authenticate }, async (request, reply) => {
    const { period = '30d' } = request.query;
    const accountId = request.user.accountId;
    const interval = periodToInterval(period);

    try {
      // Aggregate send stats within the period
      const statsResult = await query(
        `SELECT
           COUNT(*) as total_sends,
           COUNT(*) FILTER (WHERE status = 'delivered') as total_delivered,
           COUNT(*) FILTER (WHERE status = 'bounced') as total_bounced,
           COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as total_opens,
           COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as total_clicks,
           COUNT(*) FILTER (WHERE unsubscribed_at IS NOT NULL) as total_unsubscribes
         FROM sends
         WHERE account_id = $1
           AND created_at >= NOW() - INTERVAL '${interval}'`,
        [accountId]
      );

      // Count active campaigns in period
      const campaignCountResult = await query(
        `SELECT COUNT(*) as campaign_count
         FROM campaigns
         WHERE account_id = $1
           AND status IN ('sent', 'sending')
           AND created_at >= NOW() - INTERVAL '${interval}'`,
        [accountId]
      );

      // Total active contacts
      const contactCountResult = await query(
        `SELECT COUNT(*) as total_contacts
         FROM contacts
         WHERE account_id = $1 AND status = 'active'`,
        [accountId]
      );

      // New contacts added in period
      const newContactsResult = await query(
        `SELECT COUNT(*) as new_contacts
         FROM contacts
         WHERE account_id = $1
           AND created_at >= NOW() - INTERVAL '${interval}'`,
        [accountId]
      );

      const s = statsResult.rows[0];
      const totalSends = parseInt(s.total_sends) || 0;
      const delivered = parseInt(s.total_delivered) || 0;
      const bounced = parseInt(s.total_bounced) || 0;
      const opens = parseInt(s.total_opens) || 0;
      const clicks = parseInt(s.total_clicks) || 0;
      const unsubscribes = parseInt(s.total_unsubscribes) || 0;

      // Daily sends for the period (chart data)
      const dailyResult = await query(
        `SELECT
           date_trunc('day', created_at) as date,
           COUNT(*) as sends,
           COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opens,
           COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicks
         FROM sends
         WHERE account_id = $1
           AND created_at >= NOW() - INTERVAL '${interval}'
         GROUP BY date
         ORDER BY date ASC`,
        [accountId]
      );

      return reply.code(200).send({
        period,
        overview: {
          total_sends: totalSends,
          total_delivered: delivered,
          total_bounced: bounced,
          total_opens: opens,
          total_clicks: clicks,
          total_unsubscribes: unsubscribes,
          open_rate: delivered > 0 ? parseFloat(((opens / delivered) * 100).toFixed(2)) : 0,
          click_rate: delivered > 0 ? parseFloat(((clicks / delivered) * 100).toFixed(2)) : 0,
          bounce_rate: totalSends > 0 ? parseFloat(((bounced / totalSends) * 100).toFixed(2)) : 0,
          unsubscribe_rate: delivered > 0
            ? parseFloat(((unsubscribes / delivered) * 100).toFixed(2))
            : 0,
          campaigns_sent: parseInt(campaignCountResult.rows[0].campaign_count) || 0,
          total_contacts: parseInt(contactCountResult.rows[0].total_contacts) || 0,
          new_contacts: parseInt(newContactsResult.rows[0].new_contacts) || 0,
        },
        daily_chart: dailyResult.rows,
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // GET /api/analytics/campaigns — list campaigns with stats
  fastify.get('/api/analytics/campaigns', { preHandler: authenticate }, async (request, reply) => {
    const { period = '30d', page = 1, limit = 20 } = request.query;
    const accountId = request.user.accountId;
    const interval = periodToInterval(period);
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
      const countResult = await query(
        `SELECT COUNT(*) FROM campaigns
         WHERE account_id = $1
           AND status IN ('sent', 'sending', 'scheduled')
           AND created_at >= NOW() - INTERVAL '${interval}'`,
        [accountId]
      );

      const result = await query(
        `SELECT
           c.id, c.name, c.subject_line, c.status, c.sent_at, c.created_at,
           COUNT(s.id) as total_sends,
           COUNT(s.id) FILTER (WHERE s.status = 'delivered') as total_delivered,
           COUNT(s.id) FILTER (WHERE s.opened_at IS NOT NULL) as total_opens,
           COUNT(s.id) FILTER (WHERE s.clicked_at IS NOT NULL) as total_clicks,
           COUNT(s.id) FILTER (WHERE s.status = 'bounced') as total_bounced,
           COUNT(s.id) FILTER (WHERE s.unsubscribed_at IS NOT NULL) as total_unsubscribes
         FROM campaigns c
         LEFT JOIN sends s ON s.campaign_id = c.id
         WHERE c.account_id = $1
           AND c.status IN ('sent', 'sending', 'scheduled')
           AND c.created_at >= NOW() - INTERVAL '${interval}'
         GROUP BY c.id
         ORDER BY c.sent_at DESC NULLS LAST, c.created_at DESC
         LIMIT $2 OFFSET $3`,
        [accountId, parseInt(limit), offset]
      );

      const total = parseInt(countResult.rows[0].count);

      const campaigns = result.rows.map((row) => {
        const delivered = parseInt(row.total_delivered) || 0;
        const opens = parseInt(row.total_opens) || 0;
        const clicks = parseInt(row.total_clicks) || 0;
        const totalSends = parseInt(row.total_sends) || 0;
        const bounced = parseInt(row.total_bounced) || 0;
        const unsubs = parseInt(row.total_unsubscribes) || 0;

        return {
          ...row,
          total_sends: totalSends,
          total_delivered: delivered,
          total_opens: opens,
          total_clicks: clicks,
          total_bounced: bounced,
          total_unsubscribes: unsubs,
          open_rate: delivered > 0 ? parseFloat(((opens / delivered) * 100).toFixed(2)) : 0,
          click_rate: delivered > 0 ? parseFloat(((clicks / delivered) * 100).toFixed(2)) : 0,
          bounce_rate: totalSends > 0 ? parseFloat(((bounced / totalSends) * 100).toFixed(2)) : 0,
          unsubscribe_rate: delivered > 0
            ? parseFloat(((unsubs / delivered) * 100).toFixed(2))
            : 0,
        };
      });

      return reply.code(200).send({
        period,
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

  // GET /api/analytics/campaigns/:id — detailed stats for one campaign
  fastify.get('/api/analytics/campaigns/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params;
    const accountId = request.user.accountId;

    try {
      const campaignResult = await query(
        `SELECT c.id, c.name, c.subject_line, c.status, c.from_email, c.sent_at,
                c.created_at, seg.name as segment_name
         FROM campaigns c
         LEFT JOIN segments seg ON seg.id = c.segment_id
         WHERE c.id = $1 AND c.account_id = $2`,
        [id, accountId]
      );

      if (campaignResult.rows.length === 0) {
        return reply.code(404).send({ error: 'Campaign not found' });
      }

      // Overall stats
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
           MAX(created_at) as last_send,
           AVG(EXTRACT(EPOCH FROM (opened_at - created_at)) / 3600)
             FILTER (WHERE opened_at IS NOT NULL) as avg_hours_to_open
         FROM sends
         WHERE campaign_id = $1 AND account_id = $2`,
        [id, accountId]
      );

      // Opens and clicks over time (hourly)
      const timelineResult = await query(
        `SELECT
           date_trunc('hour', opened_at) as hour,
           COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opens,
           COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicks
         FROM sends
         WHERE campaign_id = $1
           AND account_id = $2
           AND opened_at IS NOT NULL
         GROUP BY hour
         ORDER BY hour ASC`,
        [id, accountId]
      );

      // Recent openers / clickers (last 20)
      const recentActivityResult = await query(
        `SELECT
           s.id, s.status, s.opened_at, s.clicked_at, s.created_at,
           c.email, c.first_name, c.last_name
         FROM sends s
         JOIN contacts c ON c.id = s.contact_id
         WHERE s.campaign_id = $1 AND s.account_id = $2
           AND (s.opened_at IS NOT NULL OR s.clicked_at IS NOT NULL)
         ORDER BY GREATEST(s.opened_at, s.clicked_at) DESC NULLS LAST
         LIMIT 20`,
        [id, accountId]
      );

      const s = statsResult.rows[0];
      const totalSends = parseInt(s.total_sends) || 0;
      const delivered = parseInt(s.total_delivered) || 0;
      const bounced = parseInt(s.total_bounced) || 0;
      const opens = parseInt(s.total_opens) || 0;
      const clicks = parseInt(s.total_clicks) || 0;
      const unsubscribes = parseInt(s.total_unsubscribes) || 0;

      return reply.code(200).send({
        campaign: campaignResult.rows[0],
        stats: {
          total_sends: totalSends,
          total_delivered: delivered,
          total_bounced: bounced,
          total_pending: parseInt(s.total_pending) || 0,
          total_opens: opens,
          total_clicks: clicks,
          total_unsubscribes: unsubscribes,
          open_rate: delivered > 0 ? parseFloat(((opens / delivered) * 100).toFixed(2)) : 0,
          click_rate: delivered > 0 ? parseFloat(((clicks / delivered) * 100).toFixed(2)) : 0,
          bounce_rate: totalSends > 0 ? parseFloat(((bounced / totalSends) * 100).toFixed(2)) : 0,
          unsubscribe_rate: delivered > 0
            ? parseFloat(((unsubscribes / delivered) * 100).toFixed(2))
            : 0,
          first_send: s.first_send,
          last_send: s.last_send,
          avg_hours_to_open: s.avg_hours_to_open
            ? parseFloat(parseFloat(s.avg_hours_to_open).toFixed(2))
            : null,
        },
        timeline: timelineResult.rows,
        recent_activity: recentActivityResult.rows,
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
