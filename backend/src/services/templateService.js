import mjml2html from 'mjml';

/**
 * Render an array of email content blocks into responsive HTML using MJML.
 *
 * Supported block types:
 *  - hero          { type, title, subtitle, imageUrl, buttonText, buttonUrl, backgroundColor }
 *  - text          { type, content, align }
 *  - button        { type, text, url, align, backgroundColor, textColor }
 *  - divider       { type, color, borderWidth }
 *  - image         { type, src, alt, href, align, width }
 *  - image_text    { type, imageUrl, imageAlt, imagePosition, content, title }
 *  - social_links  { type, links: [{ platform, url, iconUrl }] }
 *  - footer        { type, companyName, address, unsubscribeUrl, preferenceUrl, textColor }
 *  - spacer        { type, height }
 *
 * @param {object} params
 * @param {Array}   params.blocks           - Array of block objects
 * @param {object}  [params.contact]        - Contact data for variable substitution
 * @param {string}  [params.unsubscribeUrl] - Unsubscribe URL
 * @param {string}  [params.preferenceUrl]  - Preference centre URL
 * @param {string}  [params.brandColor]     - Brand accent color (hex)
 * @returns {{ html: string, text: string }}
 */
export function renderTemplate({
  blocks = [],
  contact = {},
  unsubscribeUrl = '#',
  preferenceUrl = '#',
  brandColor = '#4F7FFF',
}) {
  const mjmlContent = buildMjml(blocks, brandColor);

  const { html: rawHtml, errors } = mjml2html(mjmlContent, {
    validationLevel: 'soft',
    minify: false,
  });

  if (errors && errors.length > 0) {
    console.warn('MJML rendering warnings:', errors);
  }

  const html = typeof rawHtml === 'string' ? rawHtml : '';
  if (!html) {
    console.error('MJML produced no HTML output. MJML input:\n', mjmlContent);
    throw new Error('Template rendering failed: MJML produced no output');
  }

  // Replace template variables in rendered HTML
  const substitutedHtml = applyVariables(html, contact, unsubscribeUrl, preferenceUrl);

  // Generate plain-text version from blocks
  const text = generateTextVersion(blocks, contact, unsubscribeUrl, preferenceUrl);

  return { html: substitutedHtml, text };
}

/**
 * Build the full MJML document string from an array of blocks.
 */
function buildMjml(blocks, brandColor) {
  const sections = blocks.map((block) => renderBlock(block, brandColor)).filter(Boolean);

  return `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" />
      <mj-text font-size="16px" line-height="1.6" color="#1a1a2e" />
      <mj-button background-color="${brandColor}" color="#ffffff" font-size="16px"
                 font-weight="600" border-radius="8px" padding="14px 28px"
                 inner-padding="0" />
      <mj-section background-color="#ffffff" />
    </mj-attributes>
    <mj-style>
      a { color: ${brandColor}; }
      a:hover { opacity: 0.85; }
      p { margin: 0 0 16px 0; }
      p:last-child { margin-bottom: 0; }
    </mj-style>
  </mj-head>
  <mj-body background-color="#f4f5f7">
    ${sections.join('\n')}
  </mj-body>
</mjml>
  `.trim();
}

/**
 * Normalize a block from CampaignBuilder format (nested `content` object)
 * to the flat format expected by the renderers.
 * Also maps property name differences between the two formats.
 */
function normalizeBlock(block) {
  if (!block.content || typeof block.content !== 'object') return block;

  const c = block.content;
  const type = block.type;

  // Map CampaignBuilder property names → templateService property names
  switch (type) {
    case 'hero':
      return {
        type,
        title: c.headline || '',
        subtitle: c.subheadline || '',
        backgroundColor: c.bgColor || '#4F7FFF',
      };
    case 'text':
      return { type, content: c.content || '' };
    case 'button':
      return {
        type,
        text: c.label || 'Click Here',
        url: c.url || '#',
        backgroundColor: c.bgColor || '#4F7FFF',
        textColor: '#ffffff',
      };
    case 'divider':
      return { type, color: c.color || '#e5e7eb', borderWidth: c.borderWidth || 1 };
    case 'social': {
      // Convert {twitter, linkedin, instagram} URLs → links array
      const links = [];
      if (c.twitter) links.push({ platform: 'twitter', url: c.twitter });
      if (c.linkedin) links.push({ platform: 'linkedin', url: c.linkedin });
      if (c.instagram) links.push({ platform: 'instagram', url: c.instagram });
      return { type: 'social_links', links };
    }
    case 'footer':
      return {
        type,
        companyName: c.company || '',
        address: c.address || '',
      };
    default:
      return { type, ...c };
  }
}

/**
 * Render a single block to an MJML section string.
 */
function renderBlock(rawBlock, brandColor) {
  const block = normalizeBlock(rawBlock);
  switch (block.type) {
    case 'hero':
      return renderHeroBlock(block, brandColor);
    case 'text':
      return renderTextBlock(block);
    case 'button':
      return renderButtonBlock(block, brandColor);
    case 'divider':
      return renderDividerBlock(block);
    case 'image':
      return renderImageBlock(block);
    case 'image_text':
      return renderImageTextBlock(block, brandColor);
    case 'social_links':
      return renderSocialLinksBlock(block);
    case 'footer':
      return renderFooterBlock(block, brandColor);
    case 'spacer':
      return renderSpacerBlock(block);
    default:
      console.warn(`Unknown block type: ${block.type}`);
      return '';
  }
}

function renderHeroBlock(block, brandColor) {
  const {
    title = '',
    subtitle = '',
    imageUrl,
    buttonText,
    buttonUrl = '#',
    backgroundColor = brandColor,
    textColor = '#ffffff',
  } = block;

  const imageSection = imageUrl
    ? `<mj-image src="${escapeAttr(imageUrl)}" alt="${escapeAttr(title)}"
                 width="600px" padding="0" />`
    : '';

  const buttonSection =
    buttonText
      ? `<mj-button href="${escapeAttr(buttonUrl)}"
                    background-color="${textColor === '#ffffff' ? '#ffffff' : brandColor}"
                    color="${textColor === '#ffffff' ? backgroundColor : '#ffffff'}"
                    font-size="16px" font-weight="600" border-radius="8px"
                    padding="16px 0" inner-padding="14px 32px">
           ${escapeHtml(buttonText)}
         </mj-button>`
      : '';

  return `
<mj-section background-color="${escapeAttr(backgroundColor)}" padding="0">
  <mj-column>
    ${imageSection}
    <mj-text align="center" color="${escapeAttr(textColor)}"
             font-size="32px" font-weight="700" line-height="1.3"
             padding="40px 32px 16px">
      ${escapeHtml(title)}
    </mj-text>
    ${subtitle ? `
    <mj-text align="center" color="${escapeAttr(textColor)}"
             font-size="18px" line-height="1.5"
             padding="0 32px 32px">
      ${escapeHtml(subtitle)}
    </mj-text>` : ''}
    ${buttonSection ? `<mj-text align="center" padding="0 32px 48px">${buttonSection}</mj-text>` : ''}
  </mj-column>
</mj-section>`;
}

function renderTextBlock(block) {
  const { content = '', align = 'left' } = block;
  return `
<mj-section background-color="#ffffff" padding="0">
  <mj-column padding="32px 40px">
    <mj-text align="${escapeAttr(align)}" padding="0">
      ${content}
    </mj-text>
  </mj-column>
</mj-section>`;
}

function renderButtonBlock(block, brandColor) {
  const {
    text = 'Click here',
    url = '#',
    align = 'center',
    backgroundColor = brandColor,
    textColor = '#ffffff',
  } = block;

  return `
<mj-section background-color="#ffffff" padding="0">
  <mj-column padding="16px 40px 32px">
    <mj-button href="${escapeAttr(url)}"
               background-color="${escapeAttr(backgroundColor)}"
               color="${escapeAttr(textColor)}"
               align="${escapeAttr(align)}">
      ${escapeHtml(text)}
    </mj-button>
  </mj-column>
</mj-section>`;
}

function renderDividerBlock(block) {
  const { color = '#e5e7eb', borderWidth = 1 } = block;
  return `
<mj-section background-color="#ffffff" padding="0">
  <mj-column padding="8px 40px">
    <mj-divider border-color="${escapeAttr(color)}"
                border-width="${parseInt(borderWidth) || 1}px"
                padding="0" />
  </mj-column>
</mj-section>`;
}

function renderImageBlock(block) {
  const { src = '', alt = '', href, align = 'center', width = '100%' } = block;

  const imgTag = `<mj-image src="${escapeAttr(src)}" alt="${escapeAttr(alt)}"
                             align="${escapeAttr(align)}"
                             width="${escapeAttr(String(width))}"
                             ${href ? `href="${escapeAttr(href)}"` : ''}
                             padding="0" />`;

  return `
<mj-section background-color="#ffffff" padding="0">
  <mj-column padding="16px 40px">
    ${imgTag}
  </mj-column>
</mj-section>`;
}

function renderImageTextBlock(block, brandColor) {
  const {
    imageUrl = '',
    imageAlt = '',
    imagePosition = 'left',
    content = '',
    title = '',
  } = block;

  const imageCol = `
    <mj-column width="40%" padding="32px 16px 32px ${imagePosition === 'left' ? '32px' : '16px'}">
      <mj-image src="${escapeAttr(imageUrl)}" alt="${escapeAttr(imageAlt)}" padding="0" />
    </mj-column>`;

  const textCol = `
    <mj-column width="60%" padding="32px ${imagePosition === 'right' ? '32px' : '16px'} 32px 16px">
      ${title ? `
      <mj-text font-size="22px" font-weight="700" padding="0 0 12px">
        ${escapeHtml(title)}
      </mj-text>` : ''}
      <mj-text padding="0">
        ${content}
      </mj-text>
    </mj-column>`;

  return `
<mj-section background-color="#ffffff" padding="0">
  ${imagePosition === 'left' ? imageCol + textCol : textCol + imageCol}
</mj-section>`;
}

function renderSocialLinksBlock(block) {
  const { links = [] } = block;

  if (links.length === 0) return '';

  const icons = links
    .map((link) => {
      const platform = link.platform || 'link';
      const iconUrl = link.iconUrl || getDefaultSocialIcon(platform);
      return `
      <mj-social-element name="${escapeAttr(platform)}"
                          href="${escapeAttr(link.url || '#')}"
                          src="${escapeAttr(iconUrl)}"
                          background-color="transparent"
                          icon-size="24px"
                          padding="4px 8px">
        ${escapeHtml(capitalize(platform))}
      </mj-social-element>`;
    })
    .join('');

  return `
<mj-section background-color="#ffffff" padding="0">
  <mj-column padding="16px 40px">
    <mj-social font-size="14px" color="#6b7280" mode="horizontal" align="center">
      ${icons}
    </mj-social>
  </mj-column>
</mj-section>`;
}

function renderFooterBlock(block, brandColor) {
  const {
    companyName = '{{company_name}}',
    address = '{{physical_address}}',
    unsubscribeUrl: blockUnsubUrl,
    preferenceUrl: blockPrefUrl,
    textColor = '#9ca3af',
  } = block;

  const unsubUrl = blockUnsubUrl || '{{unsubscribe_url}}';
  const prefUrl = blockPrefUrl || '{{preference_url}}';

  return `
<mj-section background-color="#f4f5f7" padding="0">
  <mj-column padding="32px 40px">
    <mj-text align="center" color="${escapeAttr(textColor)}"
             font-size="13px" line-height="1.7" padding="0">
      <strong>${escapeHtml(companyName)}</strong><br />
      ${escapeHtml(address)}<br /><br />
      <a href="${unsubUrl}" style="color: ${escapeAttr(textColor)}; text-decoration: underline;">
        Unsubscribe
      </a>
      &nbsp;&nbsp;|&nbsp;&nbsp;
      <a href="${prefUrl}" style="color: ${escapeAttr(textColor)}; text-decoration: underline;">
        Manage Preferences
      </a>
    </mj-text>
  </mj-column>
</mj-section>`;
}

function renderSpacerBlock(block) {
  const { height = 24 } = block;
  return `
<mj-section background-color="#ffffff" padding="0">
  <mj-column>
    <mj-spacer height="${parseInt(height) || 24}px" />
  </mj-column>
</mj-section>`;
}

// ─── Variable substitution ────────────────────────────────────────────────────

/**
 * Replace {{variable}} placeholders in rendered HTML with actual values.
 */
function applyVariables(html, contact, unsubscribeUrl, preferenceUrl) {
  const vars = {
    first_name: contact.first_name || contact.email?.split('@')[0] || 'there',
    last_name: contact.last_name || '',
    full_name:
      [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
      contact.email?.split('@')[0] ||
      'there',
    email: contact.email || '',
    company: contact.company || '',
    unsubscribe_url: unsubscribeUrl,
    preference_url: preferenceUrl,
    company_name: process.env.APP_COMPANY_NAME || 'MailFlow',
    physical_address: process.env.APP_PHYSICAL_ADDRESS || '',
    current_year: new Date().getFullYear().toString(),
  };

  let result = html;
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    result = result.replace(regex, escapeHtml(String(value || '')));
  }

  return result;
}

// ─── Plain-text version generation ──────────────────────────────────────────

function generateTextVersion(blocks, contact, unsubscribeUrl, preferenceUrl) {
  const lines = [];

  for (const rawBlock of blocks) {
    const block = normalizeBlock(rawBlock);
    switch (block.type) {
      case 'hero':
        if (block.title) lines.push(block.title.toUpperCase());
        if (block.subtitle) lines.push(block.subtitle);
        if (block.buttonText && block.buttonUrl) {
          lines.push(`\n${block.buttonText}: ${block.buttonUrl}`);
        }
        lines.push('');
        break;

      case 'text':
        lines.push(stripHtmlTags(block.content || ''));
        lines.push('');
        break;

      case 'button':
        lines.push(`${block.text || 'Click here'}: ${block.url || '#'}`);
        lines.push('');
        break;

      case 'divider':
        lines.push('─'.repeat(60));
        break;

      case 'image':
        if (block.alt) lines.push(`[Image: ${block.alt}]`);
        if (block.href) lines.push(block.href);
        break;

      case 'image_text':
        if (block.title) lines.push(block.title);
        if (block.content) lines.push(stripHtmlTags(block.content));
        lines.push('');
        break;

      case 'social_links':
      case 'social':
        if (block.links && block.links.length > 0) {
          lines.push('Follow us:');
          for (const link of block.links) {
            lines.push(`  ${capitalize(link.platform || 'Link')}: ${link.url || ''}`);
          }
          lines.push('');
        }
        break;

      case 'footer':
        lines.push('─'.repeat(60));
        if (block.companyName) lines.push(block.companyName);
        if (block.address) lines.push(block.address);
        lines.push(`Unsubscribe: ${unsubscribeUrl}`);
        lines.push(`Manage Preferences: ${preferenceUrl}`);
        break;

      case 'spacer':
        lines.push('');
        break;

      default:
        break;
    }
  }

  let text = lines.join('\n');
  text = applyTextVariables(text, contact, unsubscribeUrl, preferenceUrl);
  return text;
}

function applyTextVariables(text, contact, unsubscribeUrl, preferenceUrl) {
  const vars = {
    first_name: contact.first_name || contact.email?.split('@')[0] || 'there',
    last_name: contact.last_name || '',
    full_name:
      [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
      contact.email?.split('@')[0] ||
      'there',
    email: contact.email || '',
    company: contact.company || '',
    unsubscribe_url: unsubscribeUrl,
    preference_url: preferenceUrl,
    company_name: process.env.APP_COMPANY_NAME || 'MailFlow',
    physical_address: process.env.APP_PHYSICAL_ADDRESS || '',
    current_year: new Date().getFullYear().toString(),
  };

  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    result = result.replace(regex, String(value || ''));
  }
  return result;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function stripHtmlTags(html) {
  if (!html) return '';
  return html
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

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getDefaultSocialIcon(platform) {
  const icons = {
    twitter: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/twitter.svg',
    facebook: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/facebook.svg',
    instagram: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/instagram.svg',
    linkedin: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/linkedin.svg',
    youtube: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/youtube.svg',
    tiktok: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/tiktok.svg',
    github: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/github.svg',
  };
  return icons[platform?.toLowerCase()] || '';
}
