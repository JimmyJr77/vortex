/** Shared HTML helpers for transactional email (consistent layout, deliverability). */

import { publicAppUrl } from './publicAppUrl.js'

export const EMAIL_LAYOUT_MARKER = 'data-vortex-email-layout="vortex"'

const BRAND = {
  black: '#000000',
  cardBg: '#e5e5e5',
  cardBorder: '#c41e3a',
  cardRadius: '4px',
  bodyColor: '#1a1a1a',
  footerColor: '#888888',
  buttonRed: '#c41e3a',
}

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

/** Logo used on the public site header (see src/utils/seo.ts HUB_HEADER_LOGO). */
export function emailLogoUrl() {
  return `${publicAppUrl()}/vortex-athletics-logo.png`
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
         style="display: inline-block; background: ${BRAND.buttonRed}; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: ${BRAND.cardRadius}; font-weight: bold;">
        ${escapeHtml(label)}
      </a>
    </p>
  `
}

/** Plain-text + HTML footer (rendered below the card in grey text). */
export const emailFooterHtml = {
  text: '— Vortex Athletics\nwww.vortexathletics.com',
  html: `
    Vortex Athletics · <a href="https://www.vortexathletics.com" style="color: ${BRAND.footerColor}; text-decoration: none;">www.vortexathletics.com</a>
  `.trim(),
}

/**
 * Full email document: black outer background, logo, light-grey card with thin red border,
 * body inside the card, footer below the card.
 */
export function composeEmailHtml(bodyHtml, { preheader = '' } = {}) {
  const logoUrl = emailLogoUrl()
  const siteUrl = publicAppUrl()
  const body = String(bodyHtml ?? '').trim()

  return `<!DOCTYPE html>
<html lang="en" ${EMAIL_LAYOUT_MARKER}>
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vortex Athletics</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.black};">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.black};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td align="center" style="padding:0 0 24px 0;">
              <a href="${escapeHtml(siteUrl)}" style="text-decoration:none;">
                <img src="${escapeHtml(logoUrl)}" alt="Vortex Athletics" width="220" style="display:block;width:220px;max-width:100%;height:auto;border:0;" />
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color:${BRAND.cardBg};border:1px solid ${BRAND.cardBorder};border-radius:${BRAND.cardRadius};padding:28px 24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${BRAND.bodyColor};">
              ${body}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${BRAND.footerColor};">
              ${emailFooterHtml.html}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Wrap a body fragment in the standard layout (used by sendEmail for all outbound HTML). */
export function normalizeOutboundEmailHtml(html) {
  let fragment = String(html ?? '').trim()
  if (!fragment || fragment.includes('data-vortex-email-layout=')) {
    return html
  }

  if (/<!DOCTYPE|<html/i.test(fragment)) {
    const bodyMatch = fragment.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    fragment = bodyMatch ? bodyMatch[1].trim() : fragment
  }

  // Legacy callers may still append the footer fragment inside the body.
  fragment = fragment.replace(emailFooterHtml.html, '').trim()

  let preheader = ''
  const preheaderRe = /^(\s*<div style="display:none[^>]*>[\s\S]*?<\/div>\s*)+/i
  const preMatch = fragment.match(preheaderRe)
  if (preMatch) {
    preheader = preMatch[0]
    fragment = fragment.slice(preMatch[0].length).trim()
  }

  return composeEmailHtml(fragment, { preheader })
}
