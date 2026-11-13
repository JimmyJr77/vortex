import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { resolveJwtSecret } from '../auth/jwtSecret.js'
import { findActiveMemberLoginCandidates, normalizeSignupEmail } from '../auth/memberLoginIdentifiers.js'
import { encryptAccountInviteToken, decryptAccountInviteToken } from '../email/accountInviteTokens.js'
import { sendLeadRegistrationEmail } from '../email/leadRegistrationEmail.js'
import { generateTemporaryPassword } from '../scheduling/tempPasswordEmail.js'
import { processFamilySignup } from '../platform/familySignup.js'
import { normalizeEnrollmentStartDate } from '../scheduling/enrollmentStartDate.js'
import { inquiryInput } from './leadInquiry.js'
import { id, inputError } from './common.js'

const digest = value => crypto.createHash('sha256').update(String(value)).digest('hex')
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
    const email = normalizeSignupEmail(lead.email)
    if (!email) throw inputError('Update the lead with a valid email address before sending the invitation.')
    const emailConflict = await client.query('SELECT id FROM app_user WHERE LOWER(BTRIM(email))=$1 OR LOWER(BTRIM(username))=$1 UNION ALL SELECT id FROM member WHERE LOWER(BTRIM(email))=$1 LIMIT 1', [email])
    if (emailConflict.rows.length) throw inputError('This email already has an account. Link the verified existing member instead of creating another login.', 409)
    const children = inquiryInput({ campers: body.children || lead.campers || [] }).campers
    const selections = await validateLeadSelections(client, facilityId, children, body.selections || [])
    const holdDays = Number(body.holdDays ?? 7)
    if (!Number.isInteger(holdDays) || holdDays < 1 || holdDays > 30) throw inputError('Choose a registration deadline from 1 to 30 days.')
    const instructions = String(body.instructions || '').trim()
    if (instructions.length > 4000) throw inputError('Instructions must be at most 4,000 characters.')
    const username = await nextLeadUsername(client, lead.first_name, lead.last_name)
    const password = generateTemporaryPassword(16), token = crypto.randomBytes(32).toString('hex')
    const payload = { guardian: { firstName: lead.first_name, lastName: lead.last_name, email, phone: lead.phone || '' }, children, selections, instructions, passwordCiphertext: encryptAccountInviteToken(password) }
    invite = (await client.query(`INSERT INTO account_invite(facility_id,registration_id,invite_type,token_hash,token_ciphertext,invitee_email,pending_payload,expires_at,suggested_username,temporary_password_hash,request_key,created_by_user_id)
      VALUES($1,$2,'lead_registration',$3,$4,$5,$6::jsonb,now()+($7::int*interval '1 day'),$8,$9,$10,$11) RETURNING *`, [facilityId, lead.id, digest(token), encryptAccountInviteToken(token), email, JSON.stringify(payload), holdDays, username, await bcrypt.hash(password, 10), String(body.requestKey || crypto.randomUUID()), userId])).rows[0]
    // Stable lock ordering prevents deadlocks for multi-child, multi-class invitations.
    const groups = [...new Set(selections.filter(item => item.kind === 'reserved').map(item => item.slotGroupId))].sort((a,b) => a-b)
    if (groups.length) await client.query('SELECT id FROM scheduling_slot_group WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE', [groups])
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

async function remainingEnrollments(db, result) {
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
  return { waivers, session: jwt.sign({ purpose: 'lead_registration', inviteId: Number(invite.id) }, resolveJwtSecret(), { expiresIn: '2h' }), guardian: invite.pending_payload.guardian, children: invite.pending_payload.children, selections: invite.pending_payload.selections, username: invite.suggested_username, instructions: invite.pending_payload.instructions, expiresAt: invite.expires_at, completed: Boolean(invite.used_at), result }
}

async function resolveInvitationEnrollments(db, invite, enrollments, additionalMemberCount) {
  const { selections } = invite.pending_payload
  // Older clients omitted enrollments when the invitation already supplied every detail.
  if (enrollments == null || (Array.isArray(enrollments) && enrollments.length === 0)) {
    enrollments = selections.map(selection => {
      if (selection.kind !== 'reserved' || selection.childIndex == null || !selection.enrollmentStartDate) {
        throw inputError('Complete the athlete, class time, and start date for each invitation selection.')
      }
      return { ...selection, memberIndex: selection.childIndex + 1 }
    })
  }
  if (!Array.isArray(enrollments) || enrollments.length !== selections.length) {
    throw inputError('Complete every class selection on the invitation.')
  }

  const resolved = []
  const seen = new Set()
  for (const [index, selection] of selections.entries()) {
    const enrollment = enrollments[index]
    const memberIndex = Number(enrollment?.memberIndex)
    if (enrollment?.memberIndex == null || enrollment.memberIndex === '' ||
        !Number.isInteger(memberIndex) || memberIndex < 0 || memberIndex > additionalMemberCount ||
        (selection.childIndex != null && memberIndex !== selection.childIndex + 1)) {
      throw inputError(`Select a family member for ${selection.label}.`)
    }
    const classEventId = id(enrollment.classEventId, 'class')
    const schedulingFormId = id(enrollment.schedulingFormId, 'class schedule')
    const timeSlotId = id(enrollment.timeSlotId, 'class time')
    const slotGroupId = id(enrollment.slotGroupId, 'class time group')
    if ((selection.classEventId && classEventId !== selection.classEventId) ||
        (selection.kind === 'reserved' && (
          schedulingFormId !== selection.schedulingFormId ||
          timeSlotId !== selection.timeSlotId ||
          slotGroupId !== selection.slotGroupId
        ))) {
      throw inputError(`Use the class or time selected on the invitation for ${selection.label}.`)
    }
    const startDate = normalizeEnrollmentStartDate(enrollment.enrollmentStartDate)
    if (!startDate) throw inputError(`Enter an enrollment start date for ${selection.label}.`)
    const klass = await db.query(`SELECT 1 FROM scheduling_form sf JOIN program p ON p.id=sf.program_id
      JOIN programs pr ON pr.id=p.programs_id AND pr.facility_id=p.facility_id
      WHERE sf.id=$1 AND p.id=$2 AND p.programs_id=$3 AND p.facility_id=$4
      AND p.is_active=TRUE AND p.archived IS NOT TRUE AND pr.is_active=TRUE AND pr.archived IS NOT TRUE
      AND sf.is_active=TRUE AND sf.deleted_at IS NULL`, [schedulingFormId, classEventId, selection.programsId, invite.facility_id])
    const slot = klass.rows.length && await loadClassTime(db, { formId: schedulingFormId, timeSlotId, startDate })
    if (!slot || Number(slot.slot_group_id) !== slotGroupId) {
      throw inputError(`This class time is unavailable for the selected start date for ${selection.label}.`)
    }
    const key = `${memberIndex}:${slotGroupId}`
    if (seen.has(key)) throw inputError('This family member already has that class time selected.')
    seen.add(key)
    resolved.push({
      memberIndex, classEventId, schedulingFormId, slotGroupId, timeSlotId, enrollmentStartDate: startDate,
      scheduleLabel: classTimeLabel(slot), selectedPricingOptionKey: enrollment.selectedPricingOptionKey,
    })
  }
  return resolved
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
    const lead = (await db.query(`SELECT id, converted_member_id, member_id, archived FROM registrations
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
    if (!lead || lead.archived || lead.converted_member_id || lead.member_id) {
      throw inputError('This lead already has an account or is no longer open. Contact Vortex to continue.', 409)
    }
    if (new Date(invite.expires_at) <= new Date()) throw inputError('This invitation has expired. Ask Vortex for a new invitation.', 410)
    if (normalizeSignupEmail(primaryAdult.email) !== String(invite.invitee_email).trim().toLowerCase()) throw inputError('Use the email address that received this invitation.')
    if (await bcrypt.compare(String(primaryAdult.password || ''), invite.temporary_password_hash)) throw inputError('Choose a new password, different from the temporary password.')
    const children = Array.isArray(body.additionalMembers) ? body.additionalMembers : []
    if (children.length < invite.pending_payload.children.length || children.length > 20) throw inputError('Complete the details for each child on the invitation.')
    inquiryInput({ campers: children.map(child => ({ dateOfBirth: child?.dateOfBirth })) })
    const enrollments = await resolveInvitationEnrollments(db, invite, body.enrollments, children.length)
    // Enrollment billing is owned exclusively by the existing authenticated checkout.
    const result = await processFamilySignup(db, { primaryAdult, additionalMembers: children, enrollments, waivers: body.waivers, familyName: `${primaryAdult.lastName} Family` }, { facilityId: invite.facility_id, leadInvitationId: invite.id, ipAddress: request.ip, userAgent: request.userAgent })
    for (const [index, selection] of invite.pending_payload.selections.entries()) {
      if (selection.kind !== 'reserved') continue
      const enrollment = enrollments[index]
      const participant = enrollment.memberIndex === 0 ? primaryAdult : children[enrollment.memberIndex - 1]
      const linkedHold = await db.query(`UPDATE scheduling_signup SET member_id=$3,first_name=$4,last_name=$5,enrollment_start_date=$6
        WHERE account_invite_id=$1 AND slot_group_id=$2 AND status='pending_setup'
        AND (CASE WHEN $7::bigint IS NOT NULL THEN id=$7 ELSE invite_child_index=$8 END)`,
      [invite.id, selection.slotGroupId, result.memberIds[enrollment.memberIndex], participant.firstName, participant.lastName,
        enrollment.enrollmentStartDate, selection.holdSignupId ?? null, selection.childIndex])
      if (linkedHold.rowCount !== 1) throw inputError('A reserved class could not be linked to its athlete. Contact Vortex to update the invitation.', 409)
    }
    const completed = { ...result, enrollmentsPrepared: true }
    await db.query("UPDATE account_invite SET used_at=now(),temporary_password_hash=NULL,pending_payload=(pending_payload-'passwordCiphertext')||jsonb_build_object('result',$2::jsonb) WHERE id=$1", [invite.id, JSON.stringify(completed)])
    await db.query(`UPDATE registrations SET converted_member_id=$2,converted_at=now(),converted_by_user_id=$3,
      lead_status='converted',contacted=TRUE,first_contacted_at=COALESCE(first_contacted_at,now()),updated_at=now()
      WHERE id=$1 AND facility_id=$4`, [invite.registration_id, result.payerMemberId, invite.created_by_user_id, invite.facility_id])
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
      AND (sg.offering_id IS NULL OR EXISTS(SELECT 1 FROM scheduling_offering o WHERE o.id=sg.offering_id AND o.is_selected=TRUE))
      AND COALESCE((SELECT o.end_date FROM scheduling_offering o WHERE o.id=sg.offering_id),sg.active_end,sf.end_date,'infinity'::date)>=CURRENT_DATE
    LEFT JOIN scheduling_time_slot ts ON ts.form_id=sf.id AND ts.slot_group_id=sg.id AND ts.is_active=TRUE
    WHERE pr.facility_id=$1 AND pr.is_active=TRUE AND pr.archived IS NOT TRUE
    ORDER BY program_name,class_name,sf.id DESC,ts.day_of_week,ts.start_time`, [facilityId])
  return rows.rows
}
