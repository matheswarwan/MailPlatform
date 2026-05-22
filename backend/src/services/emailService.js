import { SendEmailCommand } from '@aws-sdk/client-ses';
import { sesClient } from '../config/aws.js';

/**
 * Send a single transactional / campaign email via AWS SES.
 *
 * @param {object} params
 * @param {string}  params.to          - Recipient email address
 * @param {string}  params.subject     - Email subject line
 * @param {string}  params.htmlBody    - HTML content
 * @param {string}  [params.textBody]  - Plain-text fallback content
 * @param {string}  params.fromName    - Display name for From header
 * @param {string}  params.fromEmail   - Sender email address (must be SES-verified)
 * @param {string}  [params.replyTo]   - Reply-To address
 * @param {string}  [params.messageId] - Internal message ID for tracking (sent as custom header)
 * @returns {Promise<string>} SES MessageId (used for event tracking)
 */
export async function sendEmail({
  to,
  subject,
  htmlBody,
  textBody,
  fromName,
  fromEmail,
  replyTo,
  messageId,
}) {
  if (!to || !subject || !htmlBody || !fromEmail) {
    throw new Error('to, subject, htmlBody, and fromEmail are required');
  }

  const source = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const command = new SendEmailCommand({
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: htmlBody,
          Charset: 'UTF-8',
        },
        Text: {
          Data: textBody || stripHtml(htmlBody),
          Charset: 'UTF-8',
        },
      },
    },
    Source: source,
    ReplyToAddresses: replyTo ? [replyTo] : [],
    // SES ConfigurationSetName for event tracking (optional — set via env)
    ...(process.env.SES_CONFIGURATION_SET
      ? { ConfigurationSetName: process.env.SES_CONFIGURATION_SET }
      : {}),
  });

  const response = await sesClient.send(command);
  return response.MessageId;
}

/**
 * Send a batch of emails. Processes them sequentially to respect rate limits.
 * SES sandbox limit is typically 1 email/second; production is 14/second.
 * Use sendCampaignBatch for high-volume sends (handles batching internally).
 *
 * @param {Array<object>} emails - Array of email param objects (same shape as sendEmail)
 * @param {number} [delayMs=0]   - Milliseconds to wait between sends (rate limiting)
 * @returns {Promise<Array<{to: string, sesMessageId: string|null, error: string|null}>>}
 */
export async function sendBatch(emails, delayMs = 0) {
  const results = [];

  for (const email of emails) {
    try {
      const sesMessageId = await sendEmail(email);
      results.push({ to: email.to, sesMessageId, error: null });
    } catch (err) {
      results.push({ to: email.to, sesMessageId: null, error: err.message });
    }

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return results;
}

/**
 * Very simple HTML stripper for plain-text fallback generation.
 * Not suitable for complex HTML — use a proper library if accuracy matters.
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
