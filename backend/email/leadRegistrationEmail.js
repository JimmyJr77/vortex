import { sendEmail } from './sendEmail.js'
import { emailButtonHtml, escapeHtml, preheaderHtml } from './emailHtml.js'
import { publicAppUrl } from './publicAppUrl.js'

export function leadRegistrationLinks(invite, token) {
  const setup = `${publicAppUrl()}/signup/lead?invite=${invite.id}&token=${encodeURIComponent(token)}`
  const selections = (invite.pending_payload.selections || []).map(item => ({
    label: `${item.childName ? item.childName + ' · ' : ''}${item.label}`,
    reserved: item.kind === 'reserved',
  }))
  return { setup, selections }
}

export async function sendLeadRegistrationEmail({ invite, token, password, send = sendEmail }) {
  const { setup, selections } = leadRegistrationLinks(invite, token)
  const firstName = invite.pending_payload.guardian?.firstName?.trim()
  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,'
  const expires = new Date(invite.expires_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
  const intro = 'Open the registration link and sign in with the temporary credentials below. Choose a new password, confirm your family details, and fill in any missing information. You can also change your username.'
  const next = selections.length
    ? 'Your coach-suggested enrollments will be filled in automatically during registration. After completing setup and the required forms, review your family’s order and pay to confirm enrollment.'
    : 'Follow the instructions above and sign the required forms to finish setting up your family account. No classes have been suggested yet; you can browse classes and enroll from your Member Portal.'
  const deadline = `Complete setup by ${expires}.${selections.some(item => item.reserved) ? ' Reserved spots are held until that date.' : ''}`
  return send({
    to: invite.invitee_email, subject: 'Complete your Vortex Athletics registration',
    category: 'parent_account_invitation', templateVersion: 'lead_registration_v1', facilityId: invite.facility_id,
    // Delivery is serialized by the invitation row; each explicit retry is independently audited.
    text: [
      greeting, '', 'Finish your family account', intro,
      `Username: ${invite.suggested_username}`, `Temporary password: ${password}`, `Register: ${setup}`,
      '', next, '', 'Coach suggested enrollment(s)',
      ...selections.map(item => item.label),
      '', deadline, invite.pending_payload.instructions || '', 'Vortex Athletics',
    ].join('\n'),
    html: `${preheaderHtml('Your account setup and class registration instructions')}
      <p>${escapeHtml(greeting)}</p>
      <h2>Finish your family account</h2><p>${escapeHtml(intro)}</p>
      <p><strong>Username:</strong> ${escapeHtml(invite.suggested_username)}<br><strong>Temporary password:</strong> ${escapeHtml(password)}</p>
      ${emailButtonHtml('Start registration', setup)}
      <p>${escapeHtml(next)}</p><h2>Coach suggested enrollment(s)</h2>
      ${selections.map(item => `<p><strong>${escapeHtml(item.label)}</strong></p>`).join('')}
      <p>${escapeHtml(deadline)}</p>
      ${invite.pending_payload.instructions ? `<p style="white-space:pre-wrap">${escapeHtml(invite.pending_payload.instructions)}</p>` : ''}`,
  })
}
