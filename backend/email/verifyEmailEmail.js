import { sendEmail, isEmailConfigured } from './sendEmail.js'
import { emailButtonHtml, emailFooterHtml, escapeHtml, preheaderHtml, plainLinkLine } from './emailHtml.js'
import { BRAND_NAME } from './emailPolicy.js'

const TEMPLATE_VERSION = 'verify_v2'

/**
 * Email asking a user to confirm their email address via a single-use link.
 *
 * @param {{ to: string; verifyUrl: string; name?: string; supportContact?: string }} params
 */
export async function sendVerifyEmailEmail({ to, verifyUrl, name, supportContact }) {
  if (!isEmailConfigured()) {
    // Do NOT log the verify URL — it contains a single-use token.
    console.warn('[verifyEmailEmail] SMTP not configured; skipping verification email')
    return { sent: false }
  }
  if (!to) {
    console.warn('[verifyEmailEmail] No recipient email; skipping send')
    return { sent: false }
  }

  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,'
  const subject = `Verify your email for ${BRAND_NAME}`
  const preheader = `Complete your secure parent account for ${BRAND_NAME}.`
  const contactLine = supportContact
    ? `If you did not start this request, you can ignore this message or contact ${BRAND_NAME} at ${supportContact}.`
    : `If you did not start this request, you can safely ignore this message.`

  const text = [
    name ? `Hi ${name},` : 'Hi there,',
    '',
    `Confirm your email to finish setting up your parent account for ${BRAND_NAME}.`,
    '',
    plainLinkLine('Verify my email', verifyUrl),
    '',
    'This secure link can only be used once.',
    '',
    `You requested this email while creating a ${BRAND_NAME} account. ${contactLine}`,
    '',
    emailFooterHtml.text,
  ].join('\n')

  const html = `
    ${preheaderHtml(preheader)}
    <p>${greeting}</p>
    <p>Confirm your email to finish setting up your parent account for <strong>${escapeHtml(BRAND_NAME)}</strong>.</p>
    ${emailButtonHtml('Verify my email', verifyUrl)}
    <p style="font-size: 14px; color: #555;">Or copy this link: <a href="${escapeHtml(verifyUrl)}">${escapeHtml(verifyUrl)}</a></p>
    <p style="color:#666;font-size:13px;">This secure link can only be used once. ${escapeHtml(contactLine)}</p>
    ${emailFooterHtml.html}
  `

  return sendEmail({
    to,
    subject,
    text,
    html,
    category: 'parent_email_verification',
    templateVersion: TEMPLATE_VERSION,
  })
}
