import { sendEmail } from './sendEmail.js'
import { emailButtonHtml, escapeHtml, preheaderHtml } from './emailHtml.js'
import { publicAppUrl } from './publicAppUrl.js'

export function leadRegistrationLinks(invite, token) {
  const setup = `${publicAppUrl()}/signup/lead?invite=${invite.id}&token=${encodeURIComponent(token)}`
  const selections = (invite.pending_payload.selections || []).map((item, index) => ({
    label: `${item.childName ? item.childName + ' · ' : ''}${item.label}`,
    url: `${setup}&selection=${index}`,
    reserved: item.kind === 'reserved',
  }))
  return { setup, selections }
}

export async function sendLeadRegistrationEmail({ invite, token, password, send = sendEmail }) {
  const { setup, selections } = leadRegistrationLinks(invite, token)
  const expires = new Date(invite.expires_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
  const intro = 'Sign in using the temporary credentials below, choose a new password (you can also change your username), confirm your family and children, and sign the required forms.'
  const next = selections.length ? 'After account setup, use the links below for each child and class. Reserved classes are held pending setup and payment; finish checkout to confirm them.' : 'After account setup, you can browse classes and enroll from your Member Portal.'
  return send({
    to: invite.invitee_email, subject: 'Complete your Vortex Athletics registration',
    category: 'parent_account_invitation', templateVersion: 'lead_registration_v1', facilityId: invite.facility_id,
    // Delivery is serialized by the invitation row; each explicit retry is independently audited.
    text: [`Hi ${invite.pending_payload.guardian.firstName},`, '', '1. Finish your family account', intro, `Username: ${invite.suggested_username}`, `Temporary password: ${password}`, `Register: ${setup}`, '', '2. Choose or complete your classes', next, ...selections.map(item => `${item.label}${item.reserved ? ' (reserved; payment required)' : ''}: ${item.url}`), '', `Complete setup by ${expires}. Any reserved spots are held until that date.`, invite.pending_payload.instructions || '', 'Vortex Athletics'].join('\n'),
    html: `${preheaderHtml('Your account setup and class registration instructions')}<p>Hi ${escapeHtml(invite.pending_payload.guardian.firstName)},</p><h2>1. Finish your family account</h2><p>${escapeHtml(intro)}</p><p><strong>Username:</strong> ${escapeHtml(invite.suggested_username)}<br><strong>Temporary password:</strong> ${escapeHtml(password)}</p>${emailButtonHtml('Register and finish account setup', setup)}<h2>2. Choose or complete your classes</h2><p>${escapeHtml(next)}</p>${selections.map(item => `<p><strong>${escapeHtml(item.label)}</strong>${item.reserved ? '<br>Reserved pending account setup and payment.' : ''}</p>${emailButtonHtml(item.reserved ? 'Review reserved class and pay' : 'Choose a class', item.url)}`).join('')}<p>Complete setup by ${escapeHtml(expires)}. Any reserved spots are held until that date.</p>${invite.pending_payload.instructions ? `<p style="white-space:pre-wrap">${escapeHtml(invite.pending_payload.instructions)}</p>` : ''}`,
  })
}
