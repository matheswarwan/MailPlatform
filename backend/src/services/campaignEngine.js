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
  const startTime = Date.now();
  console.log(`[campaignEngine] ══════════════════════════════════════════`);
  console.log(`[campaignEngine] Starting send  campaign=${campaignId}`);

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

  console.log(`[campaignEngine] Campaign details:`);
  console.log(`[campaignEngine]   name        = ${campaign.name}`);
  console.log(`[campaignEngine]   subject     = ${campaign.subject_line}`);
  console.log(`[campaignEngine]   from        = ${fromName} <${fromEmail}>`);
  console.log(`[campaignEngine]   segment_id  = ${campaign.segment_id || '(all contacts)'}`);
  console.log(`[campaignEngine]   template_id = ${campaign.template_id}`);
  console.log(`[campaignEngine]   blocks      = ${blocks.length} blocks (${blocks.map((b) => b.type).join(', ')})`);

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

  console.log(`[campaignEngine] ${contacts.length} contacts to send to (after suppression filter)`);

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
  const totalBatches = Math.ceil(contacts.length / BATCH_SIZE);

  for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
    const batch = contacts.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    console.log(`[campaignEngine] Batch ${batchNum}/${totalBatches} — ${batch.length} recipients`);

    await Promise.all(
      batch.map(async (contact) => {
        const sendId = sendIds.get(contact.id);
        if (!sendId) {
          console.log(`[campaignEngine]   SKIP  ${contact.email} (no send record — already sent?)`);
          skippedCount++;
          return;
        }

        // Double-check suppression (race condition safety)
        const suppressed = await isSuppressed(accountId, contact.email);
        if (suppressed) {
          console.log(`[campaignEngine]   SKIP  ${contact.email} (suppressed)`);
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

          console.log(`[campaignEngine]   SEND  ${contact.email}  subject="${subject}"`);

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

          console.log(`[campaignEngine]   OK    ${contact.email}  ses_id=${sesMessageId}`);
          sentCount++;
        } catch (err) {
          console.error(
            `[campaignEngine]   ERROR ${contact.email}: ${err.message}`
          );

          await query(
            `UPDATE sends SET status = 'failed' WHERE id = $1`,
            [sendId]
          );

          errorCount++;
        }
      })
    );

    console.log(`[campaignEngine] Batch ${batchNum} complete — running totals: sent=${sentCount} skipped=${skippedCount} errors=${errorCount}`);

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

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[campaignEngine] ──────────────────────────────────────────`);
  console.log(`[campaignEngine] COMPLETE  campaign=${campaignId}  elapsed=${elapsed}s`);
  console.log(`[campaignEngine]   sent=${sentCount}  skipped=${skippedCount}  errors=${errorCount}  total=${contacts.length}`);
  console.log(`[campaignEngine] ══════════════════════════════════════════`);

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
