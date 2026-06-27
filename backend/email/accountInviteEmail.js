import { sendEmail, isEmailConfigured } from './sendEmail.js'
import { memberPortalLoginUrl, publicAppUrl } from './publicAppUrl.js'
import { emailButtonHtml, emailFooterHtml, escapeHtml, plainLinkLine, preheaderHtml } from './emailHtml.js'
import { BRAND_NAME } from './emailPolicy.js'

const INVITE_TEMPLATE_VERSION = 'invite_v2'
const REMINDER_TEMPLATE_VERSION = 'invite_reminder_v2'
const COMPLETE_TEMPLATE_VERSION = 'invite_complete_v2'

/** Use only a first name in the body (privacy); never a child's full name in subject. */
function firstNameOf(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || 'your athlete'
}

export async function sendAccountInviteEmail({ to, inviteUrl, minorName, parentName, supportContact }) {
  const childFirst = firstNameOf(minorName)
  // No child identifier in the subject or preheader (PII safety).
  const subject = `Finish setting up your ${BRAND_NAME} parent account`
  const preheader = `${BRAND_NAME} needs a parent or guardian to complete a family account.`
  const contactLine = supportContact
    ? `If you were not expecting this, do not use the link — contact ${BRAND_NAME} at ${supportContact}.`
    : `If you were not expecting this, you can ignore this message.`

  const text = [
    parentName ? `Hi ${parentName},` : 'Hi there,',
    '',
    `${childFirst} started signing up at ${BRAND_NAME} and needs a parent or guardian to finish the account, enrollments, and waivers.`,
    '',
    plainLinkLine('Create my parent account', inviteUrl),
    '',
    'This secure link can only be used once.',
    '',
    contactLine,
    '',
    emailFooterHtml.text,
  ].join('\n')

  const html = `
    ${preheaderHtml(preheader)}
    <p>${parentName ? `Hi ${escapeHtml(parentName)},` : 'Hi there,'}</p>
    <p><strong>${escapeHtml(childFirst)}</strong> started signing up at <strong>${escapeHtml(BRAND_NAME)}</strong> and needs a parent or guardian to finish the account, enrollments, and waivers.</p>
    ${emailButtonHtml('Create my parent account', inviteUrl)}
    <p style="font-size: 14px; color: #555;">Or copy this link: <a href="${escapeHtml(inviteUrl)}">${escapeHtml(inviteUrl)}</a></p>
    <p style="color:#666;font-size:13px;">This secure link can only be used once. ${escapeHtml(contactLine)}</p>
  `

  if (!isEmailConfigured()) {
    // Never log the invite URL — it contains a single-use token.
    console.warn('[accountInviteEmail] SMTP not configured; skipping invite email')
    return { sent: false }
  }

  return sendEmail({
    to, subject, text, html,
    category: 'parent_account_invitation',
    templateVersion: INVITE_TEMPLATE_VERSION,
  })
}

export async function sendAccountInviteReminderEmail({
  to,
  inviteUrl,
  minorName,
  parentName,
  weekNumber,
  supportContact,
}) {
  const childFirst = firstNameOf(minorName)
  const subject = `Reminder: finish your ${BRAND_NAME} parent account`
  const preheader = `${BRAND_NAME} is still waiting for a parent or guardian to finish setup.`
  const contactLine = supportContact
    ? `If you were not expecting this, contact ${BRAND_NAME} at ${supportContact}.`
    : `If you were not expecting this, you can ignore this message.`

  const text = [
    parentName ? `Hi ${parentName},` : 'Hi there,',
    '',
    `A friendly reminder: ${childFirst} started signing up at ${BRAND_NAME} and still needs a parent or guardian to finish the account, enrollments, and waivers.`,
    '',
    plainLinkLine('Create my parent account', inviteUrl),
    '',
    'This secure link can only be used once.',
    '',
    contactLine,
    '',
    emailFooterHtml.text,
  ].join('\n')

  const html = `
    ${preheaderHtml(preheader)}
    <p>${parentName ? `Hi ${escapeHtml(parentName)},` : 'Hi there,'}</p>
    <p>A friendly reminder: <strong>${escapeHtml(childFirst)}</strong> started signing up at <strong>${escapeHtml(BRAND_NAME)}</strong> and still needs a parent or guardian to finish the account, enrollments, and waivers.</p>
    ${emailButtonHtml('Create my parent account', inviteUrl)}
    <p style="font-size: 14px; color: #555;">Or copy this link: <a href="${escapeHtml(inviteUrl)}">${escapeHtml(inviteUrl)}</a></p>
    <p style="color:#666;font-size:13px;">This secure link can only be used once. ${escapeHtml(contactLine)}</p>
  `

  if (!isEmailConfigured()) {
    console.warn('[accountInviteReminderEmail] SMTP not configured; skipping reminder email')
    return { sent: false }
  }

  return sendEmail({
    to, subject, text, html,
    category: 'parent_account_invitation',
    templateVersion: REMINDER_TEMPLATE_VERSION,
  })
}

/**
 * Sent to the parent/guardian after they complete a minor's invite signup.
 */
export async function sendInviteSignupCompleteEmail({
  to,
  parentName,
  minorName,
  enrollmentCount = 0,
}) {
  if (!isEmailConfigured()) {
    console.warn('[inviteSignupCompleteEmail] SMTP not configured; skipping send to', to)
    return { sent: false }
  }
  if (!to) {
    console.warn('[inviteSignupCompleteEmail] No recipient email; skipping send')
    return { sent: false }
  }

  const portalUrl = memberPortalLoginUrl()
  const siteUrl = publicAppUrl()
  const athlete = firstNameOf(minorName)
  const greeting = parentName ? `Hi ${parentName},` : 'Hi,'
  const subject = `Your ${BRAND_NAME} family account is ready`
  const preheader = `Your parent account setup is complete.`

  const enrollmentLine =
    enrollmentCount > 0
      ? `We recorded ${enrollmentCount} class enrollment${enrollmentCount === 1 ? '' : 's'}.`
      : 'You can add class enrollments any time from the site.'

  const text = [
    greeting,
    '',
    `Thank you for completing signup for ${athlete}. Your family account is ready.`,
    enrollmentLine,
    '',
    'Sign in from the Member Portal to manage your family, view schedules, and update waivers:',
    plainLinkLine('Member Portal', portalUrl),
    '',
    'You may receive a separate email to confirm your email address — please click that link when it arrives.',
    '',
    emailFooterHtml.text,
  ].join('\n')

  const html = `
    ${preheaderHtml(preheader)}
    <p>${escapeHtml(greeting)}</p>
    <p>Thank you for completing signup for <strong>${escapeHtml(athlete)}</strong>. Your family account is ready.</p>
    <p>${escapeHtml(enrollmentLine)}</p>
    ${emailButtonHtml('Go to Member Portal', portalUrl)}
    <p style="font-size: 14px; color: #555;">Or visit <a href="${escapeHtml(siteUrl)}">${escapeHtml(siteUrl)}</a></p>
    <p style="color:#666;font-size:13px;">You may receive a separate email to confirm your email address — please click that link when it arrives.</p>
  `

  return sendEmail({
    to, subject, text, html,
    category: 'parent_account_created',
    templateVersion: COMPLETE_TEMPLATE_VERSION,
  })
}
