import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { loadCanonicalAccessContext } from './accessContext.js'
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
import { sendDropInConfirmationNotifications } from '../scheduling/dropInNotificationEmail.js'
import { linkMemberToSchoolFromName } from '../schools/handlers.js'
import { ensureSignupSchema } from './ensureSignupSchema.js'
import { seedCanonicalWaivers } from './seedCanonicalWaivers.js'
import { loadEffectivePricingForForm } from '../programs/pricingDefaults.js'
import { resolveProgramsSchema } from '../programs/schema.js'
import {
  daySortIndex,
  resolveActiveDatesForSort,
  rowsHaveMultipleWeekLetters,
  sortOccurrenceRows,
  sortScheduleCatalogOptions,
} from '../scheduling/slotSort.js'
import { requireEnrollmentStartDate } from '../scheduling/enrollmentStartDate.js'

const DEFAULT_FACILITY_TIME_ZONE = 'America/New_York'

function parseDateOnly(value) {
  const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return null
  return { year, month, day }
}

function currentDateInTimeZone(timeZone = DEFAULT_FACILITY_TIME_ZONE, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function isAdultOnDate(dateOfBirth, asOfDate = currentDateInTimeZone()) {
  const birth = parseDateOnly(dateOfBirth)
  const asOf = parseDateOnly(asOfDate)
  if (!birth || !asOf) return false
  const age = asOf.year - birth.year
    - (asOf.month < birth.month || (asOf.month === birth.month && asOf.day < birth.day) ? 1 : 0)
  return age >= 18
}

export function validateSignupUsername(value) {
  const username = String(value || '').trim()
  if (username.includes('@')) {
    throw new Error('Usernames cannot contain @. Use an email address only in the email field.')
  }
  return username
}

function memberUsesParentContactEmail(memberInput, payerEmail, asOfDate) {
  const emailSource = String(memberInput.emailSource || memberInput.email_source || '').toLowerCase()
  if (emailSource === 'parent') return true
  if (emailSource === 'youth') return false

  const dob = memberInput.dateOfBirth || memberInput.date_of_birth
  const minor = dob && !isAdultOnDate(dob, asOfDate)
  if (!minor) return false

  const email = String(memberInput.email || '').trim().toLowerCase()
  const payer = String(payerEmail || '').trim().toLowerCase()
  return Boolean(email && payer && email === payer)
}

function resolveStoredMemberEmail(memberInput, payerEmail, asOfDate) {
  if (memberUsesParentContactEmail(memberInput, payerEmail, asOfDate)) {
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
      SELECT id
        FROM member
       WHERE facility_id = $1
         AND email IS NOT NULL
         AND LOWER(TRIM(email)) = $2
      UNION ALL
      SELECT id
        FROM app_user
       WHERE facility_id = $1
         AND (
           LOWER(BTRIM(email)) = $2
           OR LOWER(BTRIM(username)) = $2
         )
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

async function resolveFacilitySignupDate(client, facilityId) {
  const result = await client.query(
    `SELECT
       (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(timezone, ''), $2))::date::text AS facility_date
       FROM facility
      WHERE id = $1
      LIMIT 1`,
    [Number(facilityId), DEFAULT_FACILITY_TIME_ZONE],
  )
  if (!result.rows[0]?.facility_date) {
    throw new Error('Signup facility was not found.')
  }
  return String(result.rows[0].facility_date)
}

function normalizeAcceptedWaiverTemplateIds(value) {
  if (value == null) return []
  if (!Array.isArray(value)) {
    throw new Error('Accepted waiver template IDs must be provided as a list.')
  }
  const ids = value.map(Number)
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error('One or more selected waiver templates are invalid or unavailable.')
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error('Accepted waiver template IDs must be unique.')
  }
  return ids
}

export async function validateSignupWaiverTemplateIds(client, {
  facilityId,
  acceptedTemplateIds,
}) {
  const normalizedFacilityId = Number(facilityId)
  if (!Number.isSafeInteger(normalizedFacilityId) || normalizedFacilityId <= 0) {
    throw new Error('A valid facility is required to accept waivers.')
  }
  const normalizedAcceptedIds = normalizeAcceptedWaiverTemplateIds(acceptedTemplateIds)
  const result = await client.query(
    `SELECT id, waiver_type, is_required
       FROM waiver_template
      WHERE facility_id = $1
        AND active_from <= now()
        AND (active_to IS NULL OR active_to > now())
      ORDER BY id`,
    [normalizedFacilityId],
  )
  const availableById = new Map(result.rows.map((row) => [Number(row.id), row]))
  if (normalizedAcceptedIds.some((id) => !availableById.has(id))) {
    throw new Error('One or more selected waiver templates are invalid or unavailable.')
  }

  const acceptedIdSet = new Set(normalizedAcceptedIds)
  const missingRequired = result.rows
    .filter((row) => row.is_required === true && !acceptedIdSet.has(Number(row.id)))
  if (missingRequired.length > 0) {
    throw new Error('All required waivers must be accepted.')
  }

  return {
    acceptedTemplateIds: normalizedAcceptedIds,
    acceptedTemplates: normalizedAcceptedIds.map((id) => availableById.get(id)),
  }
}

export async function resolveSignupWaiverTargetMemberIds(client, {
  facilityId,
  signerMemberId,
  candidateMemberIds,
  asOfDate = null,
}) {
  const normalizedFacilityId = Number(facilityId)
  const normalizedSignerId = Number(signerMemberId)
  const normalizedCandidateIds = [...new Set((candidateMemberIds || []).map(Number))]
  if (
    !Number.isSafeInteger(normalizedFacilityId)
    || normalizedFacilityId <= 0
    || !Number.isSafeInteger(normalizedSignerId)
    || normalizedSignerId <= 0
    || normalizedCandidateIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
  ) {
    throw new Error('Waiver signer and member IDs must be valid.')
  }
  if (normalizedCandidateIds.length === 0) return []
  const rawSignupDate = asOfDate || await resolveFacilitySignupDate(client, normalizedFacilityId)
  if (!parseDateOnly(rawSignupDate)) {
    throw new Error('A valid facility signup date is required to accept waivers.')
  }
  const signupDate = String(rawSignupDate).slice(0, 10)

  const result = await client.query(
    `SELECT DISTINCT target.id
       FROM member signer
       JOIN family_member signer_membership
         ON signer_membership.member_id = signer.id
        AND signer_membership.is_active = TRUE
       JOIN family_member target_membership
         ON target_membership.family_id = signer_membership.family_id
        AND target_membership.is_active = TRUE
       JOIN member target
         ON target.id = target_membership.member_id
        AND target.facility_id = signer.facility_id
        AND target.is_active = TRUE
      WHERE signer.id = $1
        AND signer.facility_id = $2
        AND signer.is_active = TRUE
        AND signer.date_of_birth IS NOT NULL
        AND signer.date_of_birth <= ($4::date - INTERVAL '18 years')::date
        AND target.id = ANY($3::bigint[])
        AND (
          target.id = signer.id
          OR (
            target.date_of_birth IS NOT NULL
            AND target.date_of_birth > ($4::date - INTERVAL '18 years')::date
            AND EXISTS (
              SELECT 1
                FROM parent_guardian_authority authority
               WHERE authority.parent_member_id = signer.id
                 AND authority.child_member_id = target.id
                 AND authority.has_legal_authority = TRUE
            )
          )
        )`,
    [normalizedSignerId, normalizedFacilityId, normalizedCandidateIds, signupDate],
  )
  const authorizedIds = new Set(result.rows.map((row) => Number(row.id)))
  return normalizedCandidateIds.filter((id) => authorizedIds.has(id))
}

export async function initializeSignupBillingAccount(client, {
  enabled,
  populateExisting = false,
  familyId,
  payerMemberId,
  billingEmail,
  billingPhone,
  billingStreet,
  billingCity,
  billingState,
  billingZip,
}) {
  if (enabled !== true) return false
  const conflictAction = populateExisting === true
    ? `DO UPDATE SET
         payer_member_id = EXCLUDED.payer_member_id,
         billing_email = EXCLUDED.billing_email,
         billing_phone = EXCLUDED.billing_phone,
         billing_street = EXCLUDED.billing_street,
         billing_city = EXCLUDED.billing_city,
         billing_state = EXCLUDED.billing_state,
         billing_zip = EXCLUDED.billing_zip,
         is_active = TRUE,
         updated_at = now()`
    : 'DO NOTHING'
  const created = await client.query(
    `INSERT INTO family_billing_account (
       family_id, payer_member_id, billing_email, billing_phone,
       billing_street, billing_city, billing_state, billing_zip, is_active
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
     ON CONFLICT (family_id) ${conflictAction}
     RETURNING id`,
    [
      Number(familyId),
      Number(payerMemberId),
      billingEmail || null,
      billingPhone || null,
      billingStreet || null,
      billingCity || null,
      billingState || null,
      billingZip || null,
    ],
  )
  return created.rows.length === 1
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

export async function syncCanonicalGuardianAuthority(client, childMemberId, parentGuardianIds = []) {
  const childId = Number(childMemberId)
  if (!Number.isSafeInteger(childId) || childId <= 0) {
    throw new Error('A valid child member id is required to update guardian authority.')
  }

  const guardianIds = [...new Set(parentGuardianIds.map(Number))]
  if (guardianIds.some((id) => !Number.isSafeInteger(id) || id <= 0 || id === childId)) {
    throw new Error('Guardian authority requires valid, distinct member ids.')
  }

  await client.query(
    `UPDATE parent_guardian_authority
        SET has_legal_authority = FALSE,
            updated_at = now()
      WHERE child_member_id = $1
        AND has_legal_authority = TRUE`,
    [childId],
  )

  for (const guardianId of guardianIds) {
    await client.query(
      `INSERT INTO parent_guardian_authority (
         parent_member_id,
         child_member_id,
         has_legal_authority
       ) VALUES ($1, $2, TRUE)
       ON CONFLICT (parent_member_id, child_member_id) DO UPDATE SET
         has_legal_authority = TRUE,
         updated_at = now()`,
      [guardianId, childId],
    )
  }

  return guardianIds
}

export async function recordSignupWaiverAcceptances(client, {
  candidateMemberIds,
  acceptedTemplateIds,
  facilityId,
  signerMemberId,
  signatureName,
  comments,
  paymentPolicyAcknowledged,
  ipAddress,
  userAgent,
  asOfDate = null,
}) {
  const validatedWaivers = await validateSignupWaiverTemplateIds(client, {
    facilityId,
    acceptedTemplateIds,
  })
  const memberIds = await resolveSignupWaiverTargetMemberIds(client, {
    facilityId,
    signerMemberId,
    candidateMemberIds,
    asOfDate,
  })
  const waiverTypeById = new Map(
    validatedWaivers.acceptedTemplates.map((row) => [Number(row.id), row.waiver_type]),
  )
  for (const memberId of memberIds) {
    for (const templateId of validatedWaivers.acceptedTemplateIds) {
      const isPayment = waiverTypeById.get(templateId) === 'PAYMENT_POLICY'
      const recorded = await client.query(
        `
          INSERT INTO member_waiver_acceptance (
            member_id, waiver_template_id, accepted_by_member_id,
            signature_name, ip_address, user_agent, comments, payment_policy_acknowledged
          )
          SELECT $1, template.id, $3, $4, $5, $6, $7, $8
            FROM waiver_template template
           WHERE template.id = $2
             AND template.facility_id = $9
             AND template.active_from <= now()
             AND (template.active_to IS NULL OR template.active_to > now())
          ON CONFLICT (member_id, waiver_template_id) DO UPDATE SET
            accepted_by_member_id = EXCLUDED.accepted_by_member_id,
            accepted_at = now(),
            signature_name = EXCLUDED.signature_name,
            ip_address = EXCLUDED.ip_address,
            user_agent = EXCLUDED.user_agent,
            comments = EXCLUDED.comments,
            payment_policy_acknowledged = EXCLUDED.payment_policy_acknowledged
          RETURNING member_id, waiver_template_id
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
          Number(facilityId),
        ],
      )
      if (recorded.rows.length !== 1) {
        throw new Error('One or more selected waiver templates are invalid or unavailable.')
      }
    }
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

function buildSlotScheduleLabel(row, includeWeek = false) {
  const parts = []
  if (includeWeek) {
    const letter = String(row.week_letter ?? 'A').trim() || 'A'
    parts.push(`${letter}-Week`)
  }
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
  const rows = sortOccurrenceRows(occurrenceRows || [])
  if (!rows.length) return ''
  const includeWeek = rowsHaveMultipleWeekLetters(rows)
  if (rows.length === 1) return buildSlotScheduleLabel(rows[0], includeWeek)

  const dayLabels = rows.map((row) => {
    if (row.schedule_mode === 'date' && row.specific_date) {
      return formatSignupUsDate(row.specific_date)
    }
    if (row.day_of_week != null) {
      const name = DAY_NAMES[row.day_of_week] || row.day_name || 'Day'
      return name.length > 3 ? name.slice(0, 3) : name
    }
    return row.day_name?.slice(0, 3) || 'Day'
  })
  const startTime = formatTimeOnly(rows[0].start_time)
  const endTime = formatTimeOnly(rows[0].end_time)
  const sameTime = rows.every(
    (row) =>
      formatTimeOnly(row.start_time) === startTime && formatTimeOnly(row.end_time) === endTime,
  )
  const daysPart = dayLabels.join(', ')
  if (sameTime && startTime && endTime) return `${daysPart} · ${startTime}–${endTime}`
  return daysPart
}

function buildGroupScheduleLabel(occurrenceRows) {
  if (!occurrenceRows?.length) return ''
  const includeWeek = rowsHaveMultipleWeekLetters(occurrenceRows)
  return sortOccurrenceRows(occurrenceRows)
    .map((row) => buildSlotScheduleLabel(row, includeWeek))
    .join('; ')
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

/**
 * Class (program row) has a scheduling form with at least one active signup slot.
 *
 * Class Setup is the source of truth for availability. scheduling_form.is_active is
 * a derived legacy flag and must not hide an otherwise active class from signup.
 */
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
    )
  `
}

async function loadClassEnrollmentCatalog(pool, classEventId) {
  const schema = await resolveProgramsSchema(pool)
  const parentActiveColumn = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = $1 AND column_name = 'is_active' LIMIT 1`,
    [schema.programsTable],
  )
  const activeParentClause =
    parentActiveColumn.rows.length > 0 ? 'AND COALESCE(pr.is_active, TRUE) = TRUE' : ''
  const formRes = await pool.query(
    `
      SELECT sf.*, p.${schema.programFkColumn} AS resolved_programs_id
      FROM scheduling_form sf
      INNER JOIN program p ON p.id = sf.program_id
      INNER JOIN ${schema.programsTable} pr ON pr.id = p.${schema.programFkColumn}
      WHERE sf.program_id = $1
        AND sf.deleted_at IS NULL
        AND COALESCE(p.archived, FALSE) = FALSE
        AND COALESCE(p.is_active, TRUE) = TRUE
        AND COALESCE(pr.archived, FALSE) = FALSE
        ${activeParentClause}
        AND EXISTS (
          SELECT 1
          FROM scheduling_slot_group sg
          INNER JOIN scheduling_time_slot ts
            ON ts.form_id = sf.id
            AND ts.slot_group_id = sg.id
            AND ts.is_active = TRUE
          WHERE sg.form_id = sf.id
            AND sg.is_active = TRUE
        )
      ORDER BY sf.is_active DESC, sf.id DESC
      LIMIT 1
    `,
    [classEventId],
  )
  if (formRes.rows.length === 0) {
    return { formId: null, offerings: [], scheduleOptions: [], classActiveDates: null }
  }
  const form = formRes.rows[0]
  form.programs_id =
    form.resolved_programs_id != null ? Number(form.resolved_programs_id) : null
  const formId = Number(form.id)
  const { effective } = await loadEffectivePricingForForm(pool, form)
  const priceCents = Number(effective.costAmountCents ?? 0)
  const costUnit = effective.costUnit || 'per_month'
  const priceLabel = formatSignupPriceLabel(priceCents, costUnit)

  const offeringsRes = await pool.query(
    `SELECT id, label, start_date, end_date FROM scheduling_offering WHERE form_id = $1 ORDER BY start_date ASC NULLS LAST, id ASC`,
    [formId],
  )
  const offerings = offeringsRes.rows
    .map((row) => ({
      id: Number(row.id),
      label: row.label,
      startDate: row.start_date,
      endDate: row.end_date,
    }))
    .sort((a, b) => {
      const sa = formatDateOnly(a.startDate) ?? ''
      const sb = formatDateOnly(b.startDate) ?? ''
      return sa.localeCompare(sb) || a.id - b.id
    })

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
      SELECT id, offering_id, active_start, active_end, dates_tbd
      FROM scheduling_slot_group
      WHERE form_id = $1 AND is_active = TRUE
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
  for (const [gid, rows] of slotsByGroup) {
    slotsByGroup.set(gid, sortOccurrenceRows(rows))
  }

  const offeringLabelById = new Map(
    offerings.map((o) => [o.id, o.label || `Offering ${o.id}`]),
  )

  const scheduleOptions = []
  for (const group of groupsRes.rows) {
    const occurrences = slotsByGroup.get(group.id) || []
    if (occurrences.length === 0) continue
    const firstSlot = occurrences[0]
    const active = resolveActiveDatesForSort(group, form)
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
      offeringStartDate: offering ? formatDateOnly(offering.startDate) : null,
      activeStart: active.activeStart,
      datesTbd: active.datesTbd,
      scheduleMode: firstSlot.schedule_mode === 'date' ? 'date' : 'day',
      specificDate: formatDateOnly(firstSlot.specific_date),
      daySort: daySortIndex(firstSlot.day_of_week),
      startTime: formatTimeOnly(firstSlot.start_time),
      scheduleLabel: buildCompactScheduleLabel(occurrences),
      priceCents: priceCents > 0 ? priceCents : null,
      priceLabel,
    })
  }

  return {
    formId,
    offerings,
    scheduleOptions: sortScheduleCatalogOptions(scheduleOptions),
    priceLabel,
    costUnit,
    classActiveDates,
  }
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
  if (!programKeysCreated.has(programKey)) {
    programKeysCreated.add(programKey)
  }

  let schedulingSignupId = null
  const schedulingFormId = Number(enrollment.schedulingFormId)
  const slotGroupId = Number(enrollment.slotGroupId)
  if (Number.isFinite(schedulingFormId) && Number.isFinite(slotGroupId)) {
    const enrollmentStartDate = requireEnrollmentStartDate(enrollment.enrollmentStartDate)
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
      enrollment_start_date: enrollmentStartDate,
    }
    const ssInsert = await client.query(
      `
        INSERT INTO scheduling_signup (
          form_id, time_slot_id, slot_group_id, member_id,
          first_name, last_name, email, phone, field_responses, responses, status,
          enrollment_start_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed', $11)
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
        enrollmentStartDate,
      ],
    )
    schedulingSignupId = Number(ssInsert.rows[0]?.id)
  }

  return {
    memberId,
    schedulingSignupId,
    programName,
    slotLabel: enrollment.scheduleLabel || '',
    status: 'confirmed',
    selectedDays: Array.isArray(enrollment.selectedDays) ? enrollment.selectedDays : [],
    enrollmentStartDate: enrollment.enrollmentStartDate || null,
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
        SELECT 1 FROM app_user
         WHERE LOWER(username) = LOWER($1)
            OR LOWER(email) = LOWER($1)
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

async function createMemberRecord(client, facilityId, familyId, memberInput, {
  parentGuardianIds = [],
  payerEmail = null,
  asOfDate = null,
} = {}) {
  const passwordHash = memberInput.password ? await bcrypt.hash(memberInput.password, 10) : null
  const dob = memberInput.dateOfBirth || memberInput.date_of_birth || null
  const minor = dob && !isAdultOnDate(dob, asOfDate)
  const address = memberInput.addressStreet || memberInput.address || null
  const requestedUsername = validateSignupUsername(memberInput.username)
  const hasCredentials = Boolean(requestedUsername && passwordHash)
  const storeUsername = hasCredentials ? requestedUsername : (!minor ? requestedUsername || null : null)
  const storedEmail = payerEmail != null
    ? resolveStoredMemberEmail(memberInput, payerEmail, asOfDate)
    : (String(memberInput.email || '').trim() || null)

  const inserted = await client.query(
    `
      INSERT INTO member (
        facility_id, family_id, first_name, last_name, email, phone,
        date_of_birth, username, password_hash,
        address, billing_street, billing_city, billing_state, billing_zip,
        gender, is_active, profile_complete, signup_source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, TRUE, TRUE, $16)
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
      null,
      address,
      memberInput.addressStreet || memberInput.billingStreet || null,
      memberInput.addressCity || memberInput.billingCity || null,
      memberInput.addressState || memberInput.billingState || null,
      memberInput.addressZip || memberInput.billingZip || null,
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

  await syncCanonicalGuardianAuthority(client, member.id, parentGuardianIds)

  if (hasCredentials && (storedEmail || memberInput.username)) {
    const fullName = `${memberInput.firstName} ${memberInput.lastName}`.trim()
    const loginConflict = await client.query(
      `SELECT id
         FROM app_user
        WHERE (
            $1::text IS NOT NULL
            AND (
              LOWER(BTRIM(email)) = LOWER(BTRIM($1))
              OR LOWER(BTRIM(username)) = LOWER(BTRIM($1))
            )
          ) OR (
            $2::text IS NOT NULL
            AND (
              LOWER(BTRIM(email)) = LOWER(BTRIM($2))
              OR LOWER(BTRIM(username)) = LOWER(BTRIM($2))
            )
          )
        LIMIT 1`,
      [storedEmail, requestedUsername || null],
    )
    if (loginConflict.rows.length > 0) {
      throw new Error('A login with this email or username already exists. Ask an administrator to link the existing login explicitly.')
    }
    const login = await client.query(
      `
        INSERT INTO app_user (
          facility_id, role, email, phone, full_name, username, password_hash, is_active, address
        )
        VALUES ($1, 'MEMBER_ATHLETE'::user_role, $2, $3, $4, $5, $6, TRUE, $7)
        RETURNING id
      `,
      [
        facilityId,
        storedEmail,
        memberInput.phone || null,
        fullName,
        requestedUsername || null,
        passwordHash,
        address,
      ],
    )
    const loginUserId = Number(login.rows[0].id)
    await client.query(
      `INSERT INTO app_user_role (user_id, role) VALUES ($1, 'MEMBER_ATHLETE'::user_role) ON CONFLICT DO NOTHING`,
      [loginUserId],
    )
    await client.query(
      `UPDATE member SET app_user_id = $2, updated_at = now() WHERE id = $1`,
      [member.id, loginUserId],
    )
    member.app_user_id = loginUserId
    member.password_hash = null
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
  responsibleMember,
  legalGuardianMemberId = null,
  input,
}) {
  const firstName = String(input?.firstName || input?.first_name || '').trim()
  const lastName = String(input?.lastName || input?.last_name || '').trim()
  if (!firstName || !lastName) {
    throw new Error('First and last name are required.')
  }

  const dob = input?.dateOfBirth || input?.date_of_birth || null
  if (!dob) {
    throw new Error('Date of birth is required so age and household access are derived correctly.')
  }
  if (!parseDateOnly(dob)) {
    throw new Error('Date of birth must be a valid calendar date in YYYY-MM-DD format.')
  }
  const signupDate = await resolveFacilitySignupDate(client, facilityId)
  const minor = !isAdultOnDate(dob, signupDate)
  const guardianId = Number(legalGuardianMemberId)
  if (minor && (!Number.isSafeInteger(guardianId) || guardianId <= 0)) {
    throw new Error('A parent or legal guardian must explicitly accept responsibility for a youth member.')
  }

  const responsibleEmail = String(responsibleMember?.email || '').trim() || null
  let email = String(input?.email || '').trim() || null
  if (minor && email && responsibleEmail && email.toLowerCase() === responsibleEmail.toLowerCase()) {
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
    parentGuardianIds: minor ? [guardianId] : [],
    payerEmail: minor ? responsibleEmail : null,
    asOfDate: signupDate,
  })

  return member
}

export async function finalizePendingDropIn(client, pendingDropInId, { primaryEmail, createdMembers }) {
  if (pendingDropInId == null) return null
  const pending = await client.query(
    `SELECT d.*, sf.title
       FROM drop_in_registration d
       JOIN scheduling_form sf ON sf.id = d.form_id
      WHERE d.id = $1 AND d.status = 'account_required' AND d.member_id IS NULL
        AND (d.expires_at IS NULL OR d.expires_at > now())
      FOR UPDATE`,
    [pendingDropInId],
  )
  const row = pending.rows[0]
  if (!row) throw new Error('Pending drop-in registration was not found or has already been completed.')
  if (String(row.email).trim().toLowerCase() !== String(primaryEmail).trim().toLowerCase()) {
    throw new Error('The family account email must match the pending drop-in registration.')
  }

  const firstName = String(row.first_name).trim().toLowerCase()
  const lastName = String(row.last_name).trim().toLowerCase()
  const match = createdMembers.find(({ member }) =>
    String(member.first_name).trim().toLowerCase() === firstName
    && String(member.last_name).trim().toLowerCase() === lastName,
  )
  if (!match) {
    throw new Error(`Add ${row.first_name} ${row.last_name} to the family account to confirm the pending drop-in.`)
  }

  const memberId = Number(match.member.id)
  await client.query(
    `UPDATE drop_in_registration
        SET member_id = $2, status = 'confirmed', updated_at = now()
      WHERE id = $1`,
    [pendingDropInId, memberId],
  )

  if (row.benefit_type === 'paid' && Number(row.amount_cents) > 0) {
    const account = await client.query(
      `SELECT id FROM family_billing_account WHERE family_id = $1 AND is_active = TRUE LIMIT 1`,
      [match.member.family_id],
    )
    if (!account.rows[0]) throw new Error('Family billing account not found for pending drop-in.')
    const baseCents = Number(row.base_price_cents)
    const amountCents = Number(row.amount_cents)
    await client.query(
      `INSERT INTO billing_charge
         (family_billing_account_id, member_id, source_type, source_id, description,
          amount_cents, gross_amount_cents, discount_amount_cents, charge_type, billing_interval,
          service_period_start, service_period_end)
       VALUES ($1,$2,'drop_in',$3,$4,$5,$6,$7,'one_time','one_time',$8,$8)
       ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING`,
      [account.rows[0].id, memberId, String(row.id), `${row.title} drop-in — ${formatDateOnly(row.class_date)}`, amountCents, baseCents, Math.max(0, baseCents - amountCents), formatDateOnly(row.class_date)],
    )
  }
  return { id: Number(row.id), memberId, status: 'confirmed', benefitType: row.benefit_type }
}

async function processFamilySignup(client, payload, options = {}) {
  const {
    facilityId: explicitFacilityId = null,
    joinExistingFamilyId = null,
    initializePendingFamilyBilling = false,
    ipAddress = null,
    userAgent = null,
  } = options

  const facilityId = await resolveFacilityId(client, explicitFacilityId)
  const signupDate = await resolveFacilitySignupDate(client, facilityId)
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
  if (!parseDateOnly(primaryAdult.dateOfBirth) || !isAdultOnDate(primaryAdult.dateOfBirth, signupDate)) {
    throw new Error('Primary account holder must be 18 or older.')
  }
  if (!validateSignupUsername(primaryAdult.username)) {
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
  const waiverSelection = await validateSignupWaiverTemplateIds(client, {
    facilityId,
    acceptedTemplateIds: waivers.acceptedTemplateIds,
  })
  const acceptedTemplateIds = waiverSelection.acceptedTemplateIds
  if (!signatureName) throw new Error('Waiver signature name is required.')

  let familyId = joinExistingFamilyId ? Number(joinExistingFamilyId) : null
  let familyUsername = null
  let familyHadMembersBefore = false
  let createdNewFamily = false

  if (familyId) {
    familyHadMembersBefore = (await countActiveFamilyMembers(client, familyId)) > 0
    const familyCheck = await client.query(
      `SELECT id, family_username FROM family WHERE id = $1 AND archived = FALSE`,
      [familyId],
    )
    if (familyCheck.rows.length === 0) throw new Error('Existing family not found.')
    familyUsername = familyCheck.rows[0].family_username
  } else {
    createdNewFamily = true
    const familyName = payload.familyName || `${primaryAdult.lastName} Family`
    familyUsername = await generateFamilyUsername(client, familyName, facilityId)
    // Family credentials are retired as an access boundary. Keep an
    // unguessable compatibility hash only while the nullable legacy column is
    // still present; never duplicate the payer's login secret into it.
    const familyPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)
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
  }, {
    asOfDate: signupDate,
  })

  await initializeSignupBillingAccount(client, {
    enabled: createdNewFamily || initializePendingFamilyBilling === true,
    populateExisting: createdNewFamily || initializePendingFamilyBilling === true,
    familyId,
    payerMemberId: payerMember.id,
    billingEmail: primaryAdult.email,
    billingPhone: primaryAdult.phone,
    billingStreet: primaryAdult.addressStreet,
    billingCity: primaryAdult.addressCity,
    billingState: primaryAdult.addressState,
    billingZip: primaryAdult.addressZip,
  })

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
    if (!merged.firstName || !merged.lastName) {
      throw new Error('Each family member needs a first and last name.')
    }
    if (!parseDateOnly(dob)) {
      throw new Error(`Date of birth is required for ${merged.firstName} ${merged.lastName}.`)
    }
    const minor = !isAdultOnDate(dob, signupDate)
    const guardians = minor ? [payerMember.id] : []

    const usesParentContact = memberUsesParentContactEmail(merged, primaryAdult.email, signupDate)
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

    if (merged.useParentPassword === true) {
      throw new Error('Family members cannot share another person\'s password. Create a separate Member Portal login or leave portal access off.')
    }
    const portalAccessRequested = merged.portalAccessRequested === true
    if (portalAccessRequested) {
      if (!merged.username?.trim()) {
        throw new Error(`Username is required to create Member Portal access for ${merged.firstName} ${merged.lastName}.`)
      }
      if (!merged.password || merged.password.length < 8) {
        throw new Error(`Password must be at least 8 characters for ${merged.firstName} ${merged.lastName}.`)
      }
      if (merged.password !== merged.confirmPassword) {
        throw new Error(`Passwords do not match for ${merged.firstName} ${merged.lastName}.`)
      }
    } else {
      merged.username = null
      merged.password = null
      merged.confirmPassword = null
    }
    const member = await createMemberRecord(client, facilityId, familyId, merged, {
      parentGuardianIds: guardians,
      payerEmail: primaryAdult.email,
      asOfDate: signupDate,
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

  const completedDropIn = await finalizePendingDropIn(client, payload.pendingDropInId, {
    primaryEmail,
    createdMembers,
  })

  await recordSignupWaiverAcceptances(client, {
    candidateMemberIds: allMemberIds,
    acceptedTemplateIds,
    facilityId,
    signerMemberId: payerMember.id,
    signatureName,
    comments: waivers.comments ?? null,
    paymentPolicyAcknowledged: waivers.paymentPolicyAcknowledged === true,
    ipAddress,
    userAgent,
    asOfDate: signupDate,
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
    completedDropIn,
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
  const access = await loadCanonicalAccessContext(pool, userId)
  if (!access?.isActive || !access.portalAccess.admin) return null
  return {
    id: access.userId,
    facility_id: access.facilityId,
    is_owner: access.isOwner,
    storage_roles: access.storageRoles,
  }
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

function adminSignupPermissionMiddleware(pool) {
  return async (req, res, next) => {
    if (req.adminAuth?.is_owner === true) return next()
    try {
      const requiredPermissions = ['members.edit']
      const requestedEnrollments = Array.isArray(req.body?.enrollments) ? req.body.enrollments : []
      if (requestedEnrollments.length > 0) requiredPermissions.push('scheduling.manage')

      const result = await pool.query(
        `WITH requested(permission_key) AS (
           SELECT UNNEST($2::text[])
         ), assigned AS (
           SELECT DISTINCT role_key
             FROM (
               SELECT account.role::text AS role_key
                 FROM app_user account
                WHERE account.id = $1
               UNION ALL
               SELECT assignment.role::text
                 FROM app_user_role assignment
                WHERE assignment.user_id = $1
             ) roles
         ), decisions AS (
           SELECT
             requested.permission_key,
             COALESCE(
               (
                 SELECT override.effect = 'allow'
                   FROM app_user_permission_override override
                   JOIN permission permission_row ON permission_row.id = override.permission_id
                  WHERE override.user_id = $1
                    AND permission_row.key = requested.permission_key
                  LIMIT 1
               ),
               EXISTS (
                 SELECT 1
                   FROM assigned
                   JOIN role role_row ON role_row.key = assigned.role_key
                   JOIN role_permission grant_row ON grant_row.role_id = role_row.id
                   JOIN permission permission_row ON permission_row.id = grant_row.permission_id
                  WHERE permission_row.key = requested.permission_key
               )
             ) AS allowed
           FROM requested
         )
         SELECT BOOL_AND(allowed) AS allowed
           FROM decisions`,
        [req.adminAuth.id, requiredPermissions],
      )
      if (result.rows[0]?.allowed !== true) {
        return res.status(403).json({
          success: false,
          message: requestedEnrollments.length > 0
            ? 'Creating an account with enrollments requires member-edit and scheduling permissions.'
            : 'Creating an account requires member-edit permission.',
        })
      }
      return next()
    } catch (error) {
      console.error('[signup] permission check failed:', error?.message || error)
      return res.status(500).json({ success: false, message: 'Permission check failed' })
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
        })
      } catch (err) {
        console.warn('[signup] enrollment receipt failed:', err?.message || err)
      }
    }

    if (result.completedDropIn?.id) {
      try {
        await sendDropInConfirmationNotifications(pool, Number(result.completedDropIn.id))
      } catch (err) {
        console.warn('[signup] drop-in confirmation notifications failed:', err?.message || err)
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
          INNER JOIN LATERAL (
            SELECT candidate.id
            FROM scheduling_form candidate
            WHERE candidate.program_id = p.id
              AND candidate.deleted_at IS NULL
              AND EXISTS (
                SELECT 1
                FROM scheduling_slot_group sg
                INNER JOIN scheduling_time_slot ts
                  ON ts.form_id = candidate.id
                  AND ts.slot_group_id = sg.id
                  AND ts.is_active = TRUE
                WHERE sg.form_id = candidate.id
                  AND sg.is_active = TRUE
              )
            ORDER BY candidate.is_active DESC, candidate.id DESC
            LIMIT 1
          ) sf ON TRUE
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
            p.${schema.programFkColumn} AS programs_id,
            p.display_name AS class_display_name,
            pr.display_name AS program_display_name
          FROM scheduling_form sf
          LEFT JOIN program p ON p.id = sf.program_id
          LEFT JOIN ${schema.programsTable} pr ON pr.id = p.${schema.programFkColumn}
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
              WHEN 'MEDIA_RELEASE' THEN 5
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

  app.post(
    '/api/admin/signup/family',
    adminAuthMiddleware(pool, jwtSecret),
    adminSignupPermissionMiddleware(pool),
    async (req, res) => {
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
    },
  )

  app.post('/api/signup/minor-start', async (req, res) => {
    const client = await pool.connect()
    try {
      const minor = req.body?.minor || req.body
      const parentEmail = String(req.body?.parentEmail || req.body?.parent_email || '').trim().toLowerCase()
      const enrollments = Array.isArray(req.body?.enrollments) ? req.body.enrollments : []

      if (!minor?.firstName || !minor?.lastName) {
        return res.status(400).json({ success: false, message: 'Minor first and last name are required.' })
      }
      if (!parseDateOnly(minor.dateOfBirth)) {
        return res.status(400).json({ success: false, message: 'Minor must be under 18.' })
      }
      if (!parentEmail) {
        return res.status(400).json({ success: false, message: 'Parent or guardian email is required.' })
      }

      await client.query('BEGIN')
      const facilityId = await resolveFacilityId(client)
      const signupDate = await resolveFacilitySignupDate(client, facilityId)
      if (isAdultOnDate(minor.dateOfBirth, signupDate)) {
        throw new Error('Minor must be under 18.')
      }
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
            is_active, signup_source
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, 'minor_invite_pending')
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
        initializePendingFamilyBilling: true,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? null,
      })

      if (Number.isFinite(minorMemberId)) {
        await syncCanonicalGuardianAuthority(client, minorMemberId, [result.payerMemberId])
        const waiverSelection = await validateSignupWaiverTemplateIds(client, {
          facilityId: invite.facility_id,
          acceptedTemplateIds: waivers.acceptedTemplateIds,
        })
        const acceptedTemplateIds = waiverSelection.acceptedTemplateIds
        if (acceptedTemplateIds.length > 0) {
          await recordSignupWaiverAcceptances(client, {
            candidateMemberIds: [minorMemberId],
            acceptedTemplateIds,
            facilityId: invite.facility_id,
            signerMemberId: result.payerMemberId,
            signatureName: String(waivers.signatureName || '').trim(),
            comments: waivers.comments ?? null,
            paymentPolicyAcknowledged: waivers.paymentPolicyAcknowledged === true,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') ?? null,
          })
        }

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
