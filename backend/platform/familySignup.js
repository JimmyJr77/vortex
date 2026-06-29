import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sendAccountInviteEmail, sendInviteSignupCompleteEmail } from '../email/accountInviteEmail.js'
import {
  createAccountInviteTokenRecord,
  buildAccountInviteUrl,
  findAccountInviteByToken,
} from '../email/accountInviteTokens.js'
import { issueEmailVerification } from '../email/emailVerificationService.js'
import {
  notifyWelcomeNewMembers,
  notifyEnrollmentReceipt,
  notifyFamilyGuardiansNewMember,
} from '../email/memberNotifications.js'
import { countActiveFamilyMembers } from '../email/memberContact.js'
import { verifyEnrollmentReceiptToken } from '../email/enrollmentReceiptService.js'
import { linkMemberToSchoolFromName } from '../schools/handlers.js'
import { ensureSignupSchema } from './ensureSignupSchema.js'
import { seedCanonicalWaivers } from './seedCanonicalWaivers.js'
import { resolveProgramsSchema } from '../programs/schema.js'

function isAdult(dateOfBirth) {
  if (!dateOfBirth) return true
  const birthDate = new Date(dateOfBirth)
  if (Number.isNaN(birthDate.getTime())) return true
  const today = new Date()
  const age = today.getFullYear() - birthDate.getFullYear()
    - (today.getMonth() < birthDate.getMonth()
      || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0)
  return age >= 18
}

function memberUsesParentContactEmail(memberInput, payerEmail) {
  const emailSource = String(memberInput.emailSource || memberInput.email_source || '').toLowerCase()
  if (emailSource === 'parent') return true
  if (emailSource === 'youth') return false

  const dob = memberInput.dateOfBirth || memberInput.date_of_birth
  const minor = dob && !isAdult(dob)
  if (!minor) return false

  const email = String(memberInput.email || '').trim().toLowerCase()
  const payer = String(payerEmail || '').trim().toLowerCase()
  return Boolean(email && payer && email === payer)
}

function resolveStoredMemberEmail(memberInput, payerEmail) {
  if (memberUsesParentContactEmail(memberInput, payerEmail)) {
    return null
  }
  const email = String(memberInput.email || '').trim()
  return email || null
}

function formatSignupError(error) {
  if (error?.code === '23505') {
    const constraint = String(error.constraint || '')
    if (constraint.includes('email')) {
      return new Error('An account with this email already exists. Please sign in or use a different email.')
    }
    if (constraint.includes('username')) {
      return new Error('That username is already taken. Please choose another.')
    }
  }
  return error
}

async function assertMemberEmailAvailable(client, facilityId, email) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return
  const existing = await client.query(
    `
      SELECT id FROM member
      WHERE facility_id = $1
        AND email IS NOT NULL
        AND LOWER(TRIM(email)) = $2
      LIMIT 1
    `,
    [facilityId, normalized],
  )
  if (existing.rows.length > 0) {
    throw new Error('An account with this email already exists. Please sign in or use a different email.')
  }
}

async function generateFamilyUsername(client, familyName, facilityId) {
  const baseUsername = String(familyName || 'family')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20) || 'family'
  let username = baseUsername
  let counter = 1
  while (counter < 1000) {
    const result = await client.query(
      `SELECT id FROM family WHERE family_username = $1 AND facility_id = $2`,
      [username, facilityId],
    )
    if (result.rows.length === 0) return username
    username = `${baseUsername}${counter}`
    counter += 1
  }
  return `${baseUsername}${Date.now()}`
}

async function resolveFacilityId(client, explicitFacilityId = null) {
  if (explicitFacilityId) return Number(explicitFacilityId)
  const facility = await client.query(`SELECT id FROM facility ORDER BY id LIMIT 1`)
  if (facility.rows.length === 0) {
    const created = await client.query(
      `INSERT INTO facility (name, timezone) VALUES ('Vortex Athletics', 'America/New_York') RETURNING id`,
    )
    return Number(created.rows[0].id)
  }
  return Number(facility.rows[0].id)
}

async function activeRequiredWaiverTemplateIds(client, facilityId) {
  const res = await client.query(
    `
      SELECT id
      FROM waiver_template
      WHERE facility_id = $1
        AND active_from <= now()
        AND (active_to IS NULL OR active_to > now())
        AND is_required = TRUE
      ORDER BY id
    `,
    [facilityId],
  )
  return res.rows.map((row) => Number(row.id))
}

async function applyYouthAthleteFields(client, memberId, memberInput) {
  const school = String(memberInput.currentSchool || memberInput.current_school || '').trim()
  if (school) {
    await linkMemberToSchoolFromName(client, memberId, school, 'family_signup')
  }
  const gradRaw = memberInput.graduationYear ?? memberInput.graduation_year
  const graduationYear = gradRaw != null && String(gradRaw).trim() !== '' ? Number(gradRaw) : null
  if (Number.isFinite(graduationYear)) {
    await client.query(
      `UPDATE member SET graduation_year = $2, updated_at = now() WHERE id = $1`,
      [memberId, graduationYear],
    )
  }
}

async function syncMemberWaiverFlag(client, memberId) {
  const member = await client.query(`SELECT facility_id FROM member WHERE id = $1`, [memberId])
  if (member.rows.length === 0) return
  const requiredIds = await activeRequiredWaiverTemplateIds(client, member.rows[0].facility_id)
  if (requiredIds.length === 0) return
  const accepted = await client.query(
    `
      SELECT COUNT(DISTINCT waiver_template_id)::int as count
      FROM member_waiver_acceptance
      WHERE member_id = $1 AND waiver_template_id = ANY($2::bigint[])
    `,
    [memberId, requiredIds],
  )
  const complete = Number(accepted.rows[0]?.count ?? 0) >= requiredIds.length
  await client.query(
    `
      UPDATE member
      SET has_completed_waivers = $2,
          waiver_completion_date = CASE WHEN $2 THEN COALESCE(waiver_completion_date, now()) ELSE waiver_completion_date END,
          updated_at = now()
      WHERE id = $1
    `,
    [memberId, complete],
  )
}

async function recordWaiverAcceptances(client, {
  memberIds,
  acceptedTemplateIds,
  signerMemberId,
  signatureName,
  comments,
  paymentPolicyAcknowledged,
  ipAddress,
  userAgent,
}) {
  const templatesRes = await client.query(
    `SELECT id, waiver_type FROM waiver_template WHERE id = ANY($1::bigint[])`,
    [acceptedTemplateIds],
  )
  for (const memberId of memberIds) {
    for (const templateId of acceptedTemplateIds) {
      const isPayment = templatesRes.rows.some(
        (row) => Number(row.id) === templateId && row.waiver_type === 'PAYMENT_POLICY',
      )
      await client.query(
        `
          INSERT INTO member_waiver_acceptance (
            member_id, waiver_template_id, accepted_by_member_id,
            signature_name, ip_address, user_agent, comments, payment_policy_acknowledged
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (member_id, waiver_template_id) DO UPDATE SET
            accepted_by_member_id = EXCLUDED.accepted_by_member_id,
            accepted_at = now(),
            signature_name = EXCLUDED.signature_name,
            ip_address = EXCLUDED.ip_address,
            user_agent = EXCLUDED.user_agent,
            comments = EXCLUDED.comments,
            payment_policy_acknowledged = EXCLUDED.payment_policy_acknowledged
        `,
        [
          memberId,
          templateId,
          signerMemberId,
          signatureName,
          ipAddress,
          userAgent,
          comments,
          isPayment ? paymentPolicyAcknowledged : false,
        ],
      )
    }
    await syncMemberWaiverFlag(client, memberId)
  }
}

function selectedDaysJsonb(selectedDays) {
  const days = Array.isArray(selectedDays) ? selectedDays : []
  return JSON.stringify(days)
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatTimeOnly(value) {
  if (!value) return ''
  const s = String(value)
  return s.length >= 5 ? s.slice(0, 5) : s
}

function formatDateOnly(value) {
  if (!value) return null
  return String(value).slice(0, 10)
}

function formatSignupUsDate(value) {
  const iso = formatDateOnly(value)
  if (!iso) return null
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return `${month}/${day}/${year}`
}

function formatSignupDateRange(start, end) {
  const startLabel = formatSignupUsDate(start)
  const endLabel = formatSignupUsDate(end)
  if (startLabel && endLabel) return `${startLabel}-${endLabel}`
  return startLabel || endLabel || null
}

function buildSlotScheduleLabel(row) {
  const parts = []
  if (row.week_letter) parts.push(`${row.week_letter}-Week`)
  if (row.schedule_mode === 'date' && row.specific_date) {
    parts.push(formatDateOnly(row.specific_date))
  } else if (row.day_of_week != null) {
    parts.push(DAY_NAMES[row.day_of_week] || row.day_name || 'Day')
  }
  const st = formatTimeOnly(row.start_time)
  const et = formatTimeOnly(row.end_time)
  if (st && et) parts.push(`${st}–${et}`)
  return parts.join(' · ')
}

function buildCompactScheduleLabel(occurrenceRows) {
  if (!occurrenceRows?.length) return ''
  if (occurrenceRows.length === 1) return buildSlotScheduleLabel(occurrenceRows[0])

  const dayLabels = occurrenceRows.map((row) => {
    if (row.schedule_mode === 'date' && row.specific_date) {
      return formatSignupUsDate(row.specific_date)
    }
    if (row.day_of_week != null) {
      const name = DAY_NAMES[row.day_of_week] || row.day_name || 'Day'
      return name.length > 3 ? name.slice(0, 3) : name
    }
    return row.day_name?.slice(0, 3) || 'Day'
  })
  const startTime = formatTimeOnly(occurrenceRows[0].start_time)
  const endTime = formatTimeOnly(occurrenceRows[0].end_time)
  const sameTime = occurrenceRows.every(
    (row) =>
      formatTimeOnly(row.start_time) === startTime && formatTimeOnly(row.end_time) === endTime,
  )
  const daysPart = dayLabels.join(', ')
  if (sameTime && startTime && endTime) return `${daysPart} · ${startTime}–${endTime}`
  return daysPart
}

function buildGroupScheduleLabel(occurrenceRows) {
  if (!occurrenceRows?.length) return ''
  return occurrenceRows.map((row) => buildSlotScheduleLabel(row)).join('; ')
}

function formatSignupPriceLabel(cents, costUnit) {
  const amount = Number(cents)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const dollars = amount / 100
  const formatted = dollars % 1 === 0 ? String(dollars) : dollars.toFixed(2)
  const unitSuffix =
    costUnit === 'per_month'
      ? '/mo'
      : costUnit === 'per_week'
        ? '/wk'
        : costUnit === 'per_class'
          ? '/class'
          : costUnit === 'per_offering'
            ? '/offering'
            : ''
  return `$${formatted}${unitSuffix}`
}

/** Class (program row) has an active scheduling form with at least one signup slot group + time slot. */
function sqlClassHasSignupSlots(programAlias) {
  return `
    EXISTS (
      SELECT 1
      FROM scheduling_form sf
      INNER JOIN scheduling_slot_group sg ON sg.form_id = sf.id AND sg.is_active = TRUE
      INNER JOIN scheduling_time_slot ts
        ON ts.form_id = sf.id
        AND ts.slot_group_id = sg.id
        AND ts.is_active = TRUE
      WHERE sf.program_id = ${programAlias}.id
        AND sf.deleted_at IS NULL
        AND sf.is_active = TRUE
    )
  `
}

async function loadClassEnrollmentCatalog(pool, classEventId) {
  const formRes = await pool.query(
    `
      SELECT id, slot_cost_monthly_cents, cost_unit, start_date, end_date
      FROM scheduling_form
      WHERE program_id = $1 AND deleted_at IS NULL AND is_active = TRUE
      ORDER BY id
      LIMIT 1
    `,
    [classEventId],
  )
  if (formRes.rows.length === 0) {
    return { formId: null, offerings: [], scheduleOptions: [], classActiveDates: null }
  }
  const form = formRes.rows[0]
  const formId = Number(form.id)
  const priceCents = Number(form.slot_cost_monthly_cents ?? 0)
  const costUnit = form.cost_unit || 'per_month'
  const priceLabel = formatSignupPriceLabel(priceCents, costUnit)

  const offeringsRes = await pool.query(
    `SELECT id, label, start_date, end_date FROM scheduling_offering WHERE form_id = $1 ORDER BY start_date DESC, id DESC`,
    [formId],
  )
  const offerings = offeringsRes.rows.map((row) => ({
    id: Number(row.id),
    label: row.label,
    startDate: row.start_date,
    endDate: row.end_date,
  }))

  let classActiveDates = formatSignupDateRange(form.start_date, form.end_date)
  if (!classActiveDates && offerings.length > 0) {
    const starts = offerings.map((o) => formatDateOnly(o.startDate)).filter(Boolean)
    const ends = offerings.map((o) => formatDateOnly(o.endDate)).filter(Boolean)
    if (starts.length && ends.length) {
      classActiveDates = formatSignupDateRange(
        starts.sort()[0],
        ends.sort().reverse()[0],
      )
    } else if (starts.length) {
      classActiveDates = formatSignupDateRange(starts.sort()[0], null)
    }
  }

  const groupsRes = await pool.query(
    `
      SELECT id, offering_id
      FROM scheduling_slot_group
      WHERE form_id = $1 AND is_active = TRUE
      ORDER BY offering_id NULLS LAST, id
    `,
    [formId],
  )
  const slotsRes = await pool.query(
    `
      SELECT *
      FROM scheduling_time_slot
      WHERE form_id = $1 AND is_active = TRUE
      ORDER BY slot_group_id, week_letter NULLS LAST, day_of_week NULLS LAST,
        specific_date NULLS LAST, start_time, id
    `,
    [formId],
  )
  const slotsByGroup = new Map()
  for (const row of slotsRes.rows) {
    const gid = row.slot_group_id
    if (gid == null) continue
    if (!slotsByGroup.has(gid)) slotsByGroup.set(gid, [])
    slotsByGroup.get(gid).push(row)
  }

  const offeringLabelById = new Map(
    offerings.map((o) => [o.id, o.label || `Offering ${o.id}`]),
  )

  const scheduleOptions = []
  for (const group of groupsRes.rows) {
    const occurrences = slotsByGroup.get(group.id) || []
    if (occurrences.length === 0) continue
    const firstSlot = occurrences[0]
    const offeringId = group.offering_id != null ? Number(group.offering_id) : null
    const offering = offerings.find((o) => o.id === offeringId)
    scheduleOptions.push({
      slotGroupId: Number(group.id),
      timeSlotId: Number(firstSlot.id),
      offeringId,
      offeringLabel: offeringId != null ? offeringLabelById.get(offeringId) ?? null : null,
      offeringDates: offering
        ? formatSignupDateRange(offering.startDate, offering.endDate)
        : null,
      scheduleLabel: buildCompactScheduleLabel(occurrences),
      priceCents: priceCents > 0 ? priceCents : null,
      priceLabel,
    })
  }

  return { formId, offerings, scheduleOptions, priceLabel, costUnit, classActiveDates }
}

async function enrichInviteEnrollments(pool, enrollments) {
  if (!Array.isArray(enrollments) || enrollments.length === 0) return []
  const schema = await resolveProgramsSchema(pool)
  const out = []
  for (const raw of enrollments) {
    const e = { ...raw }
    const classEventId = Number(e.classEventId ?? e.programId)
    if (!e.programsId && Number.isFinite(classEventId)) {
      const progRes = await pool.query(
        `SELECT ${schema.programFkColumn} AS programs_id FROM program WHERE id = $1`,
        [classEventId],
      )
      if (progRes.rows[0]?.programs_id != null) {
        e.programsId = Number(progRes.rows[0].programs_id)
      }
    }
    out.push(e)
  }
  return out
}

async function applyEnrollmentRow(client, {
  memberId,
  memberRow,
  primaryAdultEmail,
  enrollment,
  programKeysCreated,
}) {
  const classEventId = Number(enrollment.classEventId ?? enrollment.programId)
  if (!Number.isFinite(memberId) || !Number.isFinite(classEventId)) return null

  const progRes = await client.query(
    `SELECT COALESCE(display_name, name) AS label FROM program WHERE id = $1`,
    [classEventId],
  )
  const programName = enrollment.programName || progRes.rows[0]?.label || 'Class'

  const programKey = `${memberId}:${classEventId}`
  let memberProgramId = null
  if (!programKeysCreated.has(programKey)) {
    const mpInsert = await client.query(
      `
        INSERT INTO member_program (member_id, program_id, days_per_week, selected_days, created_at, updated_at)
        VALUES ($1, $2, COALESCE($3, 1), $4::jsonb, now(), now())
        RETURNING id
      `,
      [
        memberId,
        classEventId,
        enrollment.daysPerWeek ?? 1,
        selectedDaysJsonb(enrollment.selectedDays),
      ],
    )
    memberProgramId = Number(mpInsert.rows[0]?.id)
    programKeysCreated.add(programKey)
  }

  let schedulingSignupId = null
  const schedulingFormId = Number(enrollment.schedulingFormId)
  const slotGroupId = Number(enrollment.slotGroupId)
  if (Number.isFinite(schedulingFormId) && Number.isFinite(slotGroupId)) {
    const timeSlotId = Number(enrollment.timeSlotId)
    const offeringIds = enrollment.offeringId != null
      ? [Number(enrollment.offeringId)]
      : (enrollment.offeringIds || []).map(Number).filter(Number.isFinite)
    const responses = {
      first_name: memberRow?.first_name,
      last_name: memberRow?.last_name,
      email: memberRow?.email || primaryAdultEmail || null,
      phone: memberRow?.phone,
      offering_ids: offeringIds,
    }
    const ssInsert = await client.query(
      `
        INSERT INTO scheduling_signup (
          form_id, time_slot_id, slot_group_id, member_id,
          first_name, last_name, email, phone, field_responses, responses, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed')
        RETURNING id
      `,
      [
        schedulingFormId,
        Number.isFinite(timeSlotId) ? timeSlotId : null,
        slotGroupId,
        memberId,
        responses.first_name,
        responses.last_name,
        responses.email,
        responses.phone,
        JSON.stringify(responses),
        JSON.stringify(responses),
      ],
    )
    schedulingSignupId = Number(ssInsert.rows[0]?.id)
  }

  return {
    memberId,
    memberProgramId,
    schedulingSignupId,
    programName,
    slotLabel: enrollment.scheduleLabel || '',
    status: 'confirmed',
    selectedDays: Array.isArray(enrollment.selectedDays) ? enrollment.selectedDays : [],
  }
}

async function suggestUsername(client, firstName, lastName) {
  const cleanFirstName = String(firstName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '')
  const cleanLastName = String(lastName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '').substring(0, 2)
  const baseUsername = cleanFirstName + cleanLastName
  if (!baseUsername) return ''

  let username = baseUsername
  let counter = 1
  while (counter < 100) {
    const existing = await client.query(
      `
        SELECT 1 FROM member WHERE LOWER(username) = LOWER($1)
        UNION ALL
        SELECT 1 FROM app_user WHERE LOWER(username) = LOWER($1)
        LIMIT 1
      `,
      [username],
    )
    if (existing.rows.length === 0) return username
    username = `${baseUsername}${counter}`
    counter += 1
  }
  return `${baseUsername}${Date.now()}`
}

/** Youth / guardian-managed members get MEMBER_ATHLETE without login credentials. */
async function ensureMemberAthleteAccount(client, memberId) {
  const res = await client.query(
    `
      SELECT id, facility_id, first_name, last_name, email, phone, username, app_user_id
      FROM member
      WHERE id = $1 AND is_active = TRUE
    `,
    [memberId],
  )
  const member = res.rows[0]
  if (!member) return null

  const fullName = `${member.first_name || ''} ${member.last_name || ''}`.trim()
  const userId = Number(member.id)

  await client.query(
    `
      INSERT INTO app_user (
        id, facility_id, role, email, phone, full_name, username, password_hash, is_active
      )
      VALUES ($1, $2, 'MEMBER_ATHLETE'::user_role, $3, $4, $5, $6, NULL, TRUE)
      ON CONFLICT (id) DO UPDATE SET
        role = 'MEMBER_ATHLETE'::user_role,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        full_name = EXCLUDED.full_name,
        username = COALESCE(EXCLUDED.username, app_user.username),
        is_active = TRUE,
        updated_at = now()
    `,
    [userId, member.facility_id, member.email, member.phone, fullName, member.username],
  )

  await client.query(
    `
      INSERT INTO app_user_role (user_id, role)
      VALUES ($1, 'MEMBER_ATHLETE'::user_role)
      ON CONFLICT DO NOTHING
    `,
    [userId],
  )

  if (Number(member.app_user_id) !== userId) {
    await client.query(
      `UPDATE member SET app_user_id = $1, updated_at = now() WHERE id = $1`,
      [userId],
    )
  }

  return userId
}

async function createMemberRecord(client, facilityId, familyId, memberInput, { parentGuardianIds = [], payerEmail = null } = {}) {
  const passwordHash = memberInput.password ? await bcrypt.hash(memberInput.password, 10) : null
  const dob = memberInput.dateOfBirth || memberInput.date_of_birth || null
  const minor = dob && !isAdult(dob)
  const address = memberInput.addressStreet || memberInput.address || null
  const hasCredentials = Boolean(memberInput.username && passwordHash)
  const storeUsername = hasCredentials ? memberInput.username : (!minor ? memberInput.username : null)
  const storePasswordHash = hasCredentials ? passwordHash : (!minor ? passwordHash : null)
  const storedEmail = payerEmail != null
    ? resolveStoredMemberEmail(memberInput, payerEmail)
    : (String(memberInput.email || '').trim() || null)

  const inserted = await client.query(
    `
      INSERT INTO member (
        facility_id, family_id, first_name, last_name, email, phone,
        date_of_birth, username, password_hash,
        address, billing_street, billing_city, billing_state, billing_zip,
        parent_guardian_ids, gender, status, is_active, profile_complete, signup_source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'legacy', TRUE, TRUE, $17)
      RETURNING *
    `,
    [
      facilityId,
      familyId,
      memberInput.firstName,
      memberInput.lastName,
      storedEmail,
      memberInput.phone || null,
      dob,
      storeUsername,
      storePasswordHash,
      address,
      memberInput.addressStreet || memberInput.billingStreet || null,
      memberInput.addressCity || memberInput.billingCity || null,
      memberInput.addressState || memberInput.billingState || null,
      memberInput.addressZip || memberInput.billingZip || null,
      parentGuardianIds.length > 0 ? parentGuardianIds : null,
      memberInput.gender || null,
      memberInput.signupSource || 'family_signup',
    ],
  )
  const member = inserted.rows[0]

  await client.query(
    `
      INSERT INTO family_member (family_id, member_id, is_active)
      VALUES ($1, $2, TRUE)
      ON CONFLICT (family_id, member_id) DO UPDATE SET is_active = TRUE, updated_at = now()
    `,
    [familyId, member.id],
  )

  if (hasCredentials && (storedEmail || memberInput.username)) {
    const fullName = `${memberInput.firstName} ${memberInput.lastName}`.trim()
    await client.query(
      `
        INSERT INTO app_user (
          id, facility_id, role, email, phone, full_name, username, password_hash, is_active, address
        )
        VALUES ($1, $2, 'MEMBER_ATHLETE'::user_role, $3, $4, $5, $6, $7, TRUE, $8)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          full_name = EXCLUDED.full_name,
          username = EXCLUDED.username,
          password_hash = EXCLUDED.password_hash,
          updated_at = now()
      `,
      [
        member.id,
        facilityId,
        storedEmail,
        memberInput.phone || null,
        fullName,
        memberInput.username || null,
        passwordHash,
        address,
      ],
    )
    await client.query(
      `INSERT INTO app_user_role (user_id, role) VALUES ($1, 'MEMBER_ATHLETE'::user_role) ON CONFLICT DO NOTHING`,
      [member.id],
    )
    await client.query(`UPDATE member SET app_user_id = $1 WHERE id = $1`, [member.id])
  } else if (minor) {
    await ensureMemberAthleteAccount(client, member.id)
  }

  if (minor) {
    await applyYouthAthleteFields(client, member.id, memberInput)
  }

  return member
}

/** Add a family member from the member portal (children or adults without login). */
export async function createPortalFamilyMember(client, {
  facilityId,
  familyId,
  payerMember,
  input,
}) {
  const firstName = String(input?.firstName || input?.first_name || '').trim()
  const lastName = String(input?.lastName || input?.last_name || '').trim()
  if (!firstName || !lastName) {
    throw new Error('First and last name are required.')
  }

  const dob = input?.dateOfBirth || input?.date_of_birth || null
  // Portal add is parent-driven; missing DOB almost always means a child profile.
  const minor = !dob || !isAdult(dob)
  if (minor && !payerMember?.id) {
    throw new Error('Could not resolve guardian for this family member.')
  }

  const payerEmail = String(payerMember?.email || '').trim() || null
  let email = String(input?.email || '').trim() || null
  if (minor && email && payerEmail && email.toLowerCase() === payerEmail.toLowerCase()) {
    email = null
  } else if (email) {
    await assertMemberEmailAvailable(client, facilityId, email)
  }

  const member = await createMemberRecord(client, facilityId, familyId, {
    firstName,
    lastName,
    email,
    phone: input?.phone || null,
    dateOfBirth: dob,
    signupSource: 'portal_add_family',
  }, {
    parentGuardianIds: minor ? [Number(payerMember.id)] : [],
    payerEmail: minor ? payerEmail : null,
  })

  return member
}

async function processFamilySignup(client, payload, options = {}) {
  const {
    facilityId: explicitFacilityId = null,
    joinExistingFamilyId = null,
    ipAddress = null,
    userAgent = null,
  } = options

  const facilityId = await resolveFacilityId(client, explicitFacilityId)
  const primaryAdult = payload.primaryAdult
  const additionalMembers = Array.isArray(payload.additionalMembers) ? payload.additionalMembers : []
  const enrollments = Array.isArray(payload.enrollments) ? payload.enrollments : []
  const waivers = payload.waivers || {}

  if (!primaryAdult?.firstName || !primaryAdult?.lastName) {
    throw new Error('Primary adult first and last name are required.')
  }
  if (!String(primaryAdult.email || '').trim()) {
    throw new Error('Primary adult email is required.')
  }
  const primaryPhoneDigits = String(primaryAdult.phone || '').replace(/\D/g, '')
  if (primaryPhoneDigits.length !== 10) {
    throw new Error('Primary adult phone must be a valid 10-digit number.')
  }
  if (!String(primaryAdult.addressStreet || '').trim()) {
    throw new Error('Primary adult street address is required.')
  }
  if (!String(primaryAdult.addressCity || '').trim()) {
    throw new Error('Primary adult city is required.')
  }
  if (!String(primaryAdult.addressState || '').trim()) {
    throw new Error('Primary adult state is required.')
  }
  if (!String(primaryAdult.addressZip || '').trim()) {
    throw new Error('Primary adult ZIP code is required.')
  }
  if (!primaryAdult.dateOfBirth || !isAdult(primaryAdult.dateOfBirth)) {
    throw new Error('Primary account holder must be 18 or older.')
  }
  if (!String(primaryAdult.username || '').trim()) {
    throw new Error('Primary adult username is required.')
  }
  if (!primaryAdult.password || primaryAdult.password.length < 8) {
    throw new Error('Primary adult password must be at least 8 characters.')
  }
  if (primaryAdult.password !== primaryAdult.confirmPassword) {
    throw new Error('Primary adult passwords do not match.')
  }

  const primaryEmail = String(primaryAdult.email || '').trim()
  await assertMemberEmailAvailable(client, facilityId, primaryEmail)

  const signatureName = String(waivers.signatureName || '').trim()
  const acceptedTemplateIds = (waivers.acceptedTemplateIds || []).map(Number).filter(Number.isFinite)
  const requiredIds = await activeRequiredWaiverTemplateIds(client, facilityId)
  const missing = requiredIds.filter((id) => !acceptedTemplateIds.includes(id))
  if (missing.length > 0) throw new Error('All required waivers must be accepted.')
  if (!signatureName) throw new Error('Waiver signature name is required.')

  const hasPaymentPolicy = await client.query(
    `SELECT 1 FROM waiver_template WHERE id = ANY($1::bigint[]) AND waiver_type = 'PAYMENT_POLICY' LIMIT 1`,
    [acceptedTemplateIds],
  )
  if (hasPaymentPolicy.rows.length > 0 && waivers.paymentPolicyAcknowledged !== true) {
    throw new Error('Payment policy acknowledgement is required.')
  }

  let familyId = joinExistingFamilyId ? Number(joinExistingFamilyId) : null
  let familyUsername = null
  let familyHadMembersBefore = false

  if (familyId) {
    familyHadMembersBefore = (await countActiveFamilyMembers(client, familyId)) > 0
    const familyCheck = await client.query(
      `SELECT id, family_username FROM family WHERE id = $1 AND archived = FALSE`,
      [familyId],
    )
    if (familyCheck.rows.length === 0) throw new Error('Existing family not found.')
    familyUsername = familyCheck.rows[0].family_username
  } else {
    const familyName = payload.familyName || `${primaryAdult.lastName} Family`
    familyUsername = await generateFamilyUsername(client, familyName, facilityId)
    const familyPasswordHash = await bcrypt.hash(primaryAdult.password, 10)
    const familyRes = await client.query(
      `
        INSERT INTO family (facility_id, family_name, family_username, family_password_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING id, family_username
      `,
      [facilityId, familyName, familyUsername, familyPasswordHash],
    )
    familyId = Number(familyRes.rows[0].id)
    familyUsername = familyRes.rows[0].family_username
  }

  const payerMember = await createMemberRecord(client, facilityId, familyId, {
    ...primaryAdult,
    signupSource: options.admin ? 'admin_family_signup' : 'public_family_signup',
  })

  await client.query(
    `
      INSERT INTO family_billing_account (
        family_id, payer_member_id, billing_email, billing_phone,
        billing_street, billing_city, billing_state, billing_zip, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
      ON CONFLICT (family_id) DO UPDATE SET
        payer_member_id = COALESCE(family_billing_account.payer_member_id, EXCLUDED.payer_member_id),
        billing_email = EXCLUDED.billing_email,
        billing_phone = EXCLUDED.billing_phone,
        billing_street = EXCLUDED.billing_street,
        billing_city = EXCLUDED.billing_city,
        billing_state = EXCLUDED.billing_state,
        billing_zip = EXCLUDED.billing_zip,
        is_active = TRUE,
        updated_at = now()
    `,
    [
      familyId,
      payerMember.id,
      primaryAdult.email || null,
      primaryAdult.phone || null,
      primaryAdult.addressStreet || null,
      primaryAdult.addressCity || null,
      primaryAdult.addressState || null,
      primaryAdult.addressZip || null,
    ],
  )

  const createdMembers = [{ clientIndex: 0, member: payerMember }]

  for (let i = 0; i < additionalMembers.length; i += 1) {
    const input = additionalMembers[i]
    const merged = {
      ...input,
      addressStreet: primaryAdult.addressStreet,
      addressCity: primaryAdult.addressCity,
      addressState: primaryAdult.addressState,
      addressZip: primaryAdult.addressZip,
    }
    const dob = merged.dateOfBirth
    const minor = dob && !isAdult(dob)
    const guardians = minor ? [payerMember.id] : []
    if (!merged.firstName || !merged.lastName) {
      throw new Error('Each family member needs a first and last name.')
    }
    if (!merged.username?.trim()) {
      throw new Error(`Username is required for ${merged.firstName} ${merged.lastName}.`)
    }

    const usesParentContact = memberUsesParentContactEmail(merged, primaryAdult.email)
    if (usesParentContact) {
      if (!minor) {
        throw new Error(`${merged.firstName} ${merged.lastName} must have their own email address.`)
      }
      if (!String(primaryAdult.email || '').trim()) {
        throw new Error('Primary adult email is required when a minor uses parent/guardian contact email.')
      }
      merged.email = null
      merged.emailSource = 'parent'
    } else if (!merged.email?.trim()) {
      throw new Error(`Email is required for ${merged.firstName} ${merged.lastName}.`)
    } else {
      await assertMemberEmailAvailable(client, facilityId, merged.email)
    }

    if (merged.useParentPassword) {
      if (!primaryAdult.password || primaryAdult.password.length < 8) {
        throw new Error('Primary adult password is required when sharing login with a family member.')
      }
      merged.password = primaryAdult.password
      merged.confirmPassword = primaryAdult.confirmPassword
    }
    if (!merged.password || merged.password.length < 8) {
      throw new Error(`Password must be at least 8 characters for ${merged.firstName} ${merged.lastName}.`)
    }
    if (merged.password !== merged.confirmPassword) {
      throw new Error(`Passwords do not match for ${merged.firstName} ${merged.lastName}.`)
    }
    const member = await createMemberRecord(client, facilityId, familyId, merged, {
      parentGuardianIds: guardians,
      payerEmail: primaryAdult.email,
    })
    createdMembers.push({ clientIndex: i + 1, member })
  }

  const memberIdByClientIndex = Object.fromEntries(
    createdMembers.map(({ clientIndex, member }) => [clientIndex, Number(member.id)]),
  )
  const allMemberIds = createdMembers.map(({ member }) => Number(member.id))
  const enrollmentReceipts = []
  const programKeysCreated = new Set()

  for (const enrollment of enrollments) {
    const memberId = memberIdByClientIndex[Number(enrollment.memberIndex)]
    const memberRow = createdMembers.find(({ member }) => Number(member.id) === memberId)?.member
    const receipt = await applyEnrollmentRow(client, {
      memberId,
      memberRow,
      primaryAdultEmail: primaryAdult.email,
      enrollment,
      programKeysCreated,
    })
    if (receipt) enrollmentReceipts.push(receipt)
  }

  await recordWaiverAcceptances(client, {
    memberIds: allMemberIds,
    acceptedTemplateIds,
    signerMemberId: payerMember.id,
    signatureName,
    comments: waivers.comments ?? null,
    paymentPolicyAcknowledged: waivers.paymentPolicyAcknowledged === true,
    ipAddress,
    userAgent,
  })

  return {
    familyId,
    familyUsername,
    payerMemberId: payerMember.id,
    memberIds: allMemberIds,
    loginMemberId: payerMember.id,
    familyHadMembersBefore,
    primaryEmail: String(primaryAdult.email || '').trim(),
    primaryName: String(primaryAdult.firstName || '').trim(),
    enrollmentReceipts,
  }
}

function tokenFrom(req) {
  const authHeader = req.headers.authorization
  return authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
}

async function loadAdminAuth(pool, jwtSecret, req) {
  const token = tokenFrom(req)
  if (!token) return null
  const decoded = jwt.verify(token, jwtSecret)
  const userId = decoded.userId || decoded.adminId
  if (!userId) return null
  const userRes = await pool.query(
    `
      SELECT au.id, au.facility_id, au.is_active, COALESCE(ap.is_master_admin, false) as is_master_admin
      FROM app_user au
      LEFT JOIN admin_profile ap ON ap.user_id = au.id
      WHERE au.id = $1
    `,
    [userId],
  )
  if (userRes.rows.length === 0 || userRes.rows[0].is_active === false) return null
  return userRes.rows[0]
}

function adminAuthMiddleware(pool, jwtSecret) {
  return async (req, res, next) => {
    try {
      const user = await loadAdminAuth(pool, jwtSecret, req)
      if (!user) return res.status(401).json({ success: false, message: 'Admin authentication required' })
      req.adminAuth = user
      next()
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' })
    }
  }
}

export function registerFamilySignupRoutes(app, pool, { jwtSecret } = {}) {
  void ensureSignupSchema(pool).catch((err) => {
    console.error('[signup] ensureSignupSchema failed:', err.message)
  })

  // Best-effort welcome, enrollment receipts, guardian alerts, and email verification after signup commits.
  const sendPostSignupNotifications = async (result) => {
    if (!result) return

    if (!result.skipWelcome) {
      try {
        await notifyWelcomeNewMembers(pool, result.memberIds || [], { context: 'family_signup' })
      } catch (err) {
        console.warn('[signup] welcome emails failed:', err?.message || err)
      }
    }

    for (const receipt of result.enrollmentReceipts || []) {
      try {
        await notifyEnrollmentReceipt(pool, {
          memberId: receipt.memberId,
          programName: receipt.programName,
          slotLabel: receipt.slotLabel,
          status: receipt.status,
          selectedDays: receipt.selectedDays,
          schedulingSignupId: receipt.schedulingSignupId,
          memberProgramId: receipt.memberProgramId,
        })
      } catch (err) {
        console.warn('[signup] enrollment receipt failed:', err?.message || err)
      }
    }

    if (result.familyHadMembersBefore && result.familyId) {
      for (const memberId of result.memberIds || []) {
        try {
          await notifyFamilyGuardiansNewMember(pool, {
            familyId: Number(result.familyId),
            newMemberId: Number(memberId),
          })
        } catch (err) {
          console.warn('[signup] guardian alert failed:', err?.message || err)
        }
      }
    }

    const to = String(result.primaryEmail || '').trim()
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      if (result.inviteCompletion) {
        try {
          await sendInviteSignupCompleteEmail({
            to,
            parentName: result.primaryName,
            minorName: result.minorName,
            enrollmentCount: (result.enrollmentReceipts || []).length,
          })
        } catch (err) {
          console.warn('[signup] invite completion email failed:', err?.message || err)
        }
      }

      try {
        const payerMemberId = Number(result.payerMemberId)
        if (Number.isFinite(payerMemberId)) {
          const userRes = await pool.query(
            `SELECT app_user_id FROM member WHERE id = $1`,
            [payerMemberId],
          )
          const appUserId = userRes.rows[0]?.app_user_id
          if (appUserId) {
            await issueEmailVerification(pool, {
              userId: appUserId,
              email: to,
              name: result.primaryName,
              bestEffort: true,
            })
          }
        }
      } catch (err) {
        console.warn('[signup] email verification send failed:', err?.message || err)
      }
    }
  }

  app.get('/api/enrollment-receipt/:token', async (req, res) => {
    try {
      await ensureSignupSchema(pool)
      const token = String(req.params.token || '').trim()
      const result = await verifyEnrollmentReceiptToken(pool, token)
      if (!result.ok) {
        return res.status(404).json({ success: false, message: result.message })
      }
      res.json({ success: true, data: result.data })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  })

  app.get('/api/signup/suggest-username', async (req, res) => {
    try {
      await ensureSignupSchema(pool)
      const firstName = String(req.query.firstName || '').trim()
      const lastName = String(req.query.lastName || '').trim()
      if (!firstName) {
        return res.status(400).json({ success: false, message: 'firstName is required' })
      }
      const username = await suggestUsername(pool, firstName, lastName)
      res.json({ success: true, data: { username } })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  })

  app.get('/api/signup/catalog/programs', async (_req, res) => {
    try {
      await ensureSignupSchema(pool)
      const schema = await resolveProgramsSchema(pool)
      const hasProgramIsActive = await pool.query(
        `
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = 'is_active'
          LIMIT 1
        `,
        [schema.programsTable],
      )
      const programActiveClause =
        hasProgramIsActive.rows.length > 0 ? 'AND COALESCE(pr.is_active, TRUE) = TRUE' : ''
      const signupSlotsClause = sqlClassHasSignupSlots('p')
      const result = await pool.query(
        `
          SELECT pr.id, pr.name, pr.display_name, pr.description
          FROM ${schema.programsTable} pr
          WHERE COALESCE(pr.archived, FALSE) = FALSE
            ${programActiveClause}
            AND EXISTS (
              SELECT 1
              FROM program p
              WHERE p.${schema.programFkColumn} = pr.id
                AND COALESCE(p.is_active, TRUE) = TRUE
                AND COALESCE(p.archived, FALSE) = FALSE
                AND ${signupSlotsClause}
            )
          ORDER BY COALESCE(pr.display_name, pr.name), pr.id
        `,
      )
      res.json({
        success: true,
        data: result.rows.map((row) => ({
          id: Number(row.id),
          name: row.name,
          displayName: row.display_name,
          description: row.description,
        })),
      })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  })

  app.get('/api/signup/catalog/programs/:programsId/classes', async (req, res) => {
    try {
      await ensureSignupSchema(pool)
      const schema = await resolveProgramsSchema(pool)
      const programsId = Number(req.params.programsId)
      const signupSlotsClause = sqlClassHasSignupSlots('p')
      const result = await pool.query(
        `
          SELECT
            p.id,
            p.name,
            p.display_name,
            sf.id AS scheduling_form_id
          FROM program p
          INNER JOIN scheduling_form sf
            ON sf.program_id = p.id AND sf.deleted_at IS NULL AND sf.is_active = TRUE
          WHERE p.${schema.programFkColumn} = $1
            AND COALESCE(p.is_active, TRUE) = TRUE
            AND COALESCE(p.archived, FALSE) = FALSE
            AND ${signupSlotsClause}
          ORDER BY COALESCE(p.display_name, p.name), p.id
        `,
        [programsId],
      )
      res.json({
        success: true,
        data: result.rows.map((row) => ({
          id: Number(row.id),
          name: row.name,
          displayName: row.display_name,
          schedulingFormId: row.scheduling_form_id != null ? Number(row.scheduling_form_id) : null,
        })),
      })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  })

  app.get('/api/signup/catalog/classes/:classEventId/offerings', async (req, res) => {
    try {
      await ensureSignupSchema(pool)
      const classEventId = Number(req.params.classEventId)
      const catalog = await loadClassEnrollmentCatalog(pool, classEventId)
      res.json({ success: true, data: catalog })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  })

  app.get('/api/signup/catalog/prefill/:formId', async (req, res) => {
    try {
      await ensureSignupSchema(pool)
      const schema = await resolveProgramsSchema(pool)
      const formId = Number(req.params.formId)
      const result = await pool.query(
        `
          SELECT
            sf.id AS form_id,
            sf.program_id AS class_event_id,
            sf.programs_id,
            p.display_name AS class_display_name,
            pr.display_name AS program_display_name
          FROM scheduling_form sf
          LEFT JOIN program p ON p.id = sf.program_id
          LEFT JOIN ${schema.programsTable} pr ON pr.id = sf.programs_id
          WHERE sf.id = $1 AND sf.deleted_at IS NULL
        `,
        [formId],
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Scheduling form not found' })
      }
      const row = result.rows[0]
      res.json({
        success: true,
        data: {
          formId: Number(row.form_id),
          classEventId: row.class_event_id != null ? Number(row.class_event_id) : null,
          programsId: row.programs_id != null ? Number(row.programs_id) : null,
          classDisplayName: row.class_display_name,
          programDisplayName: row.program_display_name,
        },
      })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  })

  app.get('/api/signup/programs', async (_req, res) => {
    try {
      const result = await pool.query(
        `
          SELECT p.id, p.name, p.display_name, p.programs_id
          FROM program p
          WHERE COALESCE(p.is_active, TRUE) = TRUE
          ORDER BY COALESCE(p.display_name, p.name), p.id
          LIMIT 200
        `,
      )
      res.json({ success: true, data: result.rows })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  })

  app.get('/api/signup/waivers', async (_req, res) => {
    try {
      await ensureSignupSchema(pool)
      const facilityId = await resolveFacilityId(pool)
      const waiverQuery = `
          SELECT id, name, version, body, waiver_type, is_required
          FROM waiver_template
          WHERE facility_id = $1
            AND active_from <= now()
            AND (active_to IS NULL OR active_to > now())
          ORDER BY
            CASE waiver_type
              WHEN 'ASSUMPTION_OF_RISK' THEN 1
              WHEN 'RELEASE_OF_LIABILITY' THEN 2
              WHEN 'MEDICAL_EMERGENCY' THEN 3
              WHEN 'PAYMENT_POLICY' THEN 4
              ELSE 99
            END,
            name
        `
      let result = await pool.query(waiverQuery, [facilityId])
      if (result.rows.length === 0) {
        await seedCanonicalWaivers(pool)
        result = await pool.query(waiverQuery, [facilityId])
      }
      res.json({ success: true, data: result.rows })
    } catch (error) {
      console.error('[signup] GET /api/signup/waivers failed:', error.message)
      res.status(500).json({ success: false, message: error.message })
    }
  })

  app.post('/api/signup/family', async (req, res) => {
    const client = await pool.connect()
    try {
      await ensureSignupSchema(pool)
      await client.query('BEGIN')
      const result = await processFamilySignup(client, req.body, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      })
      await client.query('COMMIT')
      void sendPostSignupNotifications(result)
      res.json({ success: true, data: result })
    } catch (error) {
      await client.query('ROLLBACK')
      const formatted = formatSignupError(error)
      res.status(400).json({ success: false, message: formatted.message })
    } finally {
      client.release()
    }
  })

  app.post('/api/admin/signup/family', adminAuthMiddleware(pool, jwtSecret), async (req, res) => {
    const client = await pool.connect()
    try {
      await ensureSignupSchema(pool)
      await client.query('BEGIN')
      const result = await processFamilySignup(client, req.body, {
        facilityId: req.adminAuth.facility_id,
        joinExistingFamilyId: req.body?.existingFamilyId ?? null,
        admin: true,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      })
      await client.query('COMMIT')
      void sendPostSignupNotifications(result)
      res.json({ success: true, data: result })
    } catch (error) {
      await client.query('ROLLBACK')
      const formatted = formatSignupError(error)
      res.status(400).json({ success: false, message: formatted.message })
    } finally {
      client.release()
    }
  })

  app.post('/api/signup/minor-start', async (req, res) => {
    const client = await pool.connect()
    try {
      const minor = req.body?.minor || req.body
      const parentEmail = String(req.body?.parentEmail || req.body?.parent_email || '').trim().toLowerCase()
      const enrollments = Array.isArray(req.body?.enrollments) ? req.body.enrollments : []

      if (!minor?.firstName || !minor?.lastName) {
        return res.status(400).json({ success: false, message: 'Minor first and last name are required.' })
      }
      if (!minor.dateOfBirth || isAdult(minor.dateOfBirth)) {
        return res.status(400).json({ success: false, message: 'Minor must be under 18.' })
      }
      if (!parentEmail) {
        return res.status(400).json({ success: false, message: 'Parent or guardian email is required.' })
      }

      await client.query('BEGIN')
      const facilityId = await resolveFacilityId(client)
      const familyName = `${minor.lastName} Family (Pending)`
      const familyUsername = await generateFamilyUsername(client, familyName, facilityId)
      const tempPasswordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10)
      const familyRes = await client.query(
        `
          INSERT INTO family (facility_id, family_name, family_username, family_password_hash)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [facilityId, familyName, familyUsername, tempPasswordHash],
      )
      const familyId = Number(familyRes.rows[0].id)

      const memberRes = await client.query(
        `
          INSERT INTO member (
            facility_id, family_id, first_name, last_name, email, phone, date_of_birth, gender,
            status, is_active, signup_source
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'legacy', TRUE, 'minor_invite_pending')
          RETURNING *
        `,
        [
          facilityId,
          familyId,
          minor.firstName,
          minor.lastName,
          minor.email || null,
          minor.phone || null,
          minor.dateOfBirth,
          minor.gender || null,
        ],
      )
      const minorMember = memberRes.rows[0]
      await client.query(
        `
          INSERT INTO family_member (family_id, member_id, is_active)
          VALUES ($1, $2, TRUE)
          ON CONFLICT (family_id, member_id) DO UPDATE SET is_active = TRUE, updated_at = now()
        `,
        [familyId, minorMember.id],
      )
      await applyYouthAthleteFields(client, minorMember.id, minor)

      const catalogEnrollments = []
      for (const enrollment of enrollments) {
        const classEventId = Number(enrollment.classEventId ?? enrollment.programId)
        if (!Number.isFinite(classEventId)) continue
        const progRes = await client.query(
          `SELECT COALESCE(display_name, name) AS label FROM program WHERE id = $1`,
          [classEventId],
        )
        catalogEnrollments.push({
          ...enrollment,
          classEventId,
          programId: classEventId,
          programName: enrollment.programName || progRes.rows[0]?.label || 'Class',
        })
      }

      const { token, tokenHash, tokenCiphertext } = await createAccountInviteTokenRecord()
      await client.query(
        `
          INSERT INTO account_invite (
            facility_id, token_hash, token_ciphertext, inviter_member_id, invitee_email,
            pending_family_id, pending_payload
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        `,
        [
          facilityId,
          tokenHash,
          tokenCiphertext,
          minorMember.id,
          parentEmail,
          familyId,
          JSON.stringify({ minorMemberId: minorMember.id, enrollments: catalogEnrollments }),
        ],
      )

      await client.query('COMMIT')

      const inviteUrl = buildAccountInviteUrl(token)
      const emailResult = await sendAccountInviteEmail({
        to: parentEmail,
        inviteUrl,
        minorName: `${minor.firstName} ${minor.lastName}`,
      })

      res.json({
        success: true,
        data: {
          familyId,
          minorMemberId: minorMember.id,
          inviteSent: emailResult.sent === true,
          inviteUrl: emailResult.sent ? undefined : inviteUrl,
        },
      })
    } catch (error) {
      await client.query('ROLLBACK')
      res.status(400).json({ success: false, message: error.message })
    } finally {
      client.release()
    }
  })

  app.post('/api/signup/invite/:token/verify', async (req, res) => {
    try {
      const token = String(req.params.token || '').trim()
      if (!token) return res.status(400).json({ success: false, message: 'Token is required.' })

      const match = await findAccountInviteByToken(pool, token, { withMinor: true })
      if (!match) {
        return res.status(404).json({ success: false, message: 'Invite link is invalid.' })
      }
      if (match.state === 'used') {
        return res.status(410).json({
          success: false,
          message: 'This invite has already been used. Log in to the member portal instead.',
        })
      }

      const invite = match.invite
      const payload = invite.pending_payload || {}
      const enrichedEnrollments = await enrichInviteEnrollments(pool, payload.enrollments)
      res.json({
        success: true,
        data: {
          inviteeEmail: invite.invitee_email,
          pendingFamilyId: invite.pending_family_id,
          minor: {
            firstName: invite.minor_first_name,
            lastName: invite.minor_last_name,
            dateOfBirth: invite.minor_dob,
          },
          pendingPayload: { ...payload, enrollments: enrichedEnrollments },
        },
      })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  })

  app.post('/api/signup/invite/:token/complete', async (req, res) => {
    const client = await pool.connect()
    try {
      const token = String(req.params.token || '').trim()
      const match = await findAccountInviteByToken(client, token)
      if (!match) {
        return res.status(404).json({ success: false, message: 'Invite link is invalid.' })
      }
      if (match.state === 'used') {
        return res.status(410).json({
          success: false,
          message: 'This invite has already been used. Log in to the member portal instead.',
        })
      }
      const invite = match.invite

      const primaryAdult = req.body?.primaryAdult || req.body?.adult || req.body
      const waivers = req.body?.waivers || {}
      const familyId = Number(invite.pending_family_id)
      const payload = invite.pending_payload || {}
      const minorMemberId = Number(payload.minorMemberId)
      let minorName = null
      const inviteEnrollmentReceipts = []

      await client.query('BEGIN')

      const result = await processFamilySignup(client, {
        primaryAdult,
        additionalMembers: [],
        enrollments: [],
        waivers,
        familyName: `${primaryAdult.lastName} Family`,
      }, {
        joinExistingFamilyId: familyId,
        facilityId: invite.facility_id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      })

      if (Number.isFinite(minorMemberId)) {
        await client.query(
          `
            UPDATE member
            SET parent_guardian_ids = ARRAY[$2]::bigint[], updated_at = now()
            WHERE id = $1
          `,
          [minorMemberId, result.payerMemberId],
        )
        const requiredIds = await activeRequiredWaiverTemplateIds(client, invite.facility_id)
        const acceptedTemplateIds = (waivers.acceptedTemplateIds || []).map(Number).filter(Number.isFinite)
        if (acceptedTemplateIds.length > 0) {
          await recordWaiverAcceptances(client, {
            memberIds: [minorMemberId],
            acceptedTemplateIds,
            signerMemberId: result.payerMemberId,
            signatureName: String(waivers.signatureName || '').trim(),
            comments: waivers.comments ?? null,
            paymentPolicyAcknowledged: waivers.paymentPolicyAcknowledged === true,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') ?? null,
          })
        } else if (requiredIds.length > 0) {
          throw new Error('All required waivers must be accepted for the minor.')
        }

        await ensureMemberAthleteAccount(client, minorMemberId)
        await client.query(
          `
            UPDATE member
            SET signup_source = CASE
                  WHEN signup_source = 'minor_invite_pending' THEN 'minor_invite'
                  ELSE signup_source
                END,
                updated_at = now()
            WHERE id = $1
          `,
          [minorMemberId],
        )

        const bodyEnrollments = Array.isArray(req.body?.enrollments) ? req.body.enrollments : null
        const pendingEnrollments = bodyEnrollments
          ?? (Array.isArray(payload.enrollments) ? payload.enrollments : [])
        if (pendingEnrollments.length > 0) {
          const minorRow = await client.query(`SELECT * FROM member WHERE id = $1`, [minorMemberId])
          if (minorRow.rows[0]) {
            minorName = `${minorRow.rows[0].first_name || ''} ${minorRow.rows[0].last_name || ''}`.trim() || null
          }
          const programKeysCreated = new Set()
          for (const enrollment of pendingEnrollments) {
            const receipt = await applyEnrollmentRow(client, {
              memberId: minorMemberId,
              memberRow: minorRow.rows[0],
              primaryAdultEmail: primaryAdult.email,
              enrollment,
              programKeysCreated,
            })
            if (receipt) inviteEnrollmentReceipts.push(receipt)
          }
        } else {
          const minorRow = await client.query(
            `SELECT first_name, last_name FROM member WHERE id = $1`,
            [minorMemberId],
          )
          if (minorRow.rows[0]) {
            minorName = `${minorRow.rows[0].first_name || ''} ${minorRow.rows[0].last_name || ''}`.trim() || null
          }
        }
      }

      await client.query(`UPDATE account_invite SET used_at = now() WHERE id = $1`, [invite.id])
      await client.query('COMMIT')

      if (Number.isFinite(minorMemberId)) {
        void notifyFamilyGuardiansNewMember(pool, {
          familyId,
          newMemberId: minorMemberId,
          addedByUserId: result.payerMemberId ?? null,
        })
      }

      void sendPostSignupNotifications({
        ...result,
        enrollmentReceipts: [
          ...(result.enrollmentReceipts || []),
          ...inviteEnrollmentReceipts,
        ],
        inviteCompletion: true,
        skipWelcome: true,
        minorName,
      })

      res.json({ success: true, data: result })
    } catch (error) {
      await client.query('ROLLBACK')
      res.status(400).json({ success: false, message: error.message })
    } finally {
      client.release()
    }
  })
}
