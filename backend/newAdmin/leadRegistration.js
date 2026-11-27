import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { resolveJwtSecret } from '../auth/jwtSecret.js'
import { findActiveMemberLoginCandidates, normalizeSignupEmail } from '../auth/memberLoginIdentifiers.js'
import { encryptAccountInviteToken, decryptAccountInviteToken } from '../email/accountInviteTokens.js'
import { sendLeadRegistrationEmail } from '../email/leadRegistrationEmail.js'
import { generateTemporaryPassword } from '../scheduling/tempPasswordEmail.js'
import { processFamilySignup, resolveSignupWaiverTargetMemberIds } from '../platform/familySignup.js'
import { normalizeEnrollmentStartDate } from '../scheduling/enrollmentStartDate.js'
import { assertEnrollmentDateAvailable } from '../scheduling/enrollmentDateAvailability.js'
import { bookMemberFreeTrial, trialAgeOnDate, validateTrialSelection } from '../scheduling/freeTrials.js'
import { inquiryInput } from './leadInquiry.js'
import { leadInput, updateLead } from './leads.js'
import { id, inputError } from './common.js'

const digest = value => crypto.createHash('sha256').update(String(value)).digest('hex')
const invitationPurpose = invite => invite.pending_payload.purpose === 'trial' ? 'trial' : 'registration'

function invitationSelections(invite, selections) {
  if (invitationPurpose(invite) === 'trial') {
    if (selections != null && (!Array.isArray(selections) || selections.length)) {
      throw inputError('Trial dates are chosen after family information and waivers are completed.')
    }
    return []
  }
  return selections
}
export async function nextLeadUsername(db, firstName, lastName) {
  const clean = text => String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const name = clean(firstName).slice(0, 40) + clean(lastName).slice(0, 1)
  const base = !name || /^\d+$/.test(name) ? `member${name}` : name
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

async function loadClassTime(db, { formId, timeSlotId, startDate, selectedOfferingOnly = false }) {
  return (await db.query(`SELECT ts.id,ts.slot_group_id,ts.day_of_week,ts.start_time,ts.end_time,ts.specific_date::text
    FROM scheduling_time_slot ts
    JOIN scheduling_form sf ON sf.id=ts.form_id
    JOIN scheduling_slot_group sg ON sg.id=ts.slot_group_id AND sg.form_id=sf.id
    LEFT JOIN scheduling_offering o ON o.id=sg.offering_id
    WHERE ts.id=$1 AND ts.form_id=$2 AND ts.is_active=TRUE AND sg.is_active=TRUE
    AND (NOT $4::boolean OR sg.offering_id IS NULL OR o.is_selected=TRUE)
    AND COALESCE(o.end_date,sg.active_end,sf.end_date,'infinity'::date)>=CURRENT_DATE
    AND ($3::date IS NULL OR $3::date BETWEEN COALESCE(o.start_date,sg.active_start,sf.start_date,'-infinity'::date)
      AND COALESCE(o.end_date,sg.active_end,sf.end_date,'infinity'::date))`, [timeSlotId, formId, startDate, selectedOfferingOnly])).rows[0]
}

function classTimeLabel(slot) {
  const day = slot.specific_date || ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][slot.day_of_week]
  return `${day} ${String(slot.start_time).slice(0, 5)}–${String(slot.end_time).slice(0, 5)}`
}

export async function validateLeadSelections(db, facilityId, children, selections) {
  if (!Array.isArray(selections) || selections.length > 40) throw inputError('Choose at most 40 class links.')
  if (selections.length === 0) return []
  const catalog = (await leadRegistrationCatalog(db, facilityId)).filter(row => row.slot_id != null)
  const seen = new Set()
  const result = []
  for (const item of selections) {
    if (!item || !['program', 'class', 'reserved'].includes(item.kind)) throw inputError('Invalid class selection type.')
    const childIndex = item.childIndex == null || item.childIndex === '' ? null : Number(item.childIndex)
    if (childIndex != null && (!Number.isInteger(childIndex) || childIndex < 0 || !children[childIndex])) throw inputError('Select a child for this class.')
    const programsId = id(item.programsId, 'program')
    const programRows = catalog.filter(row => Number(row.programs_id) === programsId)
    if (!programRows.length) throw inputError('This program has no class times available for registration.')
    const programName = programRows[0].program_name
    const start = normalizeEnrollmentStartDate(item.enrollmentStartDate)
    if (String(item.enrollmentStartDate ?? '').trim() && !start) throw inputError('Enter a valid enrollment start date.')
    const selection = {
      kind: item.kind, childIndex, programsId, programName, label: programName,
      childName: childIndex == null ? '' : children[childIndex].firstName || `Child ${childIndex + 1}`,
      enrollmentStartDate: start,
    }
    if (item.kind !== 'program') {
      const classEventId = id(item.classEventId, 'class')
      const timeSlotId = item.kind === 'reserved' ? id(item.timeSlotId, 'class time') : null
      const klass = programRows.find(row => Number(row.class_id) === classEventId && (timeSlotId == null || Number(row.slot_id) === timeSlotId))
      if (!klass) throw inputError('This class or time is unavailable in the selected program.')
      Object.assign(selection, { classEventId, schedulingFormId: Number(klass.form_id), className: klass.class_name, label: `${programName} / ${klass.class_name}` })
      if (item.kind === 'reserved') {
        const slot = await loadClassTime(db, { formId: klass.form_id, timeSlotId, startDate: start, selectedOfferingOnly: true })
        if (!slot) throw inputError('Class time is unavailable for the selected start date.')
        await assertEnrollmentDateAvailable(db, { formId: klass.form_id, slotGroupId: slot.slot_group_id, timeSlotId, enrollmentStartDate: start, facilityId, lock: true, lockGroup: false })
        const key = `${childIndex}:${slot.slot_group_id}`
        if (childIndex != null) {
          if (seen.has(key)) throw inputError('This child already has that class time selected.')
          seen.add(key)
        }
        const scheduleLabel = classTimeLabel(slot)
        Object.assign(selection, { slotGroupId: Number(slot.slot_group_id), timeSlotId: Number(slot.id), scheduleLabel, label: `${selection.label} · ${scheduleLabel}` })
      }
    }
    result.push(selection)
  }
  return result
}

export function invitationSummary(invite) {
  return { id: Number(invite.id), username: invite.suggested_username, email: invite.invitee_email, status: invite.used_at ? 'completed' : new Date(invite.expires_at) <= new Date() ? 'expired' : invite.delivery_status, expiresAt: invite.expires_at, selections: invite.pending_payload.selections, children: invite.pending_payload.children,
    purpose: invitationPurpose(invite), guardian: invite.pending_payload.guardian, instructions: invite.pending_payload.instructions || '', revision: invite.pending_payload.revision || 0 }
}

async function recheckReservedDates(db, facilityId, selections) {
  // Validation holds the day locks; callers acquire all group locks in stable
  // order before this fresh snapshot so concurrent session edits cannot win.
  for (const item of selections.filter(item => item.kind === 'reserved')) {
    await assertEnrollmentDateAvailable(db, { formId: item.schedulingFormId, slotGroupId: item.slotGroupId,
      timeSlotId: item.timeSlotId, enrollmentStartDate: item.enrollmentStartDate, facilityId })
  }
}

export async function updateLeadInvitation(pool, { facilityId, inviteId, body, canReserve = false }, dependencies = {}) {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const reference = (await db.query("SELECT registration_id FROM account_invite WHERE id=$1 AND facility_id=$2 AND invite_type='lead_registration'", [id(inviteId), facilityId])).rows[0]
    if (!reference) throw inputError('Invitation not found.', 404)
    // Use the same lead -> invitation -> ordered class locks as registration completion.
    const lead = (await db.query('SELECT * FROM registrations WHERE id=$1 AND facility_id=$2 FOR UPDATE', [reference.registration_id, facilityId])).rows[0]
    const invite = (await db.query("SELECT * FROM account_invite WHERE id=$1 AND facility_id=$2 AND invite_type='lead_registration' FOR UPDATE", [id(inviteId), facilityId])).rows[0]
    if (!invite) throw inputError('Invitation not found.', 404)
    if (invite.used_at || new Date(invite.expires_at) <= new Date()) throw inputError('This invitation is completed or expired.', 409)
    if (!lead || lead.archived || lead.converted_member_id || lead.member_id || lead.trial_contact_member_id) throw inputError('This lead already has an account or is no longer open.', 409)
    const revision = invite.pending_payload.revision || 0
    if (!Number.isInteger(body.revision) || body.revision !== revision) throw inputError('This invitation changed. Close and reopen it before editing.', 409)
    const children = inquiryInput({ campers: body.children }).campers
    const selections = await validateLeadSelections(db, facilityId, children, invitationSelections(invite, body.selections))
    if (!canReserve && [...invite.pending_payload.selections, ...selections].some(item => item.kind === 'reserved')) throw inputError('Scheduling permission is required to change an invitation with reserved classes.', 403)
    const holdDays = Number(body.holdDays)
    if (!Number.isInteger(holdDays) || holdDays < 1 || holdDays > 30) throw inputError('Choose a registration deadline from 1 to 30 days.')
    const instructions = String(body.instructions || '').trim()
    if (instructions.length > 4000) throw inputError('Instructions must be at most 4,000 characters.')
    if (!body.guardian || typeof body.guardian !== 'object' || Array.isArray(body.guardian)) throw inputError('Enter the contact details.')
    const contact = leadInput(body.guardian, { currentPhone: lead.phone })
    const email = normalizeSignupEmail(contact.email)
    if (!email) throw inputError('Enter a valid contact email address.')
    const conflict = await db.query('SELECT id FROM app_user WHERE LOWER(BTRIM(email))=$1 OR LOWER(BTRIM(username))=$1 UNION ALL SELECT id FROM member WHERE LOWER(BTRIM(email))=$1 LIMIT 1', [email])
    if (conflict.rows.length) throw inputError('This email already has an account. Link the verified existing member instead of creating another login.', 409)
    const guardian = { firstName: contact.firstName, lastName: contact.lastName, email, phone: contact.phone || '' }
    const holds = (await db.query('SELECT slot_group_id FROM scheduling_signup WHERE account_invite_id=$1 AND status=\'pending_setup\'', [invite.id])).rows
    const groups = [...new Set([...holds.map(row => Number(row.slot_group_id)), ...selections.filter(item => item.kind === 'reserved').map(item => item.slotGroupId)])].sort((a,b) => a-b)
    if (groups.length) await db.query('SELECT id FROM scheduling_slot_group WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE', [groups])
    await recheckReservedDates(db, facilityId, selections)
    await db.query("UPDATE scheduling_signup SET status='cancelled',reserved_until=NULL WHERE account_invite_id=$1 AND status='pending_setup'", [invite.id])
    // Rotate the link on every edit so an already-open registration cannot submit stale selections.
    const token = crypto.randomBytes(32).toString('hex')
    const password = generateTemporaryPassword(16)
    const payload = { ...invite.pending_payload, guardian, children, selections, instructions, revision: revision + 1, passwordCiphertext: encryptAccountInviteToken(password) }
    const saved = (await db.query(`UPDATE account_invite SET pending_payload=$2::jsonb,invitee_email=$3,expires_at=now()+($4::int*interval '1 day'),
      token_hash=$5,token_ciphertext=$6,temporary_password_hash=$7,delivery_status='pending' WHERE id=$1 RETURNING *`,
    [invite.id, JSON.stringify(payload), email, holdDays, digest(token), encryptAccountInviteToken(token), await bcrypt.hash(password, 10)])).rows[0]
    for (const item of selections.filter(item => item.kind === 'reserved')) {
      const child = children[item.childIndex]
      const hold = await db.query(`INSERT INTO scheduling_signup(form_id,slot_group_id,time_slot_id,first_name,last_name,email,status,enrollment_start_date,account_invite_id,invite_child_index,reserved_until)
        VALUES($1,$2,$3,$4,$5,$6,'pending_setup',$7,$8,$9,$10)
        ON CONFLICT(account_invite_id,invite_child_index,slot_group_id) WHERE account_invite_id IS NOT NULL
        DO UPDATE SET form_id=EXCLUDED.form_id,time_slot_id=EXCLUDED.time_slot_id,first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,
          email=EXCLUDED.email,status='pending_setup',enrollment_start_date=EXCLUDED.enrollment_start_date,reserved_until=EXCLUDED.reserved_until
        RETURNING id`, [item.schedulingFormId, item.slotGroupId, item.timeSlotId, child?.firstName || '', child?.lastName || '', email, item.enrollmentStartDate, invite.id, item.childIndex, saved.expires_at])
      item.holdSignupId = Number(hold.rows[0].id)
    }
    await db.query("UPDATE account_invite SET pending_payload=jsonb_set(pending_payload,'{selections}',$2::jsonb) WHERE id=$1", [invite.id, JSON.stringify(selections)])
    await updateLead(db, facilityId, lead.id, { ...guardian, inquiry: { campers: children } }, lead.phone)
    await db.query('COMMIT')
  } catch (error) { await db.query('ROLLBACK'); if (error.code === 'P0001') error.statusCode=409; throw error } finally { db.release() }
  return deliverLeadInvitation(pool, { facilityId, inviteId, resend: true }, dependencies)
}

export async function createLeadInvitation(pool, { facilityId, leadId, userId, body }, dependencies = {}) {
  const client = await pool.connect()
  let invite
  try {
    await client.query('BEGIN')
    const lead = (await client.query('SELECT * FROM registrations WHERE id=$1 AND facility_id=$2 AND archived IS NOT TRUE FOR UPDATE', [id(leadId), facilityId])).rows[0]
    if (!lead) throw inputError('Lead not found.', 404)
    if (lead.converted_member_id || lead.member_id || lead.trial_contact_member_id) throw inputError('This lead already has a member account. Open that account to manage registrations.', 409)
    const existing = (await client.query(`SELECT * FROM account_invite WHERE registration_id=$1 AND invite_type='lead_registration' AND used_at IS NULL AND expires_at>now() ORDER BY id DESC LIMIT 1`, [lead.id])).rows[0]
    if (existing) {
      await client.query('COMMIT')
      return deliverLeadInvitation(pool, { facilityId, inviteId: existing.id }, dependencies)
    }
    const email = normalizeSignupEmail(lead.email)
    if (!email) throw inputError('Update the lead with a valid email address before sending the invitation.')
    const emailConflict = await client.query('SELECT id FROM app_user WHERE LOWER(BTRIM(email))=$1 OR LOWER(BTRIM(username))=$1 UNION ALL SELECT id FROM member WHERE LOWER(BTRIM(email))=$1 LIMIT 1', [email])
    if (emailConflict.rows.length) throw inputError('This email already has an account. Link the verified existing member instead of creating another login.', 409)
    const children = inquiryInput({ campers: body.children || lead.campers || [] }).campers
    const purpose = body.mode === 'trial' ? 'trial' : 'registration'
    const selections = await validateLeadSelections(client, facilityId, children,
      invitationSelections({ pending_payload: { purpose } }, body.selections || []))
    const holdDays = Number(body.holdDays ?? 7)
    if (!Number.isInteger(holdDays) || holdDays < 1 || holdDays > 30) throw inputError('Choose a registration deadline from 1 to 30 days.')
    const instructions = String(body.instructions || '').trim()
    if (instructions.length > 4000) throw inputError('Instructions must be at most 4,000 characters.')
    const username = await nextLeadUsername(client, lead.first_name, lead.last_name)
    const password = generateTemporaryPassword(16), token = crypto.randomBytes(32).toString('hex')
    const payload = { purpose, guardian: { firstName: lead.first_name, lastName: lead.last_name, email, phone: lead.phone || '' }, children, selections, instructions, passwordCiphertext: encryptAccountInviteToken(password) }
    invite = (await client.query(`INSERT INTO account_invite(facility_id,registration_id,invite_type,token_hash,token_ciphertext,invitee_email,pending_payload,expires_at,suggested_username,temporary_password_hash,request_key,created_by_user_id)
      VALUES($1,$2,'lead_registration',$3,$4,$5,$6::jsonb,now()+($7::int*interval '1 day'),$8,$9,$10,$11) RETURNING *`, [facilityId, lead.id, digest(token), encryptAccountInviteToken(token), email, JSON.stringify(payload), holdDays, username, await bcrypt.hash(password, 10), String(body.requestKey || crypto.randomUUID()), userId])).rows[0]
    // Stable lock ordering prevents deadlocks for multi-child, multi-class invitations.
    const groups = [...new Set(selections.filter(item => item.kind === 'reserved').map(item => item.slotGroupId))].sort((a,b) => a-b)
    if (groups.length) await client.query('SELECT id FROM scheduling_slot_group WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE', [groups])
    await recheckReservedDates(client, facilityId, selections)
    for (const item of selections.filter(item => item.kind === 'reserved')) {
      const child = children[item.childIndex]
      const hold = await client.query(`INSERT INTO scheduling_signup(form_id,slot_group_id,time_slot_id,first_name,last_name,email,status,enrollment_start_date,account_invite_id,invite_child_index,reserved_until)
        VALUES($1,$2,$3,$4,$5,$6,'pending_setup',$7,$8,$9,$10) RETURNING id`, [item.schedulingFormId, item.slotGroupId, item.timeSlotId, child?.firstName || '', child?.lastName || '', email, item.enrollmentStartDate, invite.id, item.childIndex, invite.expires_at])
      item.holdSignupId = Number(hold.rows[0].id)
    }
    if (groups.length) await client.query("UPDATE account_invite SET pending_payload=jsonb_set(pending_payload,'{selections}',$2::jsonb) WHERE id=$1", [invite.id, JSON.stringify(selections)])
    await client.query("UPDATE registrations SET contacted=TRUE,first_contacted_at=COALESCE(first_contacted_at,now()),lead_status='qualified',updated_at=now() WHERE id=$1", [lead.id])
    await client.query('COMMIT')
  } catch (error) { await client.query('ROLLBACK'); if (error.code === 'P0001') error.statusCode=409; throw error } finally { client.release() }
  return deliverLeadInvitation(pool, { facilityId, inviteId: invite.id }, dependencies)
}

export async function deliverLeadInvitation(pool, { facilityId, inviteId, resend = false }, { sendInvitation = sendLeadRegistrationEmail } = {}) {
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const reference = (await db.query("SELECT registration_id FROM account_invite WHERE id=$1 AND facility_id=$2 AND invite_type='lead_registration'", [id(inviteId), facilityId])).rows[0]
    if (!reference) throw inputError('Invitation not found.', 404)
    // Match conversion/completion lock order and serialize against lead edits.
    const lead = (await db.query('SELECT * FROM registrations WHERE id=$1 AND facility_id=$2 FOR UPDATE', [reference.registration_id, facilityId])).rows[0]
    const invite = (await db.query("SELECT * FROM account_invite WHERE id=$1 AND facility_id=$2 AND invite_type='lead_registration' FOR UPDATE", [id(inviteId), facilityId])).rows[0]
    if (!invite) throw inputError('Invitation not found.', 404)
    if (invite.used_at || new Date(invite.expires_at) <= new Date()) throw inputError('This invitation is completed or expired.', 409)
    if (!lead || lead.archived || lead.converted_member_id || lead.member_id || lead.trial_contact_member_id) throw inputError('This lead already has an account or is no longer open.', 409)
    const email = normalizeSignupEmail(lead.email)
    if (!email) throw inputError('Update the lead with a valid email address before sending the invitation.')
    if (email !== invite.invitee_email) {
      const conflict = await db.query('SELECT id FROM app_user WHERE LOWER(BTRIM(email))=$1 OR LOWER(BTRIM(username))=$1 UNION ALL SELECT id FROM member WHERE LOWER(BTRIM(email))=$1 LIMIT 1', [email])
      if (conflict.rows.length) throw inputError('This email already has an account. Link the verified existing member instead of creating another login.', 409)
      const token = crypto.randomBytes(32).toString('hex'), password = generateTemporaryPassword(16)
      invite.invitee_email = email
      invite.token_hash = digest(token)
      invite.token_ciphertext = encryptAccountInviteToken(token)
      invite.temporary_password_hash = await bcrypt.hash(password, 10)
      invite.pending_payload.guardian.email = email
      invite.pending_payload.passwordCiphertext = encryptAccountInviteToken(password)
      invite.delivery_status = 'pending'
      await db.query(`UPDATE account_invite SET invitee_email=$2,token_hash=$3,token_ciphertext=$4,
        temporary_password_hash=$5,pending_payload=$6::jsonb,delivery_status='pending' WHERE id=$1`,
      [invite.id, email, invite.token_hash, invite.token_ciphertext, invite.temporary_password_hash, JSON.stringify(invite.pending_payload)])
      await db.query("UPDATE scheduling_signup SET email=$2 WHERE account_invite_id=$1 AND status='pending_setup'", [invite.id, email])
    }
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

async function remainingEnrollments(db, result) {
  if (result?.trialRegistration) return { ...result, trialBookings: await loadInvitationTrialBookings(db, result) }
  if (!result?.pendingEnrollments?.length) return result
  const memberIds = [...new Set(result.pendingEnrollments.map(item => item.memberId))]
  const groups = [...new Set(result.pendingEnrollments.map(item => item.slotGroupId))]
  const enrolled = await db.query(`SELECT member_id,slot_group_id FROM scheduling_signup
    WHERE member_id=ANY($1::bigint[]) AND slot_group_id=ANY($2::bigint[])
    AND status IN ('confirmed','waitlisted','paused','completed')
    AND orphaned_at IS NULL AND archived_at IS NULL`, [memberIds, groups])
  const finished = new Set(enrolled.rows.map(row => `${row.member_id}:${row.slot_group_id}`))
  return { ...result, pendingEnrollments: result.pendingEnrollments.filter(item => !finished.has(`${item.memberId}:${item.slotGroupId}`)) }
}

async function loadInvitationTrialBookings(db, result) {
  const memberIds = (result.trialChildren || []).map(child => Number(child.memberId))
  if (!memberIds.length) return []
  return (await db.query(`SELECT d.id,d.member_id AS "memberId",d.class_date::text AS "classDate",d.status,
      d.slot_group_id AS "slotGroupId",COALESCE(p.display_name,p.name,sf.title) AS "className",
      COALESCE(top.display_name,top.name) AS "programName",p.is_trial_assessment AS "isTrialAssessment",
      (SELECT MIN(ts.start_time)::text FROM scheduling_time_slot ts WHERE ts.slot_group_id=d.slot_group_id
        AND (ts.specific_date=d.class_date OR (ts.specific_date IS NULL AND ts.day_of_week=EXTRACT(DOW FROM d.class_date)))) AS "startTime",
      (SELECT MAX(ts.end_time)::text FROM scheduling_time_slot ts WHERE ts.slot_group_id=d.slot_group_id
        AND (ts.specific_date=d.class_date OR (ts.specific_date IS NULL AND ts.day_of_week=EXTRACT(DOW FROM d.class_date)))) AS "endTime"
    FROM drop_in_registration d JOIN scheduling_form sf ON sf.id=d.form_id
    JOIN program p ON p.id=sf.program_id LEFT JOIN programs top ON top.id=COALESCE(sf.programs_id,p.programs_id)
    WHERE d.member_id=ANY($1::bigint[]) AND d.benefit_type='free_trial' AND p.facility_id=$2
    ORDER BY d.class_date,d.id`, [memberIds, result.facilityId])).rows.map(row => ({ ...row,
      id: Number(row.id), memberId: Number(row.memberId), slotGroupId: Number(row.slotGroupId), benefitType: 'free_trial', totalCents: 0 }))
}

async function findCompletedRegistrationLogin(db, invite, identifier) {
  const candidates = await findActiveMemberLoginCandidates(db, identifier)
  if (candidates.length !== 1) return null
  const [login] = candidates
  if (String(login.facility_id) !== String(invite.facility_id) || login.member_portal_access_active !== true) return null
  const member = await db.query(
    'SELECT id FROM member WHERE id=$1 AND app_user_id=$2 AND facility_id=$3 AND is_active=TRUE',
    [invite.pending_payload.result?.payerMemberId, login.id, invite.facility_id],
  )
  return member.rows.length === 1 ? login : null
}

export async function openLeadRegistration(db, inviteId, body) {
  const invite = await loadInvitation(db, inviteId, body.token)
  if (new Date(invite.expires_at) <= new Date() && !invite.used_at) throw inputError('This registration link has expired. Please ask Vortex to send a new invitation.', 410)
  const identifier = String(body.username ?? '').trim()
  const password = typeof body.password === 'string' ? body.password : ''
  let passwordHash = null
  if (invite.used_at) {
    const login = await findCompletedRegistrationLogin(db, invite, identifier)
    passwordHash = login?.password_hash
  } else if (identifier.toLowerCase() === invite.suggested_username.toLowerCase()) {
    passwordHash = invite.temporary_password_hash
  }
  if (!passwordHash || !await bcrypt.compare(password, passwordHash)) throw inputError('Incorrect login or password.', 401)
  const waivers = (await db.query(`SELECT id,name,version,body,waiver_type,is_required FROM waiver_template
    WHERE facility_id=$1 AND active_from<=now() AND (active_to IS NULL OR active_to>now()) ORDER BY id`,[invite.facility_id])).rows
  const result = invite.used_at ? await remainingEnrollments(db, invite.pending_payload.result) : undefined
  return { waivers, purpose: invitationPurpose(invite), facilityId: Number(invite.facility_id), session: jwt.sign({ purpose: 'lead_registration', inviteId: Number(invite.id) }, resolveJwtSecret(), { expiresIn: '2h' }), guardian: invite.pending_payload.guardian, children: invite.pending_payload.children, selections: invite.pending_payload.selections, username: invite.suggested_username, instructions: invite.pending_payload.instructions, expiresAt: invite.expires_at, completed: Boolean(invite.used_at), result }
}

async function resolveInvitationEnrollments(db, invite, enrollments, additionalMemberCount) {
  const { selections } = invite.pending_payload
  // Older clients omitted enrollments when the invitation already supplied every detail.
  if (enrollments == null) {
    enrollments = selections.map(selection => {
      if (selection.kind !== 'reserved' || selection.childIndex == null || !selection.enrollmentStartDate) {
        throw inputError('Complete the athlete, class time, and start date for each invitation selection.')
      }
      return { ...selection, memberIndex: selection.childIndex + 1 }
    })
  }
  if (!Array.isArray(enrollments) || enrollments.length > 40) {
    throw inputError('Choose at most 40 class selections.')
  }

  const resolved = []
  const seen = new Set()
  for (const [index, enrollment] of enrollments.entries()) {
    const label = `enrollment ${index + 1}`
    const memberIndex = Number(enrollment?.memberIndex)
    if (enrollment?.memberIndex == null || enrollment.memberIndex === '' ||
        !Number.isInteger(memberIndex) || memberIndex < 0 || memberIndex > additionalMemberCount) {
      throw inputError(`Select a family member for ${label}.`)
    }
    const classEventId = id(enrollment.classEventId, 'class')
    const programsId = id(enrollment.programsId, 'program')
    const schedulingFormId = id(enrollment.schedulingFormId, 'class schedule')
    const timeSlotId = id(enrollment.timeSlotId, 'class time')
    const slotGroupId = id(enrollment.slotGroupId, 'class time group')
    const startDate = normalizeEnrollmentStartDate(enrollment.enrollmentStartDate)
    if (!startDate) throw inputError(`Enter an enrollment start date for ${label}.`)
    const klass = await db.query(`SELECT 1 FROM scheduling_form sf JOIN program p ON p.id=sf.program_id
      JOIN programs pr ON pr.id=p.programs_id AND pr.facility_id=p.facility_id
      WHERE sf.id=$1 AND p.id=$2 AND p.programs_id=$3 AND p.facility_id=$4
      AND p.is_active=TRUE AND p.archived IS NOT TRUE AND pr.is_active=TRUE AND pr.archived IS NOT TRUE
      AND sf.is_active=TRUE AND sf.deleted_at IS NULL`, [schedulingFormId, classEventId, programsId, invite.facility_id])
    const slot = klass.rows.length && await loadClassTime(db, { formId: schedulingFormId, timeSlotId, startDate, selectedOfferingOnly: true })
    if (!slot || Number(slot.slot_group_id) !== slotGroupId) {
      throw inputError(`This class time is unavailable for the selected start date for ${label}.`)
    }
    const key = `${memberIndex}:${slotGroupId}`
    if (seen.has(key)) throw inputError('This family member already has that class time selected.')
    seen.add(key)
    resolved.push({
      memberIndex, programsId, classEventId, schedulingFormId, slotGroupId, timeSlotId, enrollmentStartDate: startDate,
      scheduleLabel: classTimeLabel(slot), selectedPricingOptionKey: enrollment.selectedPricingOptionKey,
    })
  }
  return resolved
}

export function matchReservedInvitationEnrollments(selections, enrollments) {
  const available = [...enrollments]
  const matches = selections.filter(selection => selection.kind === 'reserved')
    .map(selection => ({ selection, enrollment: null }))
  const sameClassTime = (selection, enrollment) => enrollment.classEventId === selection.classEventId
    && enrollment.schedulingFormId === selection.schedulingFormId && enrollment.slotGroupId === selection.slotGroupId
    && enrollment.timeSlotId === selection.timeSlotId
  // Keep each original athlete's hold first, then transfer unused holds to other
  // family members choosing that same class time. Every hold and choice is used once.
  for (const match of matches) {
    if (match.selection.childIndex == null) continue
    const index = available.findIndex(enrollment => sameClassTime(match.selection, enrollment)
      && enrollment.memberIndex === match.selection.childIndex + 1)
    if (index >= 0) match.enrollment = available.splice(index, 1)[0]
  }
  for (const match of matches) {
    if (match.enrollment) continue
    const index = available.findIndex(enrollment => sameClassTime(match.selection, enrollment))
    if (index >= 0) match.enrollment = available.splice(index, 1)[0]
  }
  return matches
}

export async function completeLeadRegistration(pool, inviteId, body, request = {}) {
  let claims
  try { claims=jwt.verify(String(body.session || ''), resolveJwtSecret()) } catch { throw inputError('Please sign in to your registration invitation again.', 401) }
  if (claims.purpose !== 'lead_registration' || claims.inviteId !== id(inviteId)) throw inputError('Invalid registration session.', 401)
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    // Lead conversion and invitation creation both lock the lead before the
    // invitation so they cannot attach two different accounts to one inquiry.
    const inviteReference = await loadInvitation(db, inviteId, body.token)
    const lead = (await db.query(`SELECT id, converted_member_id, member_id, trial_contact_member_id, archived FROM registrations
      WHERE id=$1 AND facility_id=$2 FOR UPDATE`, [inviteReference.registration_id, inviteReference.facility_id])).rows[0]
    const invite = await loadInvitation(db, inviteId, body.token, true)
    const primaryAdult = body.primaryAdult || {}
    if (invite.used_at) {
      const username = String(primaryAdult.username ?? '').trim()
      const password = primaryAdult.password
      const login = await findCompletedRegistrationLogin(db, invite, username)
      if (!login?.password_hash || username.toLowerCase() !== login.username?.trim().toLowerCase() ||
          typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72 ||
          !await bcrypt.compare(password, login.password_hash)) {
        throw inputError('This account is already set up. Sign in with your current Member Portal credentials.', 409)
      }
      const result = await remainingEnrollments(db, invite.pending_payload.result)
      await db.query('COMMIT')
      return result
    }
    if (!lead || lead.archived || lead.converted_member_id || lead.member_id || lead.trial_contact_member_id) {
      throw inputError('This lead already has an account or is no longer open. Contact Vortex to continue.', 409)
    }
    if (new Date(invite.expires_at) <= new Date()) throw inputError('This invitation has expired. Ask Vortex for a new invitation.', 410)
    if (normalizeSignupEmail(primaryAdult.email) !== String(invite.invitee_email).trim().toLowerCase()) throw inputError('Use the email address that received this invitation.')
    if (await bcrypt.compare(String(primaryAdult.password || ''), invite.temporary_password_hash)) throw inputError('Choose a new password, different from the temporary password.')
    const children = Array.isArray(body.additionalMembers) ? body.additionalMembers : []
    if (children.length < invite.pending_payload.children.length || children.length > 20) throw inputError('Complete the details for each child on the invitation.')
    const genders = new Set(['female', 'male', 'non-binary', 'prefer-not-to-say'])
    for (const [index, member] of [primaryAdult, ...children].entries()) {
      if (!String(member?.firstName || '').trim() || !String(member?.lastName || '').trim()) throw inputError('First and last name are required for every family member.')
      if (!genders.has(member?.gender)) throw inputError(`Gender is required for ${index === 0 ? 'the primary account holder' : member.firstName || 'each family member'}.`)
    }
    inquiryInput({ campers: children.map(child => ({ dateOfBirth: child?.dateOfBirth })) })
    const isTrial = invitationPurpose(invite) === 'trial'
    if (isTrial && body.enrollments != null && (!Array.isArray(body.enrollments) || body.enrollments.length)) {
      throw inputError('Choose free trial dates after completing your family information and waivers.')
    }
    const enrollments = isTrial ? [] : await resolveInvitationEnrollments(db, invite, body.enrollments, children.length)
    const signupDate = isTrial ? (await db.query(`SELECT (clock_timestamp() AT TIME ZONE
      COALESCE(NULLIF(timezone,''),'America/New_York'))::date::text AS date FROM facility WHERE id=$1`, [invite.facility_id])).rows[0]?.date : null
    const trialChildren = isTrial ? children.map((child, index) => ({ ...child, memberIndex: index + 1 }))
      .filter(child => { const age = trialAgeOnDate(child.dateOfBirth, signupDate); return age != null && age >= 0 && age < 18 }) : []
    if (isTrial && !trialChildren.length) throw inputError('Add a child under 18 to choose a free trial.')
    // Enrollment billing is owned exclusively by the existing authenticated checkout.
    const result = await processFamilySignup(db, { primaryAdult, additionalMembers: children, enrollments, waivers: body.waivers, familyName: `${primaryAdult.lastName} Family` }, { facilityId: invite.facility_id, leadInvitationId: invite.id, ipAddress: request.ip, userAgent: request.userAgent })
    // Preserve only holds still selected by the family. Match the actual schedule,
    // not array position: removing/reordering a suggestion must not attach another hold.
    for (const { selection, enrollment } of matchReservedInvitationEnrollments(invite.pending_payload.selections, enrollments)) {
      if (!enrollment) {
        await db.query(`UPDATE scheduling_signup SET status='cancelled',reserved_until=NULL
          WHERE account_invite_id=$1 AND slot_group_id=$2 AND status='pending_setup'
          AND (CASE WHEN $3::bigint IS NOT NULL THEN id=$3 ELSE invite_child_index IS NOT DISTINCT FROM $4::integer END)`,
        [invite.id, selection.slotGroupId, selection.holdSignupId ?? null, selection.childIndex])
        continue
      }
      const participant = enrollment.memberIndex === 0 ? primaryAdult : children[enrollment.memberIndex - 1]
      const linkedHold = await db.query(`UPDATE scheduling_signup SET member_id=$3,first_name=$4,last_name=$5,enrollment_start_date=$6
        WHERE account_invite_id=$1 AND slot_group_id=$2 AND status='pending_setup'
        AND (CASE WHEN $7::bigint IS NOT NULL THEN id=$7 ELSE invite_child_index IS NOT DISTINCT FROM $8::integer END)`,
      [invite.id, selection.slotGroupId, result.memberIds[enrollment.memberIndex], participant.firstName, participant.lastName,
        enrollment.enrollmentStartDate, selection.holdSignupId ?? null, selection.childIndex])
      if (linkedHold.rowCount !== 1) throw inputError('A reserved class could not be linked to its athlete. Contact Vortex to update the invitation.', 409)
    }
    const completed = { ...result, enrollmentsPrepared: true, ...(isTrial ? { purpose: 'trial', trialRegistration: true,
      facilityId: Number(invite.facility_id), trialChildren: trialChildren.map(child => ({ memberIndex: child.memberIndex,
        memberId: Number(result.memberIds[child.memberIndex]), firstName: child.firstName, lastName: child.lastName, dateOfBirth: child.dateOfBirth })), trialBookings: [] } : {}) }
    const savedChildren = children.map((child, index) => ({ firstName: child.firstName, lastName: child.lastName,
      dateOfBirth: child.dateOfBirth, gender: child.gender, memberId: Number(result.memberIds[index + 1]) }))
    await db.query("UPDATE account_invite SET used_at=now(),temporary_password_hash=NULL,pending_payload=(pending_payload-'passwordCiphertext')||jsonb_build_object('result',$2::jsonb,'children',$3::jsonb) WHERE id=$1", [invite.id, JSON.stringify(completed), JSON.stringify(savedChildren)])
    if (isTrial) {
      await db.query(`UPDATE registrations SET trial_contact_member_id=$2,
        member_id=CASE WHEN inquiry_source='free_trial' THEN $2 ELSE member_id END,campers=$3::jsonb,
        lead_status='qualified',contacted=TRUE,first_contacted_at=COALESCE(first_contacted_at,now()),updated_at=now()
        WHERE id=$1 AND facility_id=$4`, [invite.registration_id, result.payerMemberId, JSON.stringify(savedChildren), invite.facility_id])
    } else {
      await db.query(`UPDATE registrations SET converted_member_id=$2,converted_at=now(),converted_by_user_id=$3,
        lead_status='converted',contacted=TRUE,first_contacted_at=COALESCE(first_contacted_at,now()),updated_at=now()
        WHERE id=$1 AND facility_id=$4`, [invite.registration_id, result.payerMemberId, invite.created_by_user_id, invite.facility_id])
    }
    await db.query('COMMIT')
    return completed
  } catch (error) { await db.query('ROLLBACK'); if (!error.statusCode) error.statusCode=400; throw error } finally { db.release() }
}

/** Invitation credentials authorize only the family just created by this completed trial invitation. */
export async function bookLeadInvitationTrial(pool, inviteId, body) {
  let claims
  try { claims = jwt.verify(String(body.session || ''), resolveJwtSecret()) } catch { throw inputError('Please sign in to your trial invitation again.', 401) }
  if (claims.purpose !== 'lead_registration' || claims.inviteId !== id(inviteId)) throw inputError('Invalid registration session.', 401)
  const selection = validateTrialSelection(body.freeTrial, { requireMemberIndex: true })
  const db = await pool.connect()
  try {
    await db.query('BEGIN')
    const reference = await loadInvitation(db, inviteId, body.token)
    const lead = (await db.query('SELECT id,archived FROM registrations WHERE id=$1 AND facility_id=$2 FOR UPDATE',
      [reference.registration_id, reference.facility_id])).rows[0]
    const invite = await loadInvitation(db, inviteId, body.token, true)
    if (!lead || lead.archived) throw inputError('This trial invitation is no longer available. Contact Vortex to continue.', 409)
    const result = invite.pending_payload.result
    if (invitationPurpose(invite) !== 'trial' || !invite.used_at || !result?.trialRegistration) {
      throw inputError('Complete your family information and sign the waivers before choosing a free trial.', 409)
    }
    const child = result.trialChildren?.find(item => Number(item.memberIndex) === selection.memberIndex)
    if (!child || Number(result.memberIds?.[selection.memberIndex]) !== Number(child.memberId)) {
      throw inputError('Choose a child from this trial invitation.', 403)
    }
    const authorized = await resolveSignupWaiverTargetMemberIds(db, { facilityId: invite.facility_id,
      signerMemberId: result.payerMemberId, candidateMemberIds: [child.memberId] })
    if (!authorized.includes(Number(child.memberId))) throw inputError('Only this child’s authorized parent or guardian may book their free trial.', 403)
    const payer = (await db.query(`SELECT parent.email,parent.phone FROM member parent
      JOIN member child ON child.family_id=parent.family_id AND child.facility_id=parent.facility_id
      WHERE parent.id=$1 AND child.id=$2 AND parent.facility_id=$3 AND parent.is_active=TRUE AND child.is_active=TRUE`,
      [result.payerMemberId, child.memberId, invite.facility_id])).rows[0]
    if (!payer) throw inputError('This athlete is no longer available in this family.', 403)
    const booking = await bookMemberFreeTrial(db, selection, { memberId: child.memberId, facilityId: invite.facility_id,
      contactEmail: payer.email || invite.invitee_email, contactPhone: payer.phone || null })
    const bookings = await loadInvitationTrialBookings(db, result)
    await db.query("UPDATE account_invite SET pending_payload=jsonb_set(pending_payload,'{result,trialBookings}',$2::jsonb) WHERE id=$1",
      [invite.id, JSON.stringify(bookings)])
    await db.query('COMMIT')
    return { ...booking, ...bookings.find(item => item.id === booking.id), trialBookings: bookings }
  } catch (error) { await db.query('ROLLBACK'); throw error } finally { db.release() }
}

export async function leadRegistrationCatalog(db, facilityId) {
  const rows = await db.query(`SELECT pr.id AS programs_id,COALESCE(pr.display_name,pr.name) AS program_name,p.id AS class_id,COALESCE(p.display_name,p.name) AS class_name,
    sf.id AS form_id,sg.id AS group_id,sg.max_participants,ts.id AS slot_id,ts.day_of_week,ts.specific_date::text,ts.start_time,ts.end_time,
    (SELECT COUNT(*)::int FROM scheduling_signup s WHERE s.slot_group_id=sg.id AND s.status='confirmed')+pending_registration_holds(sg.id) AS occupied
    FROM programs pr LEFT JOIN program p ON p.programs_id=pr.id AND p.facility_id=pr.facility_id AND p.is_active=TRUE AND p.archived IS NOT TRUE
    LEFT JOIN scheduling_form sf ON sf.program_id=p.id AND sf.is_active=TRUE AND sf.deleted_at IS NULL
    LEFT JOIN scheduling_slot_group sg ON sg.form_id=sf.id AND sg.is_active=TRUE
      AND (sg.offering_id IS NULL OR EXISTS(SELECT 1 FROM scheduling_offering o WHERE o.id=sg.offering_id AND o.is_selected=TRUE))
      AND COALESCE((SELECT o.end_date FROM scheduling_offering o WHERE o.id=sg.offering_id),sg.active_end,sf.end_date,'infinity'::date)>=CURRENT_DATE
    LEFT JOIN scheduling_time_slot ts ON ts.form_id=sf.id AND ts.slot_group_id=sg.id AND ts.is_active=TRUE
    WHERE pr.facility_id=$1 AND pr.is_active=TRUE AND pr.archived IS NOT TRUE
    ORDER BY program_name,class_name,sf.id DESC,ts.day_of_week,ts.start_time`, [facilityId])
  return rows.rows
}
