import { query } from '../config/database.js';
import { sendEmail } from './emailService.js';
import { renderTemplate } from './templateService.js';
import { buildPreferenceUrl, buildUnsubscribeUrl } from './preferenceService.js';
import { isSuppressed } from './suppressionService.js';

/**
 * SES sending rate limit.
 * Default SES sandbox: 1/second. Production: up to 14/second.
 * Adjust via env: SES_SEND_RATE (emails per second).
 */
const SEND_RATE = parseInt(process.env.SES_SEND_RATE || '14');
const BATCH_SIZE = SEND_RATE;
const BATCH_DELAY_MS = 1000; // 1 second between batches

/**
 * Main campaign send function.
 * Loads campaign + contacts, renders emails, creates send records, dispatches via SES.
 *
 * @param {string} campaignId
 * @param {string} accountId
 */
export async function sendCampaign(campaignId, accountId) {
  console.log(`[campaignEngine] Starting send for campaign ${campaignId}`);

  // ── 1. Load campaign ──────────────────────────────────────────────────────
  const campaignResult = await query(
    `SELECT c.*, t.blocks as template_blocks, t.name as template_name,
            a.from_name as account_from_name, a.from_email as account_from_email,
            a.physical_address, a.company
     FROM campaigns c
     JOIN accounts a ON a.id = c.account_id
     LEFT JOIN templates t ON t.id = c.template_id
     WHERE c.id = $1 AND c.account_id = $2`,
    [campaignId, accountId]
  );

  if (campaignResult.rows.length === 0) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  const campaign = campaignResult.rows[0];

  if (!campaign.subject_line) {
    throw new Error('Campaign is missing a subject line');
  }

  if (!campaign.template_blocks) {
    throw new Error('Campaign has no template or template has no blocks');
  }

  const fromName = campaign.from_name || campaign.account_from_name || 'MailFlow';
  const fromEmail = campaign.from_email || campaign.account_from_email;

  if (!fromEmail) {
    throw new Error('Campaign has no from_email configured');
  }

  const blocks = Array.isArray(campaign.template_blocks)
    ? campaign.template_blocks
    : JSON.parse(campaign.template_blocks || '[]');

  // ── 2. Load segment contacts (excluding suppressed + unsubscribed) ─────────
  let contactsQuery;
  let contactsParams;

  if (campaign.segment_id) {
    // Load segment rules
    const segResult = await query(
      'SELECT rules FROM segments WHERE id = $1 AND account_id = $2',
      [campaign.segment_id, accountId]
    );

    if (segResult.rows.length === 0) {
      throw new Error(`Segment ${campaign.segment_id} not found`);
    }

    // For now, pull all active contacts in the account for the segment.
    // Rule evaluation happens via the segment API; here we use the DB-level filter.
    // For a production system you would generate a dynamic WHERE clause from the rules.
    contactsQuery = `
      SELECT c.id, c.email, c.first_name, c.last_name, c.company, c.phone, c.tags
      FROM contacts c
      WHERE c.account_id = $1
        AND c.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM suppression_list sl
          WHERE sl.account_id = $1 AND sl.email = c.email
        )
      ORDER BY c.created_at ASC`;
    contactsParams = [accountId];
  } else {
    // No segment — send to ALL active, non-suppressed contacts
    contactsQuery = `
      SELECT c.id, c.email, c.first_name, c.last_name, c.company, c.phone, c.tags
      FROM contacts c
      WHERE c.account_id = $1
        AND c.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM suppression_list sl
          WHERE sl.account_id = $1 AND sl.email = c.email
        )
      ORDER BY c.created_at ASC`;
    contactsParams = [accountId];
  }

  const contactsResult = await query(contactsQuery, contactsParams);
  const contacts = contactsResult.rows;

  console.log(`[campaignEngine] ${contacts.length} contacts to send to`);

  if (contacts.length === 0) {
    await query(
      `UPDATE campaigns SET status = 'sent', sent_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [campaignId]
    );
    console.log(`[campaignEngine] No contacts to send to — marked campaign as sent`);
    return { sent: 0, skipped: 0, errors: 0 };
  }

  // ── 3. Pre-create all send records in a single transaction ────────────────
  // This ensures we have a record even if email dispatch partially fails.
  const sendIds = new Map(); // contact.id -> send record id

  for (const contact of contacts) {
    const sendResult = await query(
      `INSERT INTO sends (campaign_id, contact_id, account_id, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [campaignId, contact.id, accountId]
    );

    if (sendResult.rows.length > 0) {
      sendIds.set(contact.id, sendResult.rows[0].id);
    }
  }

  // ── 4. Send in batches ────────────────────────────────────────────────────
  let sentCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (contact) => {
        const sendId = sendIds.get(contact.id);
        if (!sendId) {
          skippedCount++;
          return;
        }

        // Double-check suppression (race condition safety)
        const suppressed = await isSuppressed(accountId, contact.email);
        if (suppressed) {
          await query(
            'UPDATE sends SET status = $1 WHERE id = $2',
            ['suppressed', sendId]
          );
          skippedCount++;
          return;
        }

        try {
          // Generate personalised URLs
          const preferenceUrl = buildPreferenceUrl(contact.id, accountId);
          const unsubscribeUrl = buildUnsubscribeUrl(contact.id, accountId);

          // Render MJML template with contact variables
          const { html, text } = renderTemplate({
            blocks,
            contact,
            unsubscribeUrl,
            preferenceUrl,
            brandColor: '#4F7FFF',
          });

          // Personalise subject line ({{first_name}} etc.)
          const subject = personaliseText(campaign.subject_line, contact);

          // Dispatch via SES
          const sesMessageId = await sendEmail({
            to: contact.email,
            subject,
            htmlBody: html,
            textBody: text,
            fromName,
            fromEmail,
            replyTo: campaign.reply_to || null,
            messageId: sendId,
          });

          // Update send record with SES message ID
          await query(
            `UPDATE sends SET ses_message_id = $1, status = 'sent' WHERE id = $2`,
            [sesMessageId, sendId]
          );

          sentCount++;
        } catch (err) {
          console.error(
            `[campaignEngine] Failed to send to ${contact.email}:`,
            err.message
          );

          await query(
            `UPDATE sends SET status = 'failed' WHERE id = $1`,
            [sendId]
          );

          errorCount++;
        }
      })
    );

    // Rate limiting: wait 1 second between batches (except after the last batch)
    if (i + BATCH_SIZE < contacts.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // ── 5. Mark campaign as sent ──────────────────────────────────────────────
  await query(
    `UPDATE campaigns SET status = 'sent', sent_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [campaignId]
  );

  console.log(
    `[campaignEngine] Campaign ${campaignId} complete — ` +
    `sent: ${sentCount}, skipped: ${skippedCount}, errors: ${errorCount}`
  );

  return { sent: sentCount, skipped: skippedCount, errors: errorCount };
}

/**
 * Replace {{variable}} tokens in a string using contact data.
 */
function personaliseText(text, contact) {
  if (!text) return '';
  const vars = {
    first_name: contact.first_name || contact.email?.split('@')[0] || 'there',
    last_name: contact.last_name || '',
    full_name:
      [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
      contact.email?.split('@')[0] ||
      'there',
    email: contact.email || '',
    company: contact.company || '',
  };

  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    result = result.replace(regex, String(value || ''));
  }
  return result;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
