import { sendEmail, isEmailConfigured } from './sendEmail.js'

export async function sendAccountInviteEmail({ to, inviteUrl, minorName, parentName }) {
  const subject = `${minorName} invited you to complete Vortex Athletics signup`
  const text = [
    parentName ? `Hi ${parentName},` : 'Hello,',
    '',
    `${minorName} started signing up for Vortex Athletics and needs a parent or guardian to finish the account, enrollments, and waivers.`,
    '',
    `Complete signup: ${inviteUrl}`,
    '',
    'This link expires in 7 days and can only be used once.',
    '',
    '— Vortex Athletics',
  ].join('\n')

  const html = `
    <p>${parentName ? `Hi ${parentName},` : 'Hello,'}</p>
    <p><strong>${minorName}</strong> started signing up for Vortex Athletics and needs a parent or guardian to finish the account, enrollments, and waivers.</p>
    <p><a href="${inviteUrl}">Complete signup</a></p>
    <p style="color:#666;font-size:13px;">This link expires in 7 days and can only be used once.</p>
    <p>— Vortex Athletics</p>
  `

  if (!isEmailConfigured()) {
    console.warn('[accountInviteEmail] SMTP not configured; invite URL:', inviteUrl)
    return { sent: false, previewUrl: inviteUrl }
  }

  await sendEmail({ to, subject, text, html })
  return { sent: true }
}
