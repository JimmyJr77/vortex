/** Shared HTML helpers for transactional email (consistent layout, deliverability). */

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function plainLinkLine(label, url) {
  return `${label}: ${url}`
}

/**
 * Hidden preheader text — the preview snippet shown in the inbox list. Kept visible to
 * screen readers but visually hidden; followed by whitespace so the client does not pull
 * body text into the preview. Do NOT put PII (child name/DOB/etc.) here.
 */
export function preheaderHtml(text) {
  const safe = escapeHtml(text)
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${safe}</div><div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">&#8202;&zwnj;&nbsp;&#8203;&#8204;&#8205;&#8206;&#8207;</div>`
}

export function emailButtonHtml(label, url) {
  return `
    <p style="margin: 28px 0;">
      <a href="${escapeHtml(url)}"
         style="display: inline-block; background: #c41e3a; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">
        ${escapeHtml(label)}
      </a>
    </p>
  `
}

/** Plain-text + HTML footer (CAN-SPAM friendly physical address line). */
export const emailFooterHtml = {
  text: '— Vortex Athletics\nwww.vortexathletics.com',
  html: `
    <p style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; color: #888; font-size: 12px;">
      Vortex Athletics · <a href="https://www.vortexathletics.com" style="color: #888;">www.vortexathletics.com</a>
    </p>
  `,
}
