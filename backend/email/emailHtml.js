/** Shared HTML helpers for transactional email (consistent layout, deliverability). */

import { publicAppUrl } from './publicAppUrl.js'

export const EMAIL_LAYOUT_MARKER = 'data-vortex-email-layout="vortex"'
export const EMAIL_LAYOUT_VERSION = 'v4-home-page-logo'
export const EMAIL_LOGO_CID = 'vortex-athletics-gymnastics-logo@vortex'
export const EMAIL_SIGNATURE_LOGO_CID = EMAIL_LOGO_CID
export const EMAIL_SIGNATURE_MARKER = 'data-vortex-email-signature="v2"'

/** Email-compatible PNG of the artwork used by PublicBrandImage on the home page. */
export const EMAIL_LOGO_URL = 'https://vortexathletics.com/vortex-athletics-gymnastics-logo.png'

export const EMAIL_SIGNATURE = Object.freeze({
  name: 'Vortex Athletics & Gymnastics',
  address: '4961 Tesla Dr, Ste E, Bowie, MD 20715',
  website: 'www.vortexathletics.com',
  phone: '443-422-4794 (gym)',
  logoUrl: EMAIL_LOGO_URL,
})

const SIGNOFF = 'Warmly,\nThe Vortex Athletics Team'
const CONTACT_SIGNATURE = [EMAIL_SIGNATURE.name, EMAIL_SIGNATURE.address, EMAIL_SIGNATURE.website, EMAIL_SIGNATURE.phone].join('\n')
const LEGACY_CONTACT_SIGNATURE = ['Vortex Gymnastics', EMAIL_SIGNATURE.address, EMAIL_SIGNATURE.website, EMAIL_SIGNATURE.phone].join('\n')
const FOOTER_START = '<!-- vortex-email-footer:start -->'
const FOOTER_END = '<!-- vortex-email-footer:end -->'
const legacyFooterHtml = /Vortex Athletics\s*·\s*<a\b[^>]*href=["']https?:\/\/(?:www\.)?vortexathletics\.com\/?["'][^>]*>\s*(?:www\.)?vortexathletics\.com\/?\s*<\/a>/i

const BRAND = {
  headerBg: '#000000',
  bodyBg: '#ffffff',
  footerBg: '#e5e5e5',
  bodyColor: '#1a1a1a',
  footerColor: '#000000',
  buttonRed: '#c41e3a',
  buttonRadius: '14px',
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

/** The same home-page artwork is used in the email header and signature. */
export function emailLogoUrl() {
  return EMAIL_LOGO_URL
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
         style="display: inline-block; background: ${BRAND.buttonRed}; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: ${BRAND.buttonRadius}; font-weight: bold;">
        ${escapeHtml(label)}
      </a>
    </p>
  `
}

/** Required signoff and contact block, shared by every outbound email. */
export const emailFooterHtml = {
  text: `${SIGNOFF}\n\n${CONTACT_SIGNATURE}`,
  html: `${FOOTER_START}
    <div ${EMAIL_SIGNATURE_MARKER}>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">Warmly,<br />The Vortex Athletics Team</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:100%;">
        <tr><td style="padding:0 0 12px;">
          <img src="cid:${EMAIL_SIGNATURE_LOGO_CID}" alt="${escapeHtml(EMAIL_SIGNATURE.name)}" width="360" style="display:block;width:360px;max-width:100%;height:auto;border:0;" />
        </td></tr>
        <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:${BRAND.footerColor};">
          ${EMAIL_SIGNATURE.address}<br />
          <a href="https://${EMAIL_SIGNATURE.website}" style="color:${BRAND.footerColor};text-decoration:underline;">${EMAIL_SIGNATURE.website}</a><br />
          <a href="tel:+14434224794" style="color:${BRAND.footerColor};text-decoration:underline;">${EMAIL_SIGNATURE.phone}</a>
        </td></tr>
      </table>
    </div>
    ${FOOTER_END}`,
}

function withoutFooterBlocks(html) {
  return String(html ?? '').replace(/<!-- vortex-email-footer:start -->[\s\S]*?<!-- vortex-email-footer:end -->/g, '')
    .replace(legacyFooterHtml, '')
}

function withoutTextSignoff(text) {
  let body = String(text ?? '').replace(/\r\n?/g, '\n').trimEnd()
  // Some older templates already append the shared footer. Strip only known
  // terminal signatures; message paragraphs and links remain untouched.
  const signatures = [emailFooterHtml.text, CONTACT_SIGNATURE, LEGACY_CONTACT_SIGNATURE]
  let signature
  while ((signature = signatures.find(value => body.endsWith(value)))) {
    body = body.slice(0, -signature.length).trimEnd()
  }
  body = body.replace(/(?:^|\n)\s*—?\s*Vortex Athletics\s*\n(?:https?:\/\/)?(?:www\.)?vortexathletics\.com\/?\s*$/i, '').trimEnd()
  body = body.replace(/(?:^|\n)(?:(?:Warmly|Thank you|Sincerely|Best regards),?\s*\n)?(?:The Vortex Athletics Team|—\s*Vortex Athletics)\s*$/i, '').trimEnd()
  return body
}

function withoutHtmlSignoff(html) {
  // The final signoff can be a paragraph, a pair of <br>s, or plain text inside
  // an older pre-wrap block. Only remove it when no message text follows it.
  return String(html ?? '').replace(/(?:<p\b[^>]*>\s*)?(?:(?:Warmly|Thank you|Sincerely|Best regards),?(?:\s|<br\s*\/?>)+)?(?:The Vortex Athletics Team|—\s*Vortex Athletics)(?:\s|<br\s*\/?>)*(?:<\/p>)?(?=(?:\s|<\/?(?:div|p|td|tr|table|tbody|center)\b[^>]*>)*$)/i, '').trim()
}

/** Render real paragraphs instead of relying on inconsistent email white-space support. */
export function plainTextToEmailHtml(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n').split(/\n[\t ]*\n+/)
    .filter(paragraph => paragraph.trim())
    .map(paragraph => `<p style="margin:0 0 20px;line-height:1.6;">${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`).join('\n')
}

function decodeHtmlEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, key) => {
    if (!key.startsWith('#')) return named[key.toLowerCase()]
    const code = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1))
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity
  })
}

function htmlText(html) {
  return decodeHtmlEntities(withoutFooterBlocks(html)
    .replace(/<(head|style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href, label) => {
      const text = label.replace(/<[^>]*>/g, '')
      if (!text.trim()) return ''
      return /^(https?:|mailto:|tel:)/i.test(href) && text !== href ? `${text} (${href})` : text
    })
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(?:p|div|tr|h[1-6]|li)>/gi, '\n\n')
    .replace(/<[^>]*>/g, '').replace(/[\t ]+\n/g, '\n').replace(/\n[\t ]*\n(?:[\t ]*\n)+/g, '\n\n')).trim()
}

/** Preserve body copy and blank lines, then append the required signature once. */
export function normalizeOutboundEmailText(text, html = '') {
  const body = withoutTextSignoff(String(text ?? '').trim() ? text : htmlText(html))
  return body ? `${body}\n\n${emailFooterHtml.text}` : emailFooterHtml.text
}

function headerLogoHtml() {
  return `<a href="${escapeHtml(publicAppUrl())}" style="text-decoration:none;">
    <img src="cid:${EMAIL_LOGO_CID}" alt="${escapeHtml(EMAIL_SIGNATURE.name)}" width="440" style="display:block;width:440px;max-width:100%;height:auto;border:0;margin:0 auto;" />
  </a>`
}

/**
 * Full email document: black header (logo), white body, grey footer — each full width of
 * the centered email column.
 */
export function composeEmailHtml(bodyHtml, { preheader = '' } = {}) {
  const body = withoutHtmlSignoff(withoutFooterBlocks(bodyHtml))

  return `<!DOCTYPE html>
<html lang="en" ${EMAIL_LAYOUT_MARKER} data-vortex-email-layout-version="${EMAIL_LAYOUT_VERSION}">
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vortex Athletics</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.footerBg};">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.footerBg};">
    <tr>
      <td align="left" style="padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
          <tr>
            <td align="center" style="background-color:${BRAND.headerBg};padding:36px 24px;">
              ${headerLogoHtml()}
            </td>
          </tr>
          <tr>
            <td style="background-color:${BRAND.bodyBg};padding:32px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:${BRAND.bodyColor};">
              ${body}
            </td>
          </tr>
          <tr>
            <td align="left" style="background-color:${BRAND.footerBg};padding:24px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${BRAND.footerColor};">
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
export function normalizeOutboundEmailHtml(html, { text = '' } = {}) {
  let fragment = String(html ?? '').trim()
  for (const oldCid of ['vortex-athletics-logo@vortex', 'vortex-gymnastics-logo@vortex']) {
    fragment = fragment.replaceAll(`cid:${oldCid}`, `cid:${EMAIL_LOGO_CID}`)
  }
  if (fragment.includes(EMAIL_LAYOUT_MARKER) && fragment.includes(EMAIL_SIGNATURE_MARKER)) return fragment

  if (fragment.includes('data-vortex-email-layout=')) {
    // Upgrade the existing branded document in place: wrapping it again would
    // duplicate the header and leave the old incomplete footer visible.
    const existingSignature = /<!-- vortex-email-footer:start -->[\s\S]*?<!-- vortex-email-footer:end -->/
    const oldFooter = legacyFooterHtml.exec(fragment)
    if (existingSignature.test(fragment)) {
      fragment = fragment.replace(existingSignature, emailFooterHtml.html)
    } else if (oldFooter) {
      fragment = withoutHtmlSignoff(fragment.slice(0, oldFooter.index)) + emailFooterHtml.html + fragment.slice(oldFooter.index + oldFooter[0].length)
    } else {
      const bodyEnd = /<\/body>/i.exec(fragment)
      fragment = bodyEnd
        ? withoutHtmlSignoff(fragment.slice(0, bodyEnd.index)) + emailFooterHtml.html + fragment.slice(bodyEnd.index)
        : withoutHtmlSignoff(fragment) + emailFooterHtml.html
    }
    if (!fragment.slice(0, fragment.indexOf(FOOTER_START)).includes(`cid:${EMAIL_LOGO_CID}`)) {
      fragment = fragment.replace(/<body\b[^>]*>/i, body => `${body}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td align="center" style="background-color:${BRAND.headerBg};padding:36px 24px;">${headerLogoHtml()}</td>
        </tr></table>`)
    }
    return fragment.replace(/data-vortex-email-layout-version=["'][^"']*["']/i, `data-vortex-email-layout-version="${EMAIL_LAYOUT_VERSION}"`)
  }

  if (!fragment) fragment = plainTextToEmailHtml(text)

  if (/<!DOCTYPE|<html/i.test(fragment)) {
    const bodyMatch = fragment.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    fragment = bodyMatch ? bodyMatch[1].trim() : fragment
  }

  // Legacy callers may still append the footer fragment inside the body.
  fragment = withoutFooterBlocks(fragment).trim()

  let preheader = ''
  const preheaderRe = /^(\s*<div style="display:none[^>]*>[\s\S]*?<\/div>\s*)+/i
  const preMatch = fragment.match(preheaderRe)
  if (preMatch) {
    preheader = preMatch[0]
    fragment = fragment.slice(preMatch[0].length).trim()
  }

  return composeEmailHtml(fragment, { preheader })
}
