import { query } from '../config/database.js';
import { suppress } from '../services/suppressionService.js';

/**
 * Fetch the SNS SubscribeURL to confirm a subscription.
 * We use native fetch (available in Node 18+).
 */
async function confirmSnsSubscription(subscribeUrl) {
  try {
    const response = await fetch(subscribeUrl);
    if (!response.ok) {
      throw new Error(`SNS subscription confirmation failed: ${response.status}`);
    }
    return true;
  } catch (err) {
    console.error('Failed to confirm SNS subscription:', err);
    return false;
  }
}

/**
 * Handle a permanent bounce or complaint — suppress the email and
 * update the contact status.
 */
async function handlePermanentSuppression(accountId, email, reason, fastify) {
  try {
    // Add to suppression list
    await suppress(accountId, email, reason);

    // Mark contact as bounced / complained
    const newStatus = reason === 'complaint' ? 'complained' : 'bounced';
    await query(
      `UPDATE contacts SET status = $1, updated_at = NOW()
       WHERE account_id = $2 AND email = $3`,
      [newStatus, accountId, email.toLowerCase()]
    );
  } catch (err) {
    fastify.log.error({ err, accountId, email, reason }, 'Failed to handle permanent suppression');
  }
}

/**
 * Track a soft bounce. After 3 soft bounces, permanently suppress.
 */
async function handleSoftBounce(accountId, email, sendId, fastify) {
  try {
    // Increment soft bounce count in the contact's custom_fields
    const contactResult = await query(
      'SELECT id, custom_fields FROM contacts WHERE account_id = $1 AND email = $2',
      [accountId, email.toLowerCase()]
    );

    if (contactResult.rows.length === 0) return;

    const contact = contactResult.rows[0];
    const customFields = contact.custom_fields || {};
    const softBounces = (customFields.soft_bounce_count || 0) + 1;

    await query(
      `UPDATE contacts
       SET custom_fields = jsonb_set(
             COALESCE(custom_fields, '{}'),
             '{soft_bounce_count}',
             $1::jsonb
           ),
           updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(softBounces), contact.id]
    );

    if (softBounces >= 3) {
      // Escalate to permanent suppression after 3 soft bounces
      await handlePermanentSuppression(accountId, email, 'soft_bounce_threshold', fastify);
    }
  } catch (err) {
    fastify.log.error({ err, accountId, email }, 'Failed to handle soft bounce');
  }
}

export default async function webhookRoutes(fastify) {
  // POST /api/webhooks/ses — receive SNS/SES event notifications
  fastify.post('/api/webhooks/ses', async (request, reply) => {
    const messageType = request.headers['x-amz-sns-message-type'];

    if (!messageType) {
      return reply.code(400).send({ error: 'Missing x-amz-sns-message-type header' });
    }

    // Parse body — SNS sends JSON as text/plain sometimes
    let body;
    try {
      body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    } catch {
      return reply.code(400).send({ error: 'Invalid JSON body' });
    }

    // Handle SNS subscription confirmation
    if (messageType === 'SubscriptionConfirmation') {
      fastify.log.info('SNS subscription confirmation received');
      if (body.SubscribeURL) {
        await confirmSnsSubscription(body.SubscribeURL);
      }
      return reply.code(200).send({ message: 'Subscription confirmed' });
    }

    // Handle unsubscribe confirmation
    if (messageType === 'UnsubscribeConfirmation') {
      fastify.log.info('SNS unsubscribe confirmation received');
      return reply.code(200).send({ message: 'Unsubscribe noted' });
    }

    // Process SNS Notification
    if (messageType === 'Notification') {
      let sesMessage;
      try {
        sesMessage = typeof body.Message === 'string'
          ? JSON.parse(body.Message)
          : body.Message;
      } catch {
        fastify.log.warn('Could not parse SES message body');
        return reply.code(200).send({ message: 'Ignored: unparseable message' });
      }

      const eventType = sesMessage.eventType || sesMessage.notificationType;

      fastify.log.info({ eventType }, 'Processing SES event');

      try {
        switch (eventType) {
          case 'Bounce':
            await handleBounceEvent(sesMessage, fastify);
            break;
          case 'Complaint':
            await handleComplaintEvent(sesMessage, fastify);
            break;
          case 'Delivery':
            await handleDeliveryEvent(sesMessage, fastify);
            break;
          case 'Open':
            await handleOpenEvent(sesMessage, fastify);
            break;
          case 'Click':
            await handleClickEvent(sesMessage, fastify);
            break;
          case 'Send':
            // Just acknowledge — send is already tracked when we create the send record
            break;
          default:
            fastify.log.info({ eventType }, 'Unhandled SES event type');
        }
      } catch (err) {
        fastify.log.error({ err, eventType }, 'Error processing SES event');
        // Still return 200 to prevent SNS retry storm
      }

      return reply.code(200).send({ message: 'Event processed' });
    }

    return reply.code(400).send({ error: `Unknown SNS message type: ${messageType}` });
  });
}

// ─── Event handlers ──────────────────────────────────────────────────────────

async function handleBounceEvent(sesMessage, fastify) {
  const bounce = sesMessage.bounce;
  if (!bounce) return;

  const bounceType = bounce.bounceType; // 'Permanent' | 'Transient' | 'Undetermined'
  const bouncedRecipients = bounce.bouncedRecipients || [];

  // Find the send record via SES message ID
  const messageId = sesMessage.mail?.messageId;

  for (const recipient of bouncedRecipients) {
    const email = recipient.emailAddress?.toLowerCase();
    if (!email) continue;

    // Find send record to get account_id
    let sendRecord = null;
    if (messageId) {
      const sendResult = await query(
        'SELECT id, account_id, contact_id FROM sends WHERE ses_message_id = $1 LIMIT 1',
        [messageId]
      );
      sendRecord = sendResult.rows[0] || null;
    }

    if (!sendRecord && email) {
      // Fallback: find the most recent pending send for this email
      const sendResult = await query(
        `SELECT s.id, s.account_id, s.contact_id
         FROM sends s
         JOIN contacts c ON c.id = s.contact_id
         WHERE c.email = $1 AND s.status = 'pending'
         ORDER BY s.created_at DESC
         LIMIT 1`,
        [email]
      );
      sendRecord = sendResult.rows[0] || null;
    }

    if (sendRecord) {
      // Update send record status
      await query(
        `UPDATE sends SET status = 'bounced' WHERE id = $1`,
        [sendRecord.id]
      );

      if (bounceType === 'Permanent') {
        await handlePermanentSuppression(sendRecord.account_id, email, 'bounce', fastify);
      } else {
        // Transient / soft bounce
        await handleSoftBounce(sendRecord.account_id, email, sendRecord.id, fastify);
      }
    } else {
      fastify.log.warn({ email, messageId }, 'No send record found for bounce event');
    }
  }
}

async function handleComplaintEvent(sesMessage, fastify) {
  const complaint = sesMessage.complaint;
  if (!complaint) return;

  const complainedRecipients = complaint.complainedRecipients || [];
  const messageId = sesMessage.mail?.messageId;

  for (const recipient of complainedRecipients) {
    const email = recipient.emailAddress?.toLowerCase();
    if (!email) continue;

    let sendRecord = null;
    if (messageId) {
      const sendResult = await query(
        'SELECT id, account_id FROM sends WHERE ses_message_id = $1 LIMIT 1',
        [messageId]
      );
      sendRecord = sendResult.rows[0] || null;
    }

    if (!sendRecord) {
      const sendResult = await query(
        `SELECT s.id, s.account_id
         FROM sends s
         JOIN contacts c ON c.id = s.contact_id
         WHERE c.email = $1
         ORDER BY s.created_at DESC
         LIMIT 1`,
        [email]
      );
      sendRecord = sendResult.rows[0] || null;
    }

    if (sendRecord) {
      await query(
        `UPDATE sends SET status = 'complained' WHERE id = $1`,
        [sendRecord.id]
      );
      await handlePermanentSuppression(sendRecord.account_id, email, 'complaint', fastify);
    }
  }
}

async function handleDeliveryEvent(sesMessage, fastify) {
  const messageId = sesMessage.mail?.messageId;
  if (!messageId) return;

  await query(
    `UPDATE sends SET status = 'delivered' WHERE ses_message_id = $1`,
    [messageId]
  );
}

async function handleOpenEvent(sesMessage, fastify) {
  const messageId = sesMessage.mail?.messageId;
  if (!messageId) return;

  await query(
    `UPDATE sends
     SET opened_at = COALESCE(opened_at, NOW())
     WHERE ses_message_id = $1`,
    [messageId]
  );
}

async function handleClickEvent(sesMessage, fastify) {
  const messageId = sesMessage.mail?.messageId;
  if (!messageId) return;

  await query(
    `UPDATE sends
     SET clicked_at = COALESCE(clicked_at, NOW())
     WHERE ses_message_id = $1`,
    [messageId]
  );
}
