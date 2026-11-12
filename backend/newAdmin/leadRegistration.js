import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { resolveJwtSecret } from '../auth/jwtSecret.js'
import { encryptAccountInviteToken, decryptAccountInviteToken } from '../email/accountInviteTokens.js'
import { sendLeadRegistrationEmail } from '../email/leadRegistrationEmail.js'
import { generateTemporaryPassword } from '../scheduling/tempPasswordEmail.js'
import { processFamilySignup } from '../platform/familySignup.js'
import { prepareFamilyEnrollmentCheckout } from '../platform/familyEnrollmentCheckout.js'
import { requireEnrollmentStartDate } from '../scheduling/enrollmentStartDate.js'
import { inquiryInput } from './leadInquiry.js'
import { id, inputError } from './common.js'

const digest = value => crypto.createHash('sha256').update(String(value)).digest('hex')
export async function nextLeadUsername(db, firstName, lastName) {
  const clean = text => String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const base = (clean(firstName).slice(0, 40) + clean(lastName).slice(0, 1)) || 'member'
  await db.query('SELECT pg_advisory_xact_lock(846001)')
  for (let suffix = 0; suffix < 100000; suffix++) {
    const username = base + (suffix || '')
    const found = await db.query(`SELECT 1 FROM app_user WHERE LOWER(BTRIM(username))=$1 OR LOWER(BTRIM(email))=$1
      UNION ALL SELECT 1 FROM member WHERE LOWER(BTRIM(username))=$1
      UNION ALL SELECT 1 FROM account_invite WHERE LOWER(suggested_username)=$1 AND used_at IS NULL AND expires_at>now() LIMIT 1`, [username])
    if (!found.rows.length) return username
  }
  throw inputError('Unable to generate a username. Contact support.', 409)
}

export async function validateLeadSelections(db, facilityId, children, selections) {
  if (!Array.isArray(selections) || selections.length > 40) throw inputError('Choose at most 40 class links.')
  const seen = new Set()
  const result = []
  for (const item of selections) {
    if (!['program', 'class', 'reserved'].includes(item.kind)) throw inputError('Invalid class selection type.')
    const childIndex = item.childIndex == null || item.childIndex === '' ? null : Number(item.childIndex)
    if (childIndex != null && (!Number.isInteger(childIndex) || childIndex < 0 || !children[childIndex])) throw inputError('Select a child for this class.')
    if (item.kind === 'reserved' && childIndex == null) throw inputError('A reserved class must be assigned to a child.')
    const programsId = id(item.programsId, 'program')
    const program = (await db.query('SELECT id,COALESCE(display_name,name) AS name FROM programs WHERE id=$1 AND facility_id=$2 AND is_active=TRUE AND archived IS NOT TRUE', [programsId, facilityId])).rows[0]
    if (!program) throw inputError('Program not available in this facility.')
    const selection = { kind: item.kind, childIndex, programsId, label: program.name, childName: childIndex == null ? '' : children[childIndex].firstName || `Child ${childIndex + 1}` }
    if (item.kind !== 'program') {
      const klass = (await db.query(`SELECT p.id,COALESCE(p.display_name,p.name) AS name,sf.id AS form_id FROM program p JOIN scheduling_form sf ON sf.program_id=p.id
        WHERE p.id=$1 AND p.programs_id=$2 AND p.facility_id=$3 AND p.is_active=TRUE AND p.archived IS NOT TRUE AND sf.is_active=TRUE AND sf.deleted_at IS NULL
        AND ($4::bigint IS NULL OR EXISTS(SELECT 1 FROM scheduling_time_slot chosen WHERE chosen.id=$4 AND chosen.form_id=sf.id))
        ORDER BY sf.id DESC LIMIT 1`, [id(item.classEventId, 'class'), programsId, facilityId, item.kind === 'reserved' ? id(item.timeSlotId, 'class time') : null])).rows[0]
      if (!klass) throw inputError('Class not available in this program.')
      Object.assign(selection, { classEventId: Number(klass.id), schedulingFormId: Number(klass.form_id), label: `${program.name} / ${klass.name}` })
      if (item.kind === 'reserved') {
        if (!children[childIndex].firstName || !children[childIndex].lastName) throw inputError('Enter the child’s first and last name before reserving a spot.')
        const start = requireEnrollmentStartDate(item.enrollmentStartDate)
        const slot = (await db.query(`SELECT ts.id,ts.slot_group_id,ts.day_of_week,ts.start_time,ts.end_time,ts.specific_date
          FROM scheduling_time_slot ts JOIN scheduling_slot_group sg ON sg.id=ts.slot_group_id
          LEFT JOIN scheduling_offering o ON o.id=sg.offering_id
          WHERE ts.id=$1 AND ts.form_id=$2 AND sg.form_id=$2 AND ts.is_active=TRUE AND sg.is_active=TRUE
          AND (sg.offering_id IS NULL OR o.is_selected=TRUE)
          AND $3::date BETWEEN COALESCE(o.start_date,sg.active_start,'-infinity'::date) AND COALESCE(o.end_date,sg.active_end,'infinity'::date)`, [id(item.timeSlotId, 'class time'), klass.form_id, start])).rows[0]
        if (!slot) throw inputError('Class time is no longer available.')
        const key = `${childIndex}:${slot.slot_group_id}`
        if (seen.has(key)) throw inputError('This child already has that class time selected.')
        seen.add(key)
        const day = slot.specific_date ? String(slot.specific_date).slice(0, 10) : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][slot.day_of_week]
        const scheduleLabel = `${day} ${String(slot.start_time).slice(0, 5)}–${String(slot.end_time).slice(0, 5)}`
        Object.assign(selection, { slotGroupId: Number(slot.slot_group_id), timeSlotId: Number(slot.id), enrollmentStartDate: start, scheduleLabel, label: `${selection.label} · ${scheduleLabel}` })
      }
    }
    result.push(selection)
  }
  return result
}

export function invitationSummary(invite) {
  return { id: Number(invite.id), username: invite.suggested_username, email: invite.invitee_email, status: invite.used_at ? 'completed' : new Date(invite.expires_at) <= new Date() ? 'expired' : invite.delivery_status, expiresAt: invite.expires_at, selections: invite.pending_payload.selections, children: invite.pending_payload.children }
}

export async function createLeadInvitation(pool, { facilityId, leadId, userId, body }, dependencies = {}) {
  const client = await pool.connect()
  let invite
  try {
    await client.query('BEGIN')
    const lead = (await client.query('SELECT * FROM registrations WHERE id=$1 AND facility_id=$2 AND archived IS NOT TRUE FOR UPDATE', [id(leadId), facilityId])).rows[0]
    if (!lead) throw inputError('Lead not found.', 404)
    if (lead.converted_member_id || lead.member_id) throw inputError('This lead already has a member account. Open that account to manage registrations.', 409)
    const existing = (await client.query(`SELECT * FROM account_invite WHERE registration_id=$1 AND invite_type='lead_registration' AND used_at IS NULL AND expires_at>now() ORDER BY id DESC LIMIT 1`, [lead.id])).rows[0]
    if (existing) { invite = existing; await client.query('COMMIT'); return invitationSummary(invite) }
    const emailConflict = await client.query('SELECT id FROM app_user WHERE LOWER(BTRIM(email))=LOWER(BTRIM($1)) UNION ALL SELECT id FROM member WHERE LOWER(BTRIM(email))=LOWER(BTRIM($1)) LIMIT 1', [lead.email])
    if (emailConflict.rows.length) throw inputError('This email already has an account. Link the verified existing member instead of creating another login.', 409)
    const children = inquiryInput({ campers: body.children || lead.campers || [] }).campers
    const selections = await validateLeadSelections(client, facilityId, children, body.selections || [])
    const holdDays = Number(body.holdDays ?? 7)
    if (!Number.isInteger(holdDays) || holdDays < 1 || holdDays > 30) throw inputError('Choose a registration deadline from 1 to 30 days.')
    const instructions = String(body.instructions || '').trim()
    if (instructions.length > 4000) throw inputError('Instructions must be at most 4,000 characters.')
    const username = await nextLeadUsername(client, lead.first_name, lead.last_name)
    const password = generateTemporaryPassword(16), token = crypto.randomBytes(32).toString('hex')
    const payload = { guardian: { firstName: lead.first_name, lastName: lead.last_name, email: lead.email, phone: lead.phone || '' }, children, selections, instructions, passwordCiphertext: encryptAccountInviteToken(password) }
    invite = (await client.query(`INSERT INTO account_invite(facility_id,registration_id,invite_type,token_hash,token_ciphertext,invitee_email,pending_payload,expires_at,suggested_username,temporary_password_hash,request_key,created_by_user_id)
      VALUES($1,$2,'lead_registration',$3,$4,$5,$6::jsonb,now()+($7::int*interval '1 day'),$8,$9,$10,$11) RETURNING *`, [facilityId, lead.id, digest(token), encryptAccountInviteToken(token), lead.email, JSON.stringify(payload), holdDays, username, await bcrypt.hash(password, 10), String(body.requestKey || crypto.randomUUID()), userId])).rows[0]
    // Stable lock ordering prevents deadlocks for multi-child, multi-class invitations.
    const groups = [...new Set(selections.filter(item => item.kind === 'reserved').map(item => item.slotGroupId))].sort((a,b) => a-b)
    if (groups.length) await client.query('SELECT id FROM scheduling_slot_group WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE', [groups])
    for (const item of selections.filter(item => item.kind === 'reserved')) {
      const child = children[item.childIndex]
      await client.query(`INSERT INTO scheduling_signup(form_id,slot_group_id,time_slot_id,first_name,last_name,email,status,enrollment_start_date,account_invite_id,invite_child_index,reserved_until)
        VALUES($1,$2,$3,$4,$5,$6,'pending_setup',$7,$8,$9,$10)`, [item.schedulingFormId, item.slotGroupId, item.timeSlotId, child.firstName, child.lastName, lead.email, item.enrollmentStartDate, invite.id, item.childIndex, invite.expires_at])
    }
    await client.query("UPDATE registrations SET contacted=TRUE,first_contacted_at=COALESCE(first_contacted_at,now()),lead_status='qualified',updated_at=now() WHERE id=$1", [lead.id])
    await client.query('COMMIT')
  } catch (error) { await client.query('ROLLBACK'); if (error.code === 'P0001') error.statusCode=409; throw error } finally { client.release() }
  return deliverLeadInvitation(pool, { facilityId, inviteId: invite.id }, dependencies)
}

export async function deliverLeadInvitation(pool, { facilityId, inviteId, resend = false }, { sendInvitation = sendLeadRegistrationEmail } = {}) {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const invite = (await db.query("SELECT * FROM account_invite WHERE id=$1 AND facility_id=$2 AND invite_type='lead_registration' FOR UPDATE", [id(inviteId), facilityId])).rows[0]
    if (!invite) throw inputError('Invitation not found.', 404)
    if (invite.used_at || new Date(invite.expires_at) <= new Date()) throw inputError('This invitation is completed or expired.', 409)
    if (invite.delivery_status === 'sent' && !resend) { await db.query('COMMIT'); return invitationSummary(invite) }
    let sent=false
    try { sent = (await sendInvitation({ invite, token: decryptAccountInviteToken(invite.token_ciphertext), password: decryptAccountInviteToken(invite.pending_payload.passwordCiphertext) }))?.sent === true } catch { /* Keep the invitation and its holds available for an explicit retry. */ }
    invite.delivery_status = sent ? 'sent' : 'failed'
    await db.query('UPDATE account_invite SET delivery_status=$2 WHERE id=$1', [invite.id, invite.delivery_status])
    await db.query('COMMIT')
    return invitationSummary(invite)
  } catch (error) { await db.query('ROLLBACK'); throw error } finally { db.release() }
}

async function loadInvitation(db, inviteId, token, lock = false) {
  const invite = (await db.query(`SELECT * FROM account_invite WHERE id=$1 AND invite_type='lead_registration' ${lock ? 'FOR UPDATE' : ''}`, [id(inviteId)])).rows[0]
  if (!invite || digest(token) !== invite.token_hash) throw inputError('Invalid registration link.', 404)
  return invite
}

export async function openLeadRegistration(db, inviteId, body) {
  const invite = await loadInvitation(db, inviteId, body.token)
  if (new Date(invite.expires_at) <= new Date() && !invite.used_at) throw inputError('This registration link has expired. Please ask Vortex to send a new invitation.', 410)
  let valid = false
  if (invite.used_at) {
    const account = (await db.query('SELECT u.* FROM app_user u JOIN member m ON m.app_user_id=u.id WHERE m.id=$1 AND u.facility_id=$2 AND u.is_active=TRUE', [invite.pending_payload.result?.payerMemberId, invite.facility_id])).rows[0]
    valid = account && [account.username, account.email].some(value => String(value).trim().toLowerCase() === String(body.username).trim().toLowerCase()) && await bcrypt.compare(String(body.password || ''), account.password_hash || '')
  } else valid = String(body.username || '').toLowerCase() === invite.suggested_username.toLowerCase() && await bcrypt.compare(String(body.password || ''), invite.temporary_password_hash)
  if (!valid) throw inputError('Incorrect username or password.', 401)
  const waivers = (await db.query(`SELECT id,name,version,body,waiver_type,is_required FROM waiver_template
    WHERE facility_id=$1 AND active_from<=now() AND (active_to IS NULL OR active_to>now()) ORDER BY id`,[invite.facility_id])).rows
  let result = invite.used_at ? invite.pending_payload.result : undefined
  if (result) {
    const pending = (await db.query("SELECT member_id,slot_group_id FROM scheduling_signup WHERE account_invite_id=$1 AND status='pending_setup'",[invite.id])).rows
    result = {...result,pendingEnrollments:result.pendingEnrollments.filter(item=>pending.some(row=>Number(row.member_id)===item.memberId && Number(row.slot_group_id)===item.slotGroupId))}
  }
  return { waivers, session: jwt.sign({ purpose: 'lead_registration', inviteId: Number(invite.id) }, resolveJwtSecret(), { expiresIn: '2h' }), guardian: invite.pending_payload.guardian, children: invite.pending_payload.children, selections: invite.pending_payload.selections, username: invite.suggested_username, instructions: invite.pending_payload.instructions, expiresAt: invite.expires_at, completed: Boolean(invite.used_at), result }
}

export async function completeLeadRegistration(pool, inviteId, body, request = {}) {
  let claims
  try { claims=jwt.verify(String(body.session || ''), resolveJwtSecret()) } catch { throw inputError('Please sign in to your registration invitation again.', 401) }
  if (claims.purpose !== 'lead_registration' || claims.inviteId !== id(inviteId)) throw inputError('Invalid registration session.', 401)
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const invite = await loadInvitation(db, inviteId, body.token, true)
    if (invite.used_at) { await db.query('COMMIT'); return invite.pending_payload.result }
    if (new Date(invite.expires_at) <= new Date()) throw inputError('This invitation has expired. Ask Vortex for a new invitation.', 410)
    const primaryAdult = body.primaryAdult || {}
    if (String(primaryAdult.email).trim().toLowerCase() !== invite.invitee_email.toLowerCase()) throw inputError('Use the email address that received this invitation.')
    if (await bcrypt.compare(String(primaryAdult.password || ''), invite.temporary_password_hash)) throw inputError('Choose a new password, different from the temporary password.')
    const children = Array.isArray(body.additionalMembers) ? body.additionalMembers : []
    if (children.length < invite.pending_payload.children.length || children.length > 20) throw inputError('Complete the details for each child on the invitation.')
    inquiryInput({campers:children}) // Reject invalid or future birthdays before creating shared member records.
    // Enrollment billing is owned exclusively by the existing authenticated checkout.
    const result = await processFamilySignup(db, { primaryAdult, additionalMembers: children, enrollments: [], waivers: body.waivers, familyName: `${primaryAdult.lastName} Family` }, { facilityId: invite.facility_id, leadInvitationId: invite.id, ipAddress: request.ip, userAgent: request.userAgent })
    for (let index=0; index<invite.pending_payload.children.length; index++) {
      await db.query("UPDATE scheduling_signup SET member_id=$3,first_name=$4,last_name=$5 WHERE account_invite_id=$1 AND invite_child_index=$2 AND status='pending_setup'", [invite.id, index, result.memberIds[index+1], children[index].firstName, children[index].lastName])
    }
    const pendingEnrollments=[]
    for (const selection of invite.pending_payload.selections.filter(item => item.kind === 'reserved')) pendingEnrollments.push(await prepareFamilyEnrollmentCheckout(db, { memberId: result.memberIds[selection.childIndex+1], enrollment: selection }))
    const completed = { ...result, pendingEnrollments }
    await db.query("UPDATE account_invite SET used_at=now(),temporary_password_hash=NULL,pending_payload=(pending_payload-'passwordCiphertext')||jsonb_build_object('result',$2::jsonb) WHERE id=$1", [invite.id, JSON.stringify(completed)])
    await db.query("UPDATE registrations SET converted_member_id=$2,converted_at=now(),converted_by_user_id=$3,lead_status='converted',updated_at=now() WHERE id=$1 AND facility_id=$4", [invite.registration_id, result.payerMemberId, invite.created_by_user_id, invite.facility_id])
    await db.query('COMMIT')
    return completed
  } catch (error) { await db.query('ROLLBACK'); if (!error.statusCode) error.statusCode=400; throw error } finally { db.release() }
}

export async function leadRegistrationCatalog(db, facilityId) {
  const rows = await db.query(`SELECT pr.id AS programs_id,COALESCE(pr.display_name,pr.name) AS program_name,p.id AS class_id,COALESCE(p.display_name,p.name) AS class_name,
    sf.id AS form_id,sg.id AS group_id,sg.max_participants,ts.id AS slot_id,ts.day_of_week,ts.specific_date::text,ts.start_time,ts.end_time,
    (SELECT COUNT(*)::int FROM scheduling_signup s WHERE s.slot_group_id=sg.id AND s.status='confirmed')+pending_registration_holds(sg.id) AS occupied
    FROM programs pr LEFT JOIN program p ON p.programs_id=pr.id AND p.facility_id=pr.facility_id AND p.is_active=TRUE AND p.archived IS NOT TRUE
    LEFT JOIN scheduling_form sf ON sf.program_id=p.id AND sf.is_active=TRUE AND sf.deleted_at IS NULL
    LEFT JOIN scheduling_slot_group sg ON sg.form_id=sf.id AND sg.is_active=TRUE
      AND (sg.offering_id IS NULL OR EXISTS(SELECT 1 FROM scheduling_offering o WHERE o.id=sg.offering_id AND o.is_selected=TRUE AND COALESCE(o.end_date,'infinity'::date)>=CURRENT_DATE))
      AND COALESCE(sg.active_end,sf.end_date,'infinity'::date)>=CURRENT_DATE
    LEFT JOIN scheduling_time_slot ts ON ts.form_id=sf.id AND ts.slot_group_id=sg.id AND ts.is_active=TRUE
    WHERE pr.facility_id=$1 AND pr.is_active=TRUE AND pr.archived IS NOT TRUE
    ORDER BY program_name,class_name,ts.day_of_week,ts.start_time`, [facilityId])
  return rows.rows
}
