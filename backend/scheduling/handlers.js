import crypto from 'crypto'
import Joi from 'joi'
import jwt from 'jsonwebtoken'
import { resolveJwtSecret } from '../auth/jwtSecret.js'
import {
  countActiveSignupsForMember,
  countActiveSignupsForPricingScope,
  createMemberStub,
  findMemberByEmail,
  findMemberById,
  findMemberForAppUser,
  updateMemberPassword,
} from '../members/createMemberStub.js'
import { notifyEnrollmentReceipt, notifyWelcomeNewMember } from '../email/memberNotifications.js'
import { sendDemotionEmail } from './demotionEmail.js'
import { sendMagicLinkEmail } from './magicLinkEmail.js'
import { sendPromotionEmail } from './promotionEmail.js'
import {
  generateTemporaryPassword,
  sendTemporaryPasswordEmail,
} from './tempPasswordEmail.js'
import { sendWaiverEmail } from './waiverEmail.js'
import { buildSignupOrderPreview, loadMemberScopeSignups, pricingScopeKey, WeeklyTierSlotLimitError } from './orderPricing.js'
import { persistDiscountSnapshot } from './discountEngine.js'
import { persistSignupCharges } from './persistSignupCharges.js'
import {
  safeCancelSubscriptionsForSource,
  safeReactivateSubscriptionForSource,
  safeSetSubscriptionPausedForSource,
} from './billingSubscriptions.js'
import { ensureEnrollmentLifecycleColumns, updateSignupLifecycleStatus } from './enrollmentLifecycle.js'
import { trySavepoint } from './transactionSavepoint.js'
import { buildAdminMemberEnrollments, autoCompleteEndedEnrollments } from './adminEnrollmentsView.js'
import {
  persistMultiClassPassPurchaseCharge,
  persistPassRedemptionCharge,
} from './persistMultiClassPassCharges.js'
import {
  createMemberPassPurchase,
  loadProgramPassPackages,
  redeemPassForSignup,
  safeRestorePassCreditsForSignup,
  selectPassForRedemption,
} from '../programs/multiClassPass.js'
import { countAllocatedFreeSlotsForMember } from './freeSlotAllocation.js'
import { computeMonthlyPricing, buildReceiptPricingSummary } from './pricing.js'
import {
  hoursPerMonthForEnrollment,
  loadTimeSlotsBySlotGroupIds,
} from './slotHours.js'
import { persistFreePassRedemptions } from './freePassEngine.js'
import {
  loadEffectivePricingForForm,
  loadProgramPricingRow,
  resolveEffectiveFormPricing,
} from '../programs/pricingDefaults.js'
import {
  generateMagicToken,
  issueSignupAuthToken,
  storeMagicToken,
  verifyMagicToken,
  verifyMemberPassword,
  verifySignupAuthToken,
} from './signupAuth.js'
import {
  buildSignupPositionMessage,
  computeSignupPositions,
  demoteToWaitlist,
  loadSignupContext,
  promoteFromWaitlist,
  rebalanceCapacity,
} from './waitlist.js'
import {
  DEFAULT_SIGNUP_FIELDS,
  mergeSignupFieldsForSave,
  validateSignupResponses,
} from './signupFieldCatalog.js'
import { expandSlotBatch } from './slotExpansion.js'
import { expandCalendarRange } from './calendarExpansion.js'
import {
  loadPublicSchedulingClasses,
  loadSchedulingCalendar,
  parseCalendarDateRange,
} from './calendarQuery.js'
import { linkMemberToSchoolFromName } from '../schools/handlers.js'
import { loadGroupDisplayLabels, slotLabelForSignupRow, buildSlotDisplayLabel, buildGroupDisplayLabel } from './slotDisplayLabel.js'
import { resolveSlotActiveDates } from './slotActiveDates.js'
import { sortOccurrenceRows, sortSlotGroups } from './slotSort.js'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

async function buildOrphanSnapshot(db, groupId) {
  const groupRes = await db.query(
    `
    SELECT sg.*, f.title AS form_title, f.start_date AS form_start_date, f.end_date AS form_end_date
    FROM scheduling_slot_group sg
    JOIN scheduling_form f ON f.id = sg.form_id
    WHERE sg.id = $1
    `,
    [groupId],
  )
  if (groupRes.rows.length === 0) return null

  const group = groupRes.rows[0]
  const form = { start_date: group.form_start_date, end_date: group.form_end_date }
  const slotsRes = await db.query(
    `
    SELECT * FROM scheduling_time_slot
    WHERE slot_group_id = $1
    ORDER BY week_letter NULLS LAST, day_of_week NULLS LAST, specific_date NULLS LAST, start_time, id
    `,
    [groupId],
  )
  const occurrences = slotsRes.rows
  const dates = resolveSlotActiveDates(group, form)
  return {
    formTitle: group.form_title,
    slotLabel: buildGroupDisplayLabel(occurrences),
    occurrences: occurrences.map((row) => ({
      weekLetter: row.week_letter || null,
      dayOfWeek: row.day_of_week,
      specificDate: formatDateOnly(row.specific_date),
      startTime: formatTime(row.start_time),
      endTime: formatTime(row.end_time),
      scheduleMode: row.schedule_mode || 'day',
    })),
    activeStart: dates.activeStart,
    activeEnd: dates.activeEnd,
    slotGroupId: Number(groupId),
  }
}

/** Move all signups on a group to orphaned state before slot/group delete. */
async function orphanSignupsForSlotGroup(db, groupId) {
  const snapshot = await buildOrphanSnapshot(db, groupId)
  if (!snapshot) return

  const orphaned = await db.query(
    `
    UPDATE scheduling_signup
    SET
      status_at_orphaning = status,
      orphaned_snapshot = $2::jsonb,
      orphaned_at = NOW(),
      slot_group_id = NULL,
      time_slot_id = NULL,
      status = 'cancelled'
    WHERE slot_group_id = $1 AND orphaned_at IS NULL
    RETURNING id
    `,
    [groupId, JSON.stringify(snapshot)],
  )

  // Stop future recurring billing and restore any consumed pass credits.
  for (const row of orphaned.rows) {
    await safeCancelSubscriptionsForSource(db, { sourceType: 'scheduling_signup', sourceId: row.id })
    await safeRestorePassCreditsForSignup(db, { signupId: row.id, reason: 'Class removed' })
  }
}

async function insertSignupForMember(
  client,
  {
    formId,
    formRow,
    slotGroupId,
    memberId,
    responses,
    firstOccurrenceId,
    formTitle,
    mandateWaiver,
    groupDisplayLabel,
    firstOccurrenceLabel,
    adminStub = false,
    pricingOptionKey = null,
  },
) {
  const activeCount = await countActiveSignupsForPricingScope(client, formRow, memberId)
  const { effectiveDbRow } = await loadEffectivePricingForForm(client, formRow)
  const maxSlots =
    effectiveDbRow.max_slots_per_user != null ? Number(effectiveDbRow.max_slots_per_user) : null
  if (maxSlots != null && activeCount >= maxSlots) {
    const err = new Error(
      `Maximum of ${maxSlots} slot${maxSlots === 1 ? '' : 's'} reached for this form`,
    )
    err.code = 'MAX_SLOTS'
    throw err
  }

  const lock = await client.query(
    `
    SELECT sg.max_participants,
      (SELECT COUNT(*)::int FROM scheduling_signup s
       WHERE s.slot_group_id = sg.id AND s.status = 'confirmed') AS signup_count
    FROM scheduling_slot_group sg
    WHERE sg.id = $1 AND sg.form_id = $2 AND sg.is_active = TRUE
    FOR UPDATE OF sg
    `,
    [slotGroupId, formId],
  )

  if (lock.rows.length === 0) {
    const err = new Error('Time slot not available')
    err.code = 'SLOT_UNAVAILABLE'
    throw err
  }

  const { max_participants, signup_count } = lock.rows[0]
  const signupStatus =
    Number(signup_count) < Number(max_participants) ? 'confirmed' : 'waitlisted'

  const insert = await client.query(
    `
    INSERT INTO scheduling_signup
      (form_id, time_slot_id, slot_group_id, member_id,
       first_name, last_name, email, phone, field_responses, responses, status, admin_stub,
       pricing_option_key)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *
    `,
    [
      formId,
      firstOccurrenceId,
      slotGroupId,
      memberId,
      responses.first_name || null,
      responses.last_name || null,
      responses.email || null,
      responses.phone || null,
      JSON.stringify(responses),
      JSON.stringify(responses),
      signupStatus,
      adminStub,
      pricingOptionKey || null,
    ],
  )

  const signupId = insert.rows[0].id
  const positions = await computeSignupPositions(client, slotGroupId, signupId)
  const totalSlotsAfter = activeCount + 1
  const freeGranted = await countAllocatedFreeSlotsForMember(
    client,
    formRow,
    memberId,
    effectiveDbRow,
  )

  const pricingOptions = {}
  if ((effectiveDbRow?.cost_unit ?? 'per_month') === 'per_hour') {
    const memberSignups = await loadMemberScopeSignups(client, formRow, memberId)
    const groupIds = [...new Set(memberSignups.map((s) => s.slotGroupId))]
    const timeSlotsByGroup = await loadTimeSlotsBySlotGroupIds(client, groupIds)
    pricingOptions.slotHoursPerMonth = memberSignups.map((s) =>
      hoursPerMonthForEnrollment(timeSlotsByGroup.get(s.slotGroupId) || [], {
        timeSlotId: s.timeSlotId,
      }),
    )
  }

  const pricing = computeMonthlyPricing(
    effectiveDbRow,
    totalSlotsAfter,
    freeGranted,
    pricingOptions,
  )
  positions.pricing = pricing

  return {
    signupRow: insert.rows[0],
    signupId,
    signupStatus,
    positions,
    pricing,
    slotLabel: groupDisplayLabel || firstOccurrenceLabel || '',
    formTitle,
    mandateWaiver,
    responses,
  }
}

async function sendSignupNotificationEmails(pool, {
  signupStatus,
  signupId,
  memberId,
  responses,
  formTitle,
  slotLabel,
  pricing,
  mandateWaiver,
}) {
  let confirmationEmailSentAt = null
  let waiverEmailSentAt = null

  if (memberId) {
    try {
      const receipt = await notifyEnrollmentReceipt(pool, {
        memberId: Number(memberId),
        programName: formTitle || 'Class',
        slotLabel: slotLabel || '',
        status: signupStatus === 'waitlisted' ? 'waitlisted' : 'confirmed',
        schedulingSignupId: signupId,
        athleteName: `${responses.first_name || ''} ${responses.last_name || ''}`.trim() || undefined,
        pricingSummary: buildReceiptPricingSummary(pricing),
      })
      if (receipt.sent) confirmationEmailSentAt = new Date().toISOString()
    } catch (emailErr) {
      console.error('[scheduling] enrollment receipt email failed:', emailErr.message)
    }
  }

  if (mandateWaiver) {
    try {
      await sendWaiverEmail({
        parentFirstName: String(responses.parent_first_name || ''),
        parentEmail: String(responses.parent_email || ''),
        athleteFirstName: String(responses.first_name || ''),
        athleteLastName: String(responses.last_name || ''),
        formTitle,
      })
      waiverEmailSentAt = new Date().toISOString()
    } catch (emailErr) {
      console.error('[scheduling] waiver email failed:', emailErr.message)
    }
  }

  if (confirmationEmailSentAt || waiverEmailSentAt) {
    await pool.query(
      `
      UPDATE scheduling_signup
      SET confirmation_email_sent_at = COALESCE($1, confirmation_email_sent_at),
          waiver_email_sent_at = COALESCE($2, waiver_email_sent_at)
      WHERE id = $3
      `,
      [confirmationEmailSentAt, waiverEmailSentAt, signupId],
    )
  }
}

async function notifyEnrollmentReceiptForSignup(pool, signupId, statusOverride) {
  const ctx = await loadSignupContext(pool, signupId)
  if (!ctx?.signup?.member_id) return { sent: false }

  const signup = ctx.signup
  const status =
    statusOverride ?? (signup.status === 'waitlisted' ? 'waitlisted' : 'confirmed')
  const responses =
    signup.responses && Object.keys(signup.responses).length > 0
      ? signup.responses
      : signup.field_responses || {}

  return notifyEnrollmentReceipt(pool, {
    memberId: Number(signup.member_id),
    programName: ctx.formTitle || 'Class',
    slotLabel: ctx.slotLabel || '',
    status,
    schedulingSignupId: signupId,
    athleteName:
      `${responses.first_name || ctx.registrantFirstName || ''} ${responses.last_name || ''}`.trim() ||
      undefined,
  })
}

function mapOrphanedSignupRow(row) {
  const responses = row.responses && Object.keys(row.responses).length > 0
    ? row.responses
    : row.field_responses || {}
  const snapshot = row.orphaned_snapshot || {}
  return {
    id: Number(row.id),
    formId: Number(row.form_id),
    formTitle: row.form_title || snapshot.formTitle || '',
    memberId: row.member_id != null ? Number(row.member_id) : null,
    firstName: responses.first_name || row.first_name,
    lastName: responses.last_name || row.last_name,
    email: responses.email || row.email,
    phone: responses.phone || row.phone,
    statusAtOrphaning: row.status_at_orphaning,
    orphanedAt: row.orphaned_at,
    orphanedSnapshot: snapshot,
  }
}

function formatTime(t) {
  if (!t) return null
  const s = String(t)
  return s.length >= 5 ? s.slice(0, 5) : s
}

function formatDateOnly(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const d = String(value.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

async function isFormLinkedToActiveEvent(pool, formId) {
  const result = await pool.query(
    `
    SELECT id FROM events
    WHERE scheduling_form_id = $1
      AND COALESCE(archived, FALSE) = FALSE
    LIMIT 1
    `,
    [formId],
  )
  return result.rows.length > 0
}

function parseSignupFields(row) {
  const raw = row.signup_fields
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return [...DEFAULT_SIGNUP_FIELDS]
    }
  }
  return [...DEFAULT_SIGNUP_FIELDS]
}

function mapFormRow(row, programRow = null) {
  const effective = resolveEffectiveFormPricing(programRow, row)
  const enrollSites = Array.isArray(row.enroll_sites)
    ? row.enroll_sites
    : row.is_active
      ? ['athletics', 'gymnastics', 'basketball']
      : []
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    startDate: formatDateOnly(row.start_date),
    endDate: formatDateOnly(row.end_date),
    signupFields: parseSignupFields(row),
    mandateWaiver: Boolean(row.mandate_waiver),
    isActive: row.is_active,
    enrollSites,
    programsId: row.programs_id != null ? Number(row.programs_id) : null,
    pricingOverridesProgram: effective.pricingOverridesProgram,
    maxSlotsPerUser: effective.maxSlotsPerUser,
    slotCostMonthlyCents: effective.slotCostMonthlyCents,
    freeSlotsPerUser: effective.freeSlotsPerUser,
    maxFreeSlotsTotal: effective.maxFreeSlotsTotal,
    formMaxSlotsPerUser: effective.formMaxSlotsPerUser,
    formSlotCostMonthlyCents: effective.formSlotCostMonthlyCents,
    formFreeSlotsPerUser: effective.formFreeSlotsPerUser,
    formMaxFreeSlotsTotal: effective.formMaxFreeSlotsTotal,
    programMaxSlotsPerUser: effective.programMaxSlotsPerUser,
    programSlotCostMonthlyCents: effective.programSlotCostMonthlyCents,
    programFreeSlotsPerUser: effective.programFreeSlotsPerUser,
    programMaxFreeSlotsTotal: effective.programMaxFreeSlotsTotal,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function mapFormRowWithPricing(db, row) {
  const programRow =
    row.programs_id != null ? await loadProgramPricingRow(db, Number(row.programs_id)) : null
  return mapFormRow(row, programRow)
}

function programClassOptionKey(formId) {
  return `${formId}`
}

function programSlotSignupKey(formId, slotGroupId, timeSlotId) {
  return `${formId}:${slotGroupId}:${timeSlotId ?? 'none'}`
}

function buildProgramClassOptionsFromDetail(detail, { signedUpSlotKeys = null } = {}) {
  const slots = []
  for (const group of detail.slotGroups) {
    for (const occ of group.occurrences) {
      const slotKey = programSlotSignupKey(detail.id, group.id, occ.id)
      slots.push({
        slotGroupId: group.id,
        timeSlotId: occ.id,
        label: group.displayLabel || occ.displayLabel || '',
        isFull: group.isFull,
        spotsRemaining: group.spotsRemaining,
        waitlistCount: group.waitlistCount ?? 0,
        alreadySignedUp: signedUpSlotKeys?.has(slotKey) ?? false,
        scheduleMode: occ.scheduleMode || group.scheduleMode || 'day',
        dayOfWeek: occ.dayOfWeek ?? null,
        dayName: occ.dayName ?? null,
        specificDate: occ.specificDate ?? null,
        startTime: occ.startTime,
        endTime: occ.endTime,
        weekLetter: occ.weekLetter ?? null,
      })
    }
  }
  if (slots.length === 0) return []
  return [{
    key: programClassOptionKey(detail.id),
    formId: detail.id,
    formTitle: detail.title,
    slots,
  }]
}

async function loadFormProgramsId(pool, formId) {
  const res = await pool.query(
    'SELECT programs_id FROM scheduling_form WHERE id = $1',
    [formId],
  )
  return res.rows[0]?.programs_id != null ? Number(res.rows[0].programs_id) : null
}

async function issueSignupAuthForForm(pool, formId, member) {
  const programsId = await loadFormProgramsId(pool, formId)
  return issueSignupAuthToken({
    formId,
    memberId: member.id,
    email: member.email,
    programsId,
  })
}

async function resolveSignupEntryForInsert(pool, entry) {
  const formRes = await pool.query('SELECT * FROM scheduling_form WHERE id = $1', [entry.formId])
  if (formRes.rows.length === 0 || formRes.rows[0].deleted_at || !formRes.rows[0].is_active) {
    const err = new Error('Scheduling form not available')
    err.code = 'FORM_UNAVAILABLE'
    throw err
  }
  const formRow = formRes.rows[0]
  const detail = await loadFormDetail(pool, entry.formId)
  if (!detail) {
    const err = new Error('Scheduling form not available')
    err.code = 'FORM_UNAVAILABLE'
    throw err
  }

  const group = detail.slotGroups.find((g) => g.id === entry.slotGroupId)
  if (!group) {
    const err = new Error('Invalid time slot group')
    err.code = 'INVALID_ENTRY'
    throw err
  }

  const firstOccurrence =
    (entry.timeSlotId != null
      ? group.occurrences.find((o) => o.id === entry.timeSlotId)
      : null) ?? group.occurrences[0]
  if (!firstOccurrence) {
    const err = new Error('Time slot has no schedule entries')
    err.code = 'INVALID_ENTRY'
    throw err
  }
  if (entry.timeSlotId != null && firstOccurrence.id !== entry.timeSlotId) {
    const err = new Error('Invalid time slot selection')
    err.code = 'INVALID_ENTRY'
    throw err
  }

  return {
    formRow,
    detail,
    group,
    firstOccurrence,
  }
}

function mapOfferingRow(row) {
  const endDate = row.end_date ? formatDateOnly(row.end_date) : null
  return {
    id: Number(row.id),
    formId: Number(row.form_id),
    startDate: formatDateOnly(row.start_date),
    endDate,
    evergreen: endDate == null,
    label: row.label,
    isSelected: Boolean(row.is_selected),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function validateOfferingDateRange(startDate, endDate, evergreen) {
  const start = formatDateOnly(startDate)
  if (!start) return { ok: false, message: 'Invalid start date' }
  if (evergreen) return { ok: true, startDate: start, endDate: null }
  const end = formatDateOnly(endDate)
  if (!end) return { ok: false, message: 'Invalid end date' }
  if (end < start) {
    return { ok: false, message: 'End date must be on or after the start date.' }
  }
  return { ok: true, startDate: start, endDate: end }
}

async function syncOfferingDatesToSlotGroups(client, offeringId, { newStart, newEnd, oldStart, oldEnd }) {
  const groupRes = await client.query(
    `
    UPDATE scheduling_slot_group sg
    SET active_start = $2,
        active_end = $3,
        updated_at = now()
    WHERE sg.offering_id = $1
      AND sg.dates_tbd = FALSE
      AND (
        sg.inherits_offering_dates = TRUE
        OR (
          sg.active_start IS NOT DISTINCT FROM $4::date
          AND sg.active_end IS NOT DISTINCT FROM $5::date
        )
      )
    RETURNING id
    `,
    [offeringId, newStart, newEnd, oldStart, oldEnd],
  )
  const groupIds = groupRes.rows.map((r) => r.id)
  if (groupIds.length === 0) return 0

  await client.query(
    `
    UPDATE scheduling_time_slot ts
    SET active_start = $2,
        active_end = $3,
        updated_at = now()
    WHERE ts.slot_group_id = ANY($1::bigint[])
      AND ts.dates_tbd = FALSE
      AND (
        (ts.active_start IS NULL AND ts.active_end IS NULL)
        OR (
          ts.active_start IS NOT DISTINCT FROM $4::date
          AND ts.active_end IS NOT DISTINCT FROM $5::date
        )
      )
    `,
    [groupIds, newStart, newEnd, oldStart, oldEnd],
  )
  return groupIds.length
}

function mapSlotRow(
  row,
  signupCount = 0,
  form = null,
  offeringById = null,
  groupRow = null,
  siblingRows = null,
) {
  const max = Number(row.max_participants)
  const count = Number(signupCount)
  let dates = resolveSlotActiveDates(row, form, offeringById)
  if (
    groupRow?.inherits_offering_dates &&
    !row.dates_tbd &&
    !row.active_start &&
    !row.active_end
  ) {
    dates = resolveSlotActiveDates(groupRow, form, offeringById)
  }
  const dayOfWeek = row.day_of_week
  return {
    id: Number(row.id),
    slotGroupId: row.slot_group_id != null ? Number(row.slot_group_id) : null,
    formId: Number(row.form_id),
    scheduleMode: row.schedule_mode || 'day',
    weekLetter: row.week_letter || null,
    dayOfWeek: dayOfWeek,
    dayName: dayOfWeek != null ? DAY_NAMES[dayOfWeek] : null,
    specificDate: formatDateOnly(row.specific_date),
    startTime: formatTime(row.start_time),
    endTime: formatTime(row.end_time),
    maxParticipants: max,
    signupCount: count,
    spotsRemaining: Math.max(0, max - count),
    isFull: count >= max,
    activeStart: dates.activeStart,
    activeEnd: dates.activeEnd,
    datesTbd: dates.datesTbd,
    inheritsFormDates: dates.inheritsFormDates,
    inheritsOfferingDates: dates.inheritsOfferingDates,
    isActive: row.is_active,
    displayLabel: buildSlotDisplayLabel(row, { siblingRows: siblingRows ?? undefined }),
  }
}

function mapSlotGroupRow(
  groupRow,
  occurrenceRows,
  signupCount,
  form,
  waitlistCount = 0,
  offeringById = null,
) {
  const max = Number(groupRow.max_participants)
  const count = Number(signupCount)
  const waitlist = Number(waitlistCount)
  const dates = resolveSlotActiveDates(groupRow, form, offeringById)
  const sortedOccurrenceRows = sortOccurrenceRows(occurrenceRows || [])
  const occurrences = sortedOccurrenceRows.map((row) =>
    mapSlotRow(row, 0, form, offeringById, groupRow, sortedOccurrenceRows),
  )
  return {
    id: Number(groupRow.id),
    formId: Number(groupRow.form_id),
    offeringId: groupRow.offering_id != null ? Number(groupRow.offering_id) : null,
    scheduleMode: groupRow.schedule_mode || 'day',
    maxParticipants: max,
    signupCount: count,
    waitlistCount: waitlist,
    spotsRemaining: Math.max(0, max - count),
    isFull: count >= max,
    hasWaitlist: waitlist > 0,
    activeStart: dates.activeStart,
    activeEnd: dates.activeEnd,
    datesTbd: dates.datesTbd,
    inheritsFormDates: dates.inheritsFormDates,
    inheritsOfferingDates: dates.inheritsOfferingDates,
    isActive: groupRow.is_active,
    displayLabel: buildGroupDisplayLabel(sortedOccurrenceRows),
    occurrences,
  }
}

function filterSlotRowsByVisibility(rows, _form, includeInactive) {
  if (includeInactive) return rows
  const today = new Date().toISOString().slice(0, 10)
  return rows.filter((slot) => {
    if (slot.dates_tbd) return true
    const activeEnd =
      formatDateOnly(slot.active_end) ?? formatDateOnly(slot.end_date) ?? null
    // Hide only after a slot has ended — allow signup before active_start.
    if (activeEnd && activeEnd < today) return false
    return true
  })
}

function buildSchedulePreview(timeSlots) {
  const daySlots = timeSlots.filter((s) => s.scheduleMode === 'day')
  const dateSlots = timeSlots.filter((s) => s.scheduleMode === 'date')

  const weekMap = new Map()
  for (const slot of daySlots) {
    const letter = slot.weekLetter || 'A'
    if (!weekMap.has(letter)) weekMap.set(letter, new Map())
    const dayMap = weekMap.get(letter)
    const dayKey = slot.dayOfWeek ?? -1
    if (!dayMap.has(dayKey)) dayMap.set(dayKey, { dayName: slot.dayName, times: [] })
    dayMap.get(dayKey).times.push({ startTime: slot.startTime, endTime: slot.endTime })
  }

  const weeks = [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekLetter, dayMap]) => ({
      weekLetter,
      days: [...dayMap.values()].sort((a, b) => {
        const ai = DAY_NAMES.indexOf(a.dayName)
        const bi = DAY_NAMES.indexOf(b.dayName)
        return ai - bi
      }),
    }))

  const datesByDate = new Map()
  for (const slot of dateSlots) {
    const d = slot.specificDate || 'TBD'
    if (!datesByDate.has(d)) datesByDate.set(d, [])
    datesByDate.get(d).push({ startTime: slot.startTime, endTime: slot.endTime })
  }

  return {
    weeks,
    specificDates: [...datesByDate.entries()].map(([date, times]) => ({ date, times })),
  }
}

function mapSignupRow(row, positions = {}) {
  const responses = row.responses && Object.keys(row.responses).length > 0
    ? row.responses
    : row.field_responses || {}
  return {
    id: Number(row.id),
    formId: Number(row.form_id),
    memberId: row.member_id != null ? Number(row.member_id) : null,
    timeSlotId: row.time_slot_id != null ? Number(row.time_slot_id) : null,
    slotGroupId: row.slot_group_id != null ? Number(row.slot_group_id) : null,
    responses,
    firstName: responses.first_name || row.first_name,
    lastName: responses.last_name || row.last_name,
    email: responses.email || row.email,
    phone: responses.phone || row.phone,
    status: row.status,
    signupNumber: positions.signupNumber ?? null,
    maxParticipants: positions.maxParticipants ?? null,
    waitlistPosition: positions.waitlistPosition ?? null,
    totalSlotsForUser: row.total_slots_for_user != null ? Number(row.total_slots_for_user) : undefined,
    profileComplete: row.profile_complete != null ? Boolean(row.profile_complete) : undefined,
    adminStub: Boolean(row.admin_stub),
    createdAt: row.created_at,
    slotLabel: row.slot_label,
    formTitle: row.form_title,
    confirmationEmailSentAt: row.confirmation_email_sent_at || null,
    waiverEmailSentAt: row.waiver_email_sent_at || null,
    promotionEmailSentAt: row.promotion_email_sent_at || null,
    demotionEmailSentAt: row.demotion_email_sent_at || null,
    archivedAt: row.archived_at || null,
    pricing: positions.pricing ?? undefined,
  }
}

async function attachPositionsToSignups(db, rows) {
  const groupIds = [...new Set(rows.map((r) => r.slot_group_id).filter(Boolean))]
  const positionMap = new Map()

  for (const groupId of groupIds) {
    const maxRes = await db.query(
      'SELECT max_participants FROM scheduling_slot_group WHERE id = $1',
      [groupId],
    )
    const maxParticipants = Number(maxRes.rows[0]?.max_participants ?? 0)
    const posRes = await db.query(
      `
      SELECT id, status,
        ROW_NUMBER() OVER (PARTITION BY status ORDER BY created_at, id) AS rn
      FROM scheduling_signup
      WHERE slot_group_id = $1 AND status IN ('confirmed', 'waitlisted')
      `,
      [groupId],
    )
    for (const p of posRes.rows) {
      positionMap.set(Number(p.id), {
        signupNumber: p.status === 'confirmed' ? Number(p.rn) : null,
        waitlistPosition: p.status === 'waitlisted' ? Number(p.rn) : null,
        maxParticipants,
      })
    }
  }

  return rows.map((row) => mapSignupRow(row, positionMap.get(Number(row.id)) || {}))
}

async function sendPromotionEmails(db, promotedRows) {
  for (const row of promotedRows) {
    const ctx = await loadSignupContext(db, row.id)
    if (!ctx?.registrantEmail) continue
    const positions = await computeSignupPositions(db, row.slot_group_id, row.id)
    try {
      await sendPromotionEmail({
        registrantFirstName: ctx.registrantFirstName,
        registrantEmail: ctx.registrantEmail,
        formTitle: ctx.formTitle,
        slotLabel: ctx.slotLabel,
        signupNumber: positions.signupNumber,
        maxParticipants: positions.maxParticipants,
      })
      await db.query(
        'UPDATE scheduling_signup SET promotion_email_sent_at = now() WHERE id = $1',
        [row.id],
      )
    } catch (emailErr) {
      console.error('[scheduling] promotion email failed:', emailErr.message)
    }
  }
}

async function sendDemotionEmails(db, demotedRows) {
  for (const row of demotedRows) {
    const ctx = await loadSignupContext(db, row.id)
    if (!ctx?.registrantEmail) continue
    const positions = await computeSignupPositions(db, row.slot_group_id, row.id)
    try {
      await sendDemotionEmail({
        registrantFirstName: ctx.registrantFirstName,
        registrantEmail: ctx.registrantEmail,
        formTitle: ctx.formTitle,
        slotLabel: ctx.slotLabel,
        waitlistPosition: positions.waitlistPosition,
      })
      await db.query(
        'UPDATE scheduling_signup SET demotion_email_sent_at = now() WHERE id = $1',
        [row.id],
      )
    } catch (emailErr) {
      console.error('[scheduling] demotion email failed:', emailErr.message)
    }
  }
}

async function loadFormDetail(
  pool,
  formId,
  { includeInactive = false, site = null } = {},
) {
  const formRes = await pool.query('SELECT * FROM scheduling_form WHERE id = $1', [formId])
  if (formRes.rows.length === 0) return null

  const form = formRes.rows[0]
  if (form.deleted_at) return null
  if (!includeInactive) {
    if (site) {
      const { rowVisibleOnEnrollSite } = await import('./enrollSites.js')
      if (!rowVisibleOnEnrollSite(form.enroll_sites, form.is_active, site)) return null
    } else if (!form.is_active) {
      return null
    }
  }

  const slotParams = [formId]
  const groupWhere = includeInactive
    ? `sg.form_id = $1`
    : `sg.form_id = $1 AND sg.is_active = TRUE`

  const groupsRes = await pool.query(
    `
    SELECT sg.*,
      COALESCE((
        SELECT COUNT(*)::int FROM scheduling_signup s
        WHERE s.slot_group_id = sg.id AND s.status = 'confirmed'
      ), 0) AS signup_count,
      COALESCE((
        SELECT COUNT(*)::int FROM scheduling_signup s
        WHERE s.slot_group_id = sg.id AND s.status = 'waitlisted'
      ), 0) AS waitlist_count
    FROM scheduling_slot_group sg
    WHERE ${groupWhere}
    ORDER BY sg.id
    `,
    slotParams,
  )

  const slotWhere = includeInactive ? 'ts.form_id = $1' : 'ts.form_id = $1 AND ts.is_active = TRUE'
  const slotsRes = await pool.query(
    `
    SELECT ts.*
    FROM scheduling_time_slot ts
    WHERE ${slotWhere}
    ORDER BY ts.slot_group_id, ts.week_letter NULLS LAST, ts.day_of_week NULLS LAST,
      ts.specific_date NULLS LAST, ts.start_time, ts.id
    `,
    slotParams,
  )

  const filteredOccurrences = filterSlotRowsByVisibility(slotsRes.rows, form, includeInactive)
  const occurrencesByGroup = new Map()
  for (const row of filteredOccurrences) {
    const gid = row.slot_group_id
    if (gid == null) continue
    if (!occurrencesByGroup.has(gid)) occurrencesByGroup.set(gid, [])
    occurrencesByGroup.get(gid).push(row)
  }

  const offeringsRes = await pool.query(
    'SELECT * FROM scheduling_offering WHERE form_id = $1',
    [formId],
  )
  const offeringById = new Map(offeringsRes.rows.map((o) => [Number(o.id), o]))

  const slotGroups = sortSlotGroups(
    groupsRes.rows
      .filter((g) => (occurrencesByGroup.get(g.id) || []).length > 0)
      .map((g) =>
        mapSlotGroupRow(
          g,
          occurrencesByGroup.get(g.id),
          g.signup_count,
          form,
          g.waitlist_count,
          offeringById,
        ),
      ),
  )

  const timeSlots = filteredOccurrences.map((s) => {
    const group = groupsRes.rows.find((g) => g.id === s.slot_group_id)
    const groupCount = group ? Number(group.signup_count) : 0
    return mapSlotRow(s, groupCount, form, offeringById, group ?? null)
  })

  let programRow = null
  if (form.programs_id != null) {
    // Ensure pricing columns (pricing_cost_options, multi_class_pass_packages) exist before
    // reading them — the public offerings/enroll path can be hit on a fresh boot before any
    // program-management route has lazily applied migrations 048/049.
    try {
      const { ensureProgramPricingColumns } = await import('../programs/schema.js')
      await ensureProgramPricingColumns(pool)
    } catch (err) {
      console.warn('[scheduling] ensureProgramPricingColumns:', err.message)
    }
    programRow = await loadProgramPricingRow(pool, Number(form.programs_id))
  }

  return {
    ...mapFormRow(form, programRow),
    slotGroups,
    timeSlots,
    schedulePreview: buildSchedulePreview(timeSlots),
  }
}

const formSchema = Joi.object({
  title: Joi.string().trim().min(1).max(255).required(),
  description: Joi.string().trim().allow('', null).optional(),
  startDate: Joi.alternatives().try(Joi.date().iso(), Joi.string().allow('')).allow(null).optional(),
  endDate: Joi.alternatives().try(Joi.date().iso(), Joi.string().allow('')).allow(null).optional(),
  isActive: Joi.boolean().optional(),
  maxSlotsPerUser: Joi.number().integer().min(1).allow(null).optional(),
  slotCostMonthlyCents: Joi.number().integer().min(0).optional(),
  costUnit: Joi.string()
    .valid('per_slot', 'per_class', 'per_week', 'per_month', 'per_offering', 'per_hour')
    .optional(),
  freeSlotsPerUser: Joi.number().integer().min(0).optional(),
  maxFreeSlotsTotal: Joi.number().integer().min(0).allow(null).optional(),
  pricingOverridesProgram: Joi.boolean().optional(),
})

function sanitizeOfferingBody(body = {}) {
  const input = { ...(body ?? {}) }
  if (input.evergreen) {
    delete input.endDate
  }
  return input
}

const offeringSchema = Joi.object({
  startDate: Joi.string().required(),
  evergreen: Joi.boolean().valid(true).optional(),
  endDate: Joi.string().allow('', null).optional(),
  label: Joi.string().max(255).allow('', null).optional(),
})

const offeringUpdateSchema = Joi.object({
  startDate: Joi.string().optional(),
  evergreen: Joi.boolean().valid(true).optional(),
  endDate: Joi.string().allow('', null).optional(),
  label: Joi.string().max(255).allow('', null).optional(),
})

const signupFieldsSchema = Joi.object({
  signupFields: Joi.array().items(Joi.string().trim().min(1)).min(1).required(),
  mandateWaiver: Joi.boolean().optional(),
})

const timeBlockSchema = Joi.object({
  startTime: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).required(),
  endTime: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).required(),
  maxParticipants: Joi.number().integer().min(1).optional(),
})

const slotBatchSchema = Joi.object({
  offeringId: Joi.number().integer().allow(null).optional(),
  activeDatesMode: Joi.string().valid('inherit', 'custom', 'tbd').required(),
  activeStart: Joi.string().allow(null, '').optional(),
  activeEnd: Joi.string().allow(null, '').optional(),
  scheduleMode: Joi.string().valid('day', 'date').required(),
  maxParticipants: Joi.number().integer().min(1).default(10),
  daySchedule: Joi.when('scheduleMode', {
    is: 'day',
    then: Joi.object({
      weeks: Joi.array().items(
        Joi.object({
          weekLetter: Joi.string().max(2).required(),
          days: Joi.array().items(
            Joi.object({
              dayOfWeek: Joi.number().integer().min(0).max(6).required(),
              activeStart: Joi.string().allow(null, '').optional(),
              activeEnd: Joi.string().allow(null, '').optional(),
              times: Joi.array().items(timeBlockSchema).min(1).required(),
            }),
          ).min(1).required(),
        }),
      ).min(1).required(),
    }).required(),
    otherwise: Joi.optional(),
  }),
  dateSchedule: Joi.when('scheduleMode', {
    is: 'date',
    then: Joi.object({
      entries: Joi.array().items(
        Joi.object({
          type: Joi.string().valid('single', 'range').required(),
          date: Joi.when('type', { is: 'single', then: Joi.string().required(), otherwise: Joi.optional() }),
          startDate: Joi.when('type', { is: 'range', then: Joi.string().required(), otherwise: Joi.optional() }),
          endDate: Joi.when('type', { is: 'range', then: Joi.string().required(), otherwise: Joi.optional() }),
          times: Joi.array().items(timeBlockSchema).min(1).required(),
        }),
      ).min(1).required(),
    }).required(),
    otherwise: Joi.optional(),
  }),
})

const signupSchema = Joi.object({
  formId: Joi.number().integer().required(),
  slotGroupId: Joi.number().integer().required(),
  timeSlotId: Joi.number().integer().optional(),
  responses: Joi.object().default({}),
  signupAuthToken: Joi.string().trim().optional(),
  password: Joi.string().min(6).optional(),
  promoCodes: Joi.array().items(Joi.string().trim().max(100)).max(10).default([]),
}).custom((val, helpers) => {
  if (!val.signupAuthToken && !val.password) {
    return helpers.error('any.custom', { message: 'Sign in or set an account password to continue' })
  }
  if (val.signupAuthToken && val.password) {
    return helpers.error('any.custom', { message: 'Provide either sign-in session or new password, not both' })
  }
  return val
})

const slotSignupItemSchema = Joi.object({
  lineType: Joi.string().valid('slot').default('slot'),
  formId: Joi.number().integer().required(),
  slotGroupId: Joi.number().integer().required(),
  timeSlotId: Joi.number().integer().optional(),
  selectedPricingOptionKey: Joi.string().trim().optional(),
  useMultiClassPass: Joi.boolean().optional(),
})

const passSignupItemSchema = Joi.object({
  lineType: Joi.string().valid('multi_class_pass').required(),
  programsId: Joi.number().integer().required(),
  packageId: Joi.string().trim().required(),
})

const signupItemSchema = Joi.alternatives().try(passSignupItemSchema, slotSignupItemSchema)

const batchSignupSchema = Joi.object({
  signups: Joi.array().items(signupItemSchema).min(1).max(20).required(),
  responses: Joi.object().default({}),
  signupAuthToken: Joi.string().trim().optional(),
  password: Joi.string().min(6).optional(),
  promoCodes: Joi.array().items(Joi.string().trim().max(100)).max(10).default([]),
}).custom((val, helpers) => {
  if (!val.signupAuthToken && !val.password) {
    return helpers.error('any.custom', { message: 'Sign in or set an account password to continue' })
  }
  if (val.signupAuthToken && val.password) {
    return helpers.error('any.custom', { message: 'Provide either sign-in session or new password, not both' })
  }
  return val
})

const programOptionsQuerySchema = Joi.object({
  email: Joi.string().email().optional(),
})

const adminSignupSchema = Joi.object({
  formId: Joi.number().integer().required(),
  slotGroupId: Joi.number().integer().required(),
  timeSlotId: Joi.number().integer().optional(),
  memberId: Joi.number().integer().optional(),
  email: Joi.string().email().optional(),
  firstName: Joi.string().trim().optional(),
  lastName: Joi.string().trim().optional(),
  phone: Joi.string().trim().allow('', null).optional(),
  responses: Joi.object().default({}),
  sendEmails: Joi.boolean().default(true),
}).custom((val, helpers) => {
  if (!val.memberId && !val.email) {
    return helpers.error('any.custom', { message: 'memberId or email required' })
  }
  return val
})

function signupResponsesFromRow(row) {
  return row.responses && Object.keys(row.responses).length > 0
    ? row.responses
    : row.field_responses || {}
}

function computeAdminStub(profileComplete, signupFields, responses, mandateWaiver) {
  if (!profileComplete) return true
  const errors = validateSignupResponses(signupFields, responses, { mandateWaiver })
  return errors.length > 0
}

function effectiveAdminStub(row, signupFields, mandateWaiver) {
  if (!row.admin_stub) return false
  const responses = signupResponsesFromRow(row)
  const profileComplete = row.profile_complete != null ? Boolean(row.profile_complete) : false
  return computeAdminStub(profileComplete, signupFields, responses, mandateWaiver)
}

const checkEmailSchema = Joi.object({
  formId: Joi.number().integer().required(),
  email: Joi.string().email().required(),
})

const memberSignupsSchema = Joi.object({
  email: Joi.string().email().required(),
})

const orderPreviewSchema = Joi.object({
  formId: Joi.number().integer().required(),
  email: Joi.string().email().optional(),
  signupAuthToken: Joi.string().trim().optional(),
  signups: Joi.array().items(signupItemSchema).max(20).default([]),
  promoCodes: Joi.array().items(Joi.string().trim().max(100)).max(10).default([]),
  currentSchool: Joi.string().trim().allow('', null).max(200).optional(),
  graduationYear: Joi.number().integer().min(2000).max(2100).allow(null).optional(),
}).custom((val, helpers) => {
  if (!val.signupAuthToken && !val.email) {
    return helpers.error('any.custom', { message: 'Email or sign-in session is required' })
  }
  return val
})

const authLoginSchema = Joi.object({
  formId: Joi.number().integer().required(),
  email: Joi.string().email().required(),
  password: Joi.string().required(),
})

const magicLinkSchema = Joi.object({
  formId: Joi.number().integer().required(),
  email: Joi.string().email().required(),
})

const verifyTokenSchema = Joi.object({
  formId: Joi.number().integer().required(),
  email: Joi.string().email().required(),
  token: Joi.string().required(),
})

const authMemberSessionSchema = Joi.object({
  formId: Joi.number().integer().required(),
  targetMemberId: Joi.number().integer().optional(),
})

const memberPasswordUpdateSchema = Joi.object({
  mode: Joi.string().valid('manual', 'email_temp').required(),
  password: Joi.when('mode', {
    is: 'manual',
    then: Joi.string().min(6).required(),
    otherwise: Joi.forbidden(),
  }),
})

const authChangePasswordSchema = Joi.object({
  formId: Joi.number().integer().required(),
  signupAuthToken: Joi.string().trim().required(),
  password: Joi.string().min(6).required(),
})

export function createSchedulingHandlers(pool) {
  return {
    async listPublicForms(req, res) {
      try {
        const { isEnrollSiteKey, enrollSiteVisibleSql } = await import('./enrollSites.js')
        const site = String(req.query.site || 'athletics')
        if (!isEnrollSiteKey(site)) {
          return res.status(400).json({ success: false, message: 'Invalid enroll site' })
        }

        const { resolveProgramsSchema, hasProgramSchedulingColumns } = await import(
          '../programs/schema.js'
        )
        const schema = await resolveProgramsSchema(pool)
        const hasSchedCols = await hasProgramSchedulingColumns(pool, schema.programsTable)
        const programActiveClause = hasSchedCols
          ? `(COALESCE(sf.programs_id, p.${schema.programFkColumn}) IS NULL OR ${enrollSiteVisibleSql({
              sitesColumn: 'pr.scheduling_enroll_sites',
              legacyColumn: 'pr.scheduling_active',
              siteParam: '$1',
            })})`
          : 'TRUE'
        const formActiveClause = enrollSiteVisibleSql({
          sitesColumn: 'sf.enroll_sites',
          legacyColumn: 'sf.is_active',
          siteParam: '$1',
        })

        const result = await pool.query(
          `
          SELECT
            sf.*,
            p.display_name AS class_display_name,
            COALESCE(
              NULLIF(TRIM(pr.display_name), ''),
              NULLIF(TRIM(pr.name), '')
            ) AS program_display_name,
            COALESCE(sf.programs_id, p.${schema.programFkColumn}) AS resolved_programs_id
          FROM scheduling_form sf
          LEFT JOIN program p ON p.id = sf.program_id
          LEFT JOIN ${schema.programsTable} pr
            ON pr.id = COALESCE(sf.programs_id, p.${schema.programFkColumn})
          WHERE sf.deleted_at IS NULL
            AND sf.program_id IS NOT NULL
            AND ${formActiveClause}
            AND ${programActiveClause}
          ORDER BY pr.display_name NULLS LAST, p.display_name NULLS LAST, sf.title ASC
          `,
          [site],
        )
        res.json({
          success: true,
          data: result.rows.map((row) => {
            const resolvedProgramsId =
              row.resolved_programs_id != null ? Number(row.resolved_programs_id) : null
            return {
              ...mapFormRow({ ...row, programs_id: resolvedProgramsId }),
              programDisplayName: row.program_display_name ?? null,
              classDisplayName: row.class_display_name ?? null,
            }
          }),
        })
      } catch (err) {
        console.error('[scheduling] listPublicForms:', err)
        res.status(500).json({ success: false, message: 'Failed to load scheduling forms' })
      }
    },

    async getPublicForm(req, res) {
      try {
        const { isEnrollSiteKey } = await import('./enrollSites.js')
        const site = String(req.query.site || 'athletics')
        if (!isEnrollSiteKey(site)) {
          return res.status(400).json({ success: false, message: 'Invalid enroll site' })
        }

        const formId = Number(req.params.id)

        if (req.query.fromEvent === '1') {
          const formRes = await pool.query(
            'SELECT id, is_active, deleted_at FROM scheduling_form WHERE id = $1',
            [formId],
          )
          if (formRes.rows.length === 0 || formRes.rows[0].deleted_at || !formRes.rows[0].is_active) {
            return res.status(404).json({ success: false, message: 'Scheduling form not found' })
          }
          if (!(await isFormLinkedToActiveEvent(pool, formId))) {
            return res.status(404).json({ success: false, message: 'Scheduling form not found' })
          }
        }

        const detail = await loadFormDetail(pool, formId, { site })
        if (!detail) {
          return res.status(404).json({ success: false, message: 'Scheduling form not found' })
        }
        res.json({ success: true, data: detail })
      } catch (err) {
        console.error('[scheduling] getPublicForm:', err)
        res.status(500).json({ success: false, message: 'Failed to load scheduling form' })
      }
    },

    /** Other bookable class options under the same parent program. */
    async listPublicOfferings(req, res) {
      try {
        const { isEnrollSiteKey } = await import('./enrollSites.js')
        const site = String(req.query.site || 'athletics')
        if (!isEnrollSiteKey(site)) {
          return res.status(400).json({ success: false, message: 'Invalid enroll site' })
        }

        const formId = Number(req.params.formId)
        const detail = await loadFormDetail(pool, formId, { site })
        if (!detail) {
          return res.status(404).json({ success: false, message: 'Scheduling form not found' })
        }

        const result = await pool.query(
          `SELECT * FROM scheduling_offering WHERE form_id = $1 ORDER BY start_date DESC, id DESC`,
          [formId],
        )

        const data = result.rows
          .map(mapOfferingRow)
          .filter((offering) =>
            detail.slotGroups.some(
              (group) =>
                group.offeringId === offering.id &&
                (group.occurrences?.length ?? 0) > 0,
            ),
          )

        res.json({ success: true, data })
      } catch (err) {
        console.error('[scheduling] listPublicOfferings:', err)
        res.status(500).json({ success: false, message: 'Failed to load offerings' })
      }
    },

    async getProgramSignupOptions(req, res) {
      try {
        const formId = Number(req.params.id)
        const { error, value } = programOptionsQuerySchema.validate(req.query)
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }

        const formRes = await pool.query(
          'SELECT id, programs_id FROM scheduling_form WHERE id = $1 AND deleted_at IS NULL AND is_active = TRUE',
          [formId],
        )
        if (formRes.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Scheduling form not found' })
        }

        const programsId =
          formRes.rows[0].programs_id != null ? Number(formRes.rows[0].programs_id) : null

        let signedUpSlotKeys = new Set()
        if (value.email) {
          const member = await findMemberByEmail(pool, value.email)
          if (member) {
            const signupRes = await pool.query(
              `SELECT form_id, slot_group_id, time_slot_id
               FROM scheduling_signup
               WHERE member_id = $1
                 AND orphaned_at IS NULL
                 AND status IN ('confirmed', 'waitlisted')`,
              [member.id],
            )
            signedUpSlotKeys = new Set(
              signupRes.rows.map((r) =>
                programSlotSignupKey(
                  Number(r.form_id),
                  Number(r.slot_group_id),
                  r.time_slot_id != null ? Number(r.time_slot_id) : null,
                ),
              ),
            )
          }
        }

        const { resolveProgramsSchema, hasProgramSchedulingColumns } = await import(
          '../programs/schema.js'
        )
        const schema = await resolveProgramsSchema(pool)
        const hasSchedCols = await hasProgramSchedulingColumns(pool, schema.programsTable)
        const programActiveClause = hasSchedCols
          ? `(sf.programs_id IS NULL OR COALESCE(pr.scheduling_active, TRUE) = TRUE)`
          : 'TRUE'

        const siblingRes = await pool.query(
          programsId != null
            ? `
              SELECT sf.id
              FROM scheduling_form sf
              LEFT JOIN ${schema.programsTable} pr ON pr.id = sf.programs_id
              WHERE sf.deleted_at IS NULL
                AND sf.is_active = TRUE
                AND sf.program_id IS NOT NULL
                AND sf.programs_id = $1
                AND ${programActiveClause}
              ORDER BY sf.title, sf.id
              `
            : `
              SELECT sf.id
              FROM scheduling_form sf
              WHERE sf.deleted_at IS NULL
                AND sf.is_active = TRUE
                AND sf.program_id IS NOT NULL
                AND sf.id = $1
              `,
          programsId != null ? [programsId] : [formId],
        )

        const options = []
        for (const row of siblingRes.rows) {
          const siblingId = Number(row.id)
          const detail = await loadFormDetail(pool, siblingId)
          if (!detail) continue
          const classOptions = buildProgramClassOptionsFromDetail(detail, { signedUpSlotKeys })
          options.push(...classOptions)
        }

        res.json({
          success: true,
          data: {
            programsId,
            options,
          },
        })
      } catch (err) {
        console.error('[scheduling] getProgramSignupOptions:', err)
        res.status(500).json({ success: false, message: 'Failed to load program signup options' })
      }
    },

    async checkEmail(req, res) {
      try {
        const { error, value } = checkEmailSchema.validate(req.body)
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const member = await findMemberByEmail(pool, value.email)
        res.json({
          success: true,
          data: {
            exists: Boolean(member),
            hasPassword: Boolean(member?.has_password),
            firstName: member?.first_name || null,
            lastName: member?.last_name || null,
            profileComplete: member?.profile_complete != null ? Boolean(member.profile_complete) : null,
          },
        })
      } catch (err) {
        console.error('[scheduling] checkEmail:', err)
        res.status(500).json({ success: false, message: 'Failed to check email' })
      }
    },

    /** Active scheduling signups for this member (slot-level). */
    async listMemberSignedUpForms(req, res) {
      try {
        const { error, value } = memberSignupsSchema.validate(req.body)
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const member = await findMemberByEmail(pool, value.email)
        if (!member) {
          return res.json({ success: true, data: { signups: [], formIds: [] } })
        }
        const result = await pool.query(
          `SELECT form_id, slot_group_id, time_slot_id
           FROM scheduling_signup
           WHERE member_id = $1
             AND orphaned_at IS NULL
             AND status IN ('confirmed', 'waitlisted')`,
          [member.id],
        )
        const signups = result.rows.map((r) => ({
          formId: Number(r.form_id),
          slotGroupId: Number(r.slot_group_id),
          timeSlotId: r.time_slot_id != null ? Number(r.time_slot_id) : null,
        }))
        res.json({
          success: true,
          data: {
            signups,
            formIds: [...new Set(signups.map((s) => s.formId))],
          },
        })
      } catch (err) {
        console.error('[scheduling] listMemberSignedUpForms:', err)
        res.status(500).json({ success: false, message: 'Failed to load signups' })
      }
    },

    async adminMemberPricingSummary(req, res) {
      try {
        const memberId = Number(req.params.memberId)
        if (!Number.isFinite(memberId)) {
          return res.status(400).json({ success: false, message: 'Invalid member id' })
        }

        const memberRes = await pool.query(
          `SELECT id, first_name, last_name, billing_city FROM member WHERE id = $1`,
          [memberId],
        )
        if (memberRes.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Member not found' })
        }
        const memberRow = memberRes.rows[0]

        let school = null
        let graduationYear = null
        try {
          const signupRes = await pool.query(
            `SELECT responses FROM scheduling_signup
             WHERE member_id = $1 AND orphaned_at IS NULL
             ORDER BY created_at DESC LIMIT 1`,
            [memberId],
          )
          const raw = signupRes.rows[0]?.responses
          const responses = typeof raw === 'string' ? JSON.parse(raw) : raw
          if (responses?.current_school) school = String(responses.current_school).trim()
          if (responses?.graduation_year != null && responses.graduation_year !== '') {
            graduationYear = Number(responses.graduation_year)
          }
        } catch {
          /* optional context */
        }

        const preview = await buildSignupOrderPreview(pool, {
          memberId,
          newSignups: [],
          promoCodes: [],
          memberContext: {
            city: memberRow.billing_city ?? null,
            school,
            graduationYear: Number.isFinite(graduationYear) ? graduationYear : null,
          },
        })

        const signupRes = await pool.query(
          `
          SELECT s.id, s.pricing_breakdown, sf.title AS form_title,
                 s.slot_group_id, s.time_slot_id,
                 ts.week_letter, ts.schedule_mode, ts.specific_date, ts.day_of_week,
                 ts.start_time, ts.end_time
          FROM scheduling_signup s
          JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
          JOIN scheduling_slot_group sg ON sg.id = s.slot_group_id
          LEFT JOIN scheduling_time_slot ts ON ts.id = s.time_slot_id
          WHERE s.member_id = $1
            AND s.orphaned_at IS NULL
            AND s.status IN ('confirmed', 'waitlisted')
          ORDER BY sf.title, s.id
          `,
          [memberId],
        )

        const groupIds = signupRes.rows
          .filter((row) => row.time_slot_id == null && row.slot_group_id != null)
          .map((row) => Number(row.slot_group_id))
        const { labels: groupLabels, rowsByGroupId } = await loadGroupDisplayLabels(pool, groupIds)

        res.json({
          success: true,
          data: {
            member: {
              id: Number(memberRow.id),
              firstName: memberRow.first_name,
              lastName: memberRow.last_name,
            },
            preview,
            signupRows: signupRes.rows.map((row) => ({
              id: Number(row.id),
              formTitle: row.form_title,
              slotLabel: slotLabelForSignupRow(row, groupLabels, rowsByGroupId),
              pricingBreakdown: row.pricing_breakdown ?? null,
            })),
          },
        })
      } catch (err) {
        console.error('[scheduling] adminMemberPricingSummary:', err)
        res.status(500).json({ success: false, message: 'Failed to load member pricing' })
      }
    },

    async adminMemberEnrollments(req, res) {
      try {
        const memberId = Number(req.params.memberId)
        if (!Number.isFinite(memberId)) {
          return res.status(400).json({ success: false, message: 'Invalid member id' })
        }
        try {
          await autoCompleteEndedEnrollments(pool, { memberId })
        } catch (sweepErr) {
          console.warn('[scheduling] auto-complete sweep:', sweepErr.message)
        }
        const result = await buildAdminMemberEnrollments(pool, memberId)
        if (!result.member) {
          return res.status(404).json({ success: false, message: 'Member not found' })
        }
        res.json({ success: true, data: result })
      } catch (err) {
        console.error('[scheduling] adminMemberEnrollments:', err)
        res.status(500).json({ success: false, message: 'Failed to load enrollments' })
      }
    },

    async adminSetSignupDiscount(req, res) {
      const signupId = Number(req.params.id)
      if (!Number.isFinite(signupId)) {
        return res.status(400).json({ success: false, message: 'Invalid signup id' })
      }
      const mode = req.body?.mode // 'manual' | 'rule' | 'clear'
      const client = await pool.connect()
      try {
        try {
          await ensureEnrollmentLifecycleColumns(pool)
        } catch (schemaErr) {
          console.warn('[scheduling] discount schema ensure:', schemaErr?.message ?? schemaErr)
        }
        await client.query('BEGIN')
        const existing = await client.query(
          'SELECT * FROM scheduling_signup WHERE id = $1 FOR UPDATE',
          [signupId],
        )
        if (existing.rows.length === 0) {
          await client.query('ROLLBACK')
          return res.status(404).json({ success: false, message: 'Signup not found' })
        }

        let cents = null
        let pct = null
        let reason = req.body?.reason != null ? String(req.body.reason).slice(0, 500) : null
        let ruleId = null

        if (mode === 'clear') {
          // leave all null
        } else if (mode === 'rule') {
          ruleId = req.body?.ruleId != null ? Number(req.body.ruleId) : null
          if (!Number.isFinite(ruleId)) {
            await client.query('ROLLBACK')
            return res.status(400).json({ success: false, message: 'ruleId is required for rule mode' })
          }
          const ruleRes = await client.query(
            `SELECT id, name, amount_type, amount_value FROM discount_rule WHERE id = $1`,
            [ruleId],
          )
          if (ruleRes.rows.length === 0) {
            await client.query('ROLLBACK')
            return res.status(404).json({ success: false, message: 'Discount rule not found' })
          }
          const rule = ruleRes.rows[0]
          // percent rules store amount_value in basis points (5000 = 50%); fixed in cents.
          if (String(rule.amount_type) === 'percent') {
            pct = Number(rule.amount_value) / 100
          } else {
            cents = Math.max(0, Math.round(Number(rule.amount_value)))
          }
          if (!reason) reason = rule.name
        } else if (mode === 'manual') {
          if (req.body?.amountCents != null) {
            cents = Math.max(0, Math.round(Number(req.body.amountCents)))
          } else if (req.body?.percent != null) {
            pct = Math.max(0, Math.min(100, Number(req.body.percent)))
          } else {
            await client.query('ROLLBACK')
            return res.status(400).json({ success: false, message: 'amountCents or percent is required' })
          }
        } else {
          await client.query('ROLLBACK')
          return res.status(400).json({ success: false, message: 'Invalid discount mode' })
        }

        await client.query(
          `UPDATE scheduling_signup
           SET manual_discount_cents = $2, manual_discount_pct = $3,
               manual_discount_reason = $4, manual_discount_rule_id = $5
           WHERE id = $1`,
          [signupId, cents, pct, reason, ruleId],
        )

        // Reflect the discount on the recurring subscription so monthly totals + the ledger update.
        await trySavepoint(
          client,
          async () => {
            const subRes = await client.query(
              `SELECT id, monthly_amount_cents FROM billing_subscription
               WHERE source_type = 'scheduling_signup' AND source_id = $1 AND status <> 'cancelled'
               ORDER BY id DESC LIMIT 1`,
              [String(signupId)],
            )
            if (subRes.rows.length > 0) {
              const sub = subRes.rows[0]
              const gross = Number(sub.monthly_amount_cents) || 0
              const discountCents =
                cents != null ? cents : pct != null ? Math.round((gross * pct) / 100) : 0
              const net = Math.max(0, gross - discountCents)
              await client.query(
                `UPDATE billing_subscription
                 SET discount_amount_cents = $2, net_monthly_cents = $3, updated_at = now()
                 WHERE id = $1`,
                [sub.id, discountCents, net],
              )
            }
          },
          { logPrefix: '[scheduling] discount subscription sync' },
        )

        await client.query('COMMIT')
        res.json({ success: true })
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        console.error('[scheduling] adminSetSignupDiscount:', err)
        res.status(500).json({
          success: false,
          message: err?.message || 'Failed to apply discount',
        })
      } finally {
        client.release()
      }
    },

    async adminDeleteEnrollment(req, res) {
      const id = Number(req.params.id)
      if (!Number.isFinite(id)) {
        return res.status(400).json({ success: false, message: 'Invalid id' })
      }
      const source = req.query?.source === 'member_program' ? 'member_program' : 'scheduling'
      const client = await pool.connect()
      try {
        try {
          await ensureEnrollmentLifecycleColumns(pool)
        } catch (schemaErr) {
          console.warn('[scheduling] delete schema ensure:', schemaErr?.message ?? schemaErr)
        }
        await client.query('BEGIN')
        if (source === 'member_program') {
          const del = await client.query('DELETE FROM member_program WHERE id = $1 RETURNING id', [id])
          await client.query('COMMIT')
          if (del.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Enrollment not found' })
          }
          return res.json({ success: true })
        }

        const existing = await client.query(
          'SELECT id, slot_group_id, status FROM scheduling_signup WHERE id = $1 FOR UPDATE',
          [id],
        )
        if (existing.rows.length === 0) {
          await client.query('ROLLBACK')
          return res.status(404).json({ success: false, message: 'Enrollment not found' })
        }
        const signup = existing.rows[0]
        await safeCancelSubscriptionsForSource(client, { sourceType: 'scheduling_signup', sourceId: id })
        await safeRestorePassCreditsForSignup(client, { signupId: id, reason: 'Enrollment deleted' })
        let promotedRows = []
        if (signup.status === 'confirmed' && signup.slot_group_id) {
          promotedRows =
            (await trySavepoint(
              client,
              () => promoteFromWaitlist(client, signup.slot_group_id, 1),
              { logPrefix: '[scheduling] delete promote waitlist' },
            )) ?? []
        }
        await client.query('DELETE FROM scheduling_signup WHERE id = $1', [id])
        await client.query('COMMIT')
        if (promotedRows.length > 0) {
          await sendPromotionEmails(pool, promotedRows)
        }
        res.json({ success: true })
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        console.error('[scheduling] adminDeleteEnrollment:', err)
        res.status(500).json({
          success: false,
          message: err?.message || 'Failed to delete enrollment',
        })
      } finally {
        client.release()
      }
    },

    async previewSignupOrder(req, res) {
      try {
        const { error, value } = orderPreviewSchema.validate(req.body, { stripUnknown: true })
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }

        const formRes = await pool.query(
          'SELECT id, programs_id FROM scheduling_form WHERE id = $1 AND deleted_at IS NULL',
          [value.formId],
        )
        if (formRes.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Scheduling form not available' })
        }
        const formRow = formRes.rows[0]

        let memberId = null
        if (value.signupAuthToken) {
          const auth = verifySignupAuthToken(value.signupAuthToken, value.formId, {
            programsId: formRow.programs_id != null ? Number(formRow.programs_id) : null,
          })
          memberId = Number(auth.memberId)
        } else if (value.email) {
          const member = await findMemberByEmail(pool, value.email)
          memberId = member?.id != null ? Number(member.id) : null
        }

        let memberCity = null
        if (memberId != null) {
          try {
            const mRes = await pool.query('SELECT billing_city FROM member WHERE id = $1', [memberId])
            memberCity = mRes.rows[0]?.billing_city ?? null
          } catch {
            memberCity = null
          }
        }

        const preview = await buildSignupOrderPreview(pool, {
          memberId,
          newSignups: value.signups,
          promoCodes: value.promoCodes || [],
          memberContext: {
            city: memberCity,
            school: value.currentSchool || null,
            graduationYear: value.graduationYear ?? null,
          },
        })

        res.json({ success: true, data: preview })
      } catch (err) {
        console.error('[scheduling] previewSignupOrder:', err)
        if (err instanceof WeeklyTierSlotLimitError || err?.name === 'WeeklyTierSlotLimitError') {
          return res.status(400).json({ success: false, message: err.message })
        }
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
          return res.status(401).json({ success: false, message: 'Sign-in session expired. Please sign in again.' })
        }
        res.status(500).json({ success: false, message: 'Failed to load order preview' })
      }
    },

    async authLogin(req, res) {
      try {
        const { error, value } = authLoginSchema.validate(req.body)
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const member = await findMemberByEmail(pool, value.email)
        if (!member) {
          return res.status(401).json({ success: false, message: 'No account found for this email' })
        }
        const valid = await verifyMemberPassword(member, value.password)
        if (!valid) {
          return res.status(401).json({ success: false, message: 'Incorrect password' })
        }
        const signupAuthToken = await issueSignupAuthForForm(pool, value.formId, member)
        res.json({
          success: true,
          data: {
            signupAuthToken,
            memberId: Number(member.id),
            profileComplete: Boolean(member.profile_complete),
            mustChangePassword: Boolean(member.must_change_password),
            firstName: member.first_name,
            lastName: member.last_name,
            email: member.email,
          },
        })
      } catch (err) {
        console.error('[scheduling] authLogin:', err)
        res.status(500).json({ success: false, message: 'Failed to sign in' })
      }
    },

    async authChangePassword(req, res) {
      try {
        const { error, value } = authChangePasswordSchema.validate(req.body)
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }

        const formRes = await pool.query(
          'SELECT id, programs_id FROM scheduling_form WHERE id = $1 AND deleted_at IS NULL',
          [value.formId],
        )
        if (formRes.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Scheduling form not available' })
        }
        const formRow = formRes.rows[0]
        const auth = verifySignupAuthToken(value.signupAuthToken, value.formId, {
          programsId: formRow.programs_id != null ? Number(formRow.programs_id) : null,
        })
        const memberId = Number(auth.memberId)

        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          await updateMemberPassword(client, memberId, value.password, { mustChangePassword: false })
          await client.query('COMMIT')
        } catch (txErr) {
          await client.query('ROLLBACK')
          throw txErr
        } finally {
          client.release()
        }

        const member = await findMemberById(pool, memberId)
        const signupAuthToken = await issueSignupAuthForForm(pool, value.formId, member)
        res.json({
          success: true,
          data: {
            signupAuthToken,
            memberId,
            profileComplete: Boolean(member?.profile_complete),
            mustChangePassword: false,
            firstName: member?.first_name || '',
            lastName: member?.last_name || '',
            email: member?.email || '',
          },
        })
      } catch (err) {
        console.error('[scheduling] authChangePassword:', err)
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
          return res.status(401).json({ success: false, message: 'Sign-in session expired. Please sign in again.' })
        }
        res.status(500).json({ success: false, message: err.message || 'Failed to update password' })
      }
    },

    async authMagicLink(req, res) {
      try {
        const { error, value } = magicLinkSchema.validate(req.body)
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const member = await findMemberByEmail(pool, value.email)
        if (!member) {
          return res.json({ success: true, message: 'If an account exists, a sign-in link has been sent.' })
        }
        const formRes = await pool.query(
          'SELECT title FROM scheduling_form WHERE id = $1 AND deleted_at IS NULL',
          [value.formId],
        )
        const token = generateMagicToken()
        await storeMagicToken(pool, {
          token,
          email: value.email,
          formId: value.formId,
          memberId: member.id,
        })
        try {
          await sendMagicLinkEmail({
            email: value.email,
            formId: value.formId,
            formTitle: formRes.rows[0]?.title || 'Scheduling',
            token,
          })
        } catch (emailErr) {
          console.error('[scheduling] magic link email failed:', emailErr.message)
          return res.status(503).json({
            success: false,
            message: emailErr.message || 'Failed to send sign-in email',
          })
        }
        res.json({ success: true, message: 'If an account exists, a sign-in link has been sent.' })
      } catch (err) {
        console.error('[scheduling] authMagicLink:', err)
        res.status(500).json({ success: false, message: 'Failed to send sign-in link' })
      }
    },

    async authVerifyToken(req, res) {
      try {
        const { error, value } = verifyTokenSchema.validate(req.body)
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const row = await verifyMagicToken(pool, {
          token: value.token,
          formId: value.formId,
          email: value.email,
        })
        const member = await findMemberById(pool, row.member_id)
        if (!member) {
          return res.status(404).json({ success: false, message: 'Account not found' })
        }
        const signupAuthToken = await issueSignupAuthForForm(pool, value.formId, member)
        res.json({
          success: true,
          data: {
            signupAuthToken,
            memberId: Number(member.id),
            profileComplete: Boolean(member.profile_complete),
            firstName: member.first_name,
            lastName: member.last_name,
            email: member.email,
          },
        })
      } catch (err) {
        console.error('[scheduling] authVerifyToken:', err)
        res.status(401).json({ success: false, message: err.message || 'Invalid or expired link' })
      }
    },

    async authMemberSession(req, res) {
      try {
        const { error, value } = authMemberSessionSchema.validate(req.body)
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }

        const token = req.headers.authorization?.split(' ')[1]?.trim()
        if (!token) {
          return res.status(401).json({ success: false, message: 'No token provided' })
        }

        let decoded
        try {
          decoded = jwt.verify(token, resolveJwtSecret())
        } catch (err) {
          console.error('[scheduling] authMemberSession token verify failed:', err.message)
          return res.status(401).json({ success: false, message: 'Invalid token' })
        }

        const userId = decoded.userId || decoded.memberId || decoded.adminId
        if (!userId) {
          return res.status(401).json({ success: false, message: 'Token missing user identity' })
        }

        const member = await findMemberForAppUser(pool, userId)
        if (!member) {
          return res.status(404).json({ success: false, message: 'Member account not found' })
        }

        // Optionally enroll a different family member (chosen in the member portal).
        // Authorize the caller as a member of the same family as the target.
        let enrollMember = member
        if (value.targetMemberId && Number(value.targetMemberId) !== Number(member.id)) {
          const target = await findMemberById(pool, value.targetMemberId)
          if (!target) {
            return res.status(404).json({ success: false, message: 'Selected family member not found' })
          }
          const sameFamily =
            member.family_id != null &&
            target.family_id != null &&
            Number(member.family_id) === Number(target.family_id)
          if (!sameFamily) {
            return res.status(403).json({
              success: false,
              message: 'You do not have permission to enroll this family member',
            })
          }
          enrollMember = target
        }

        const signupAuthToken = await issueSignupAuthForForm(pool, value.formId, enrollMember)
        res.json({
          success: true,
          data: {
            signupAuthToken,
            memberId: Number(enrollMember.id),
            profileComplete: Boolean(enrollMember.profile_complete),
            mustChangePassword: Boolean(enrollMember.must_change_password),
            firstName: enrollMember.first_name,
            lastName: enrollMember.last_name,
            email: enrollMember.email,
          },
        })
      } catch (err) {
        console.error('[scheduling] authMemberSession:', err)
        res.status(500).json({ success: false, message: 'Failed to start signup session' })
      }
    },

    async createSignup(req, res) {
      try {
        const { error, value } = signupSchema.validate(req.body, { abortEarly: false })
        if (error) {
          const msg = error.details[0]?.message || 'Validation error'
          return res.status(400).json({
            success: false,
            message: msg,
            errors: error.details.map((d) => d.message),
          })
        }

        const formRes = await pool.query('SELECT * FROM scheduling_form WHERE id = $1', [value.formId])
        if (formRes.rows.length === 0 || formRes.rows[0].deleted_at || !formRes.rows[0].is_active) {
          return res.status(404).json({ success: false, message: 'Scheduling form not available' })
        }
        const formRow = formRes.rows[0]
        const detail = await loadFormDetail(pool, value.formId)
        if (!detail) {
          return res.status(404).json({ success: false, message: 'Scheduling form not available' })
        }

        const group = detail.slotGroups.find((g) => g.id === value.slotGroupId)
        if (!group) {
          return res.status(400).json({ success: false, message: 'Invalid time slot group' })
        }
        const firstOccurrence =
          (value.timeSlotId != null
            ? group.occurrences.find((o) => o.id === value.timeSlotId)
            : null) ?? group.occurrences[0]
        if (!firstOccurrence) {
          return res.status(400).json({ success: false, message: 'Time slot has no schedule entries' })
        }
        if (value.timeSlotId != null && firstOccurrence.id !== value.timeSlotId) {
          return res.status(400).json({ success: false, message: 'Invalid time slot selection' })
        }

        let memberId = null
        let createdNewStubMemberId = null
        let responses = { ...value.responses }

        if (value.signupAuthToken) {
          const auth = verifySignupAuthToken(value.signupAuthToken, value.formId, {
            programsId: formRow.programs_id != null ? Number(formRow.programs_id) : null,
          })
          memberId = Number(auth.memberId)
          const member = await findMemberById(pool, memberId)
          if (!member) {
            return res.status(401).json({ success: false, message: 'Account not found' })
          }
          responses = {
            first_name: member.first_name,
            last_name: member.last_name,
            email: member.email,
            phone: member.phone || responses.phone,
            ...responses,
          }
        } else if (value.password) {
          const validationErrors = validateSignupResponses(detail.signupFields, responses, {
            mandateWaiver: detail.mandateWaiver,
          })
          if (validationErrors.length > 0) {
            return res.status(400).json({ success: false, message: validationErrors[0], errors: validationErrors })
          }
        }

        const client = await pool.connect()
        try {
          await client.query('BEGIN')

          if (value.password && !memberId) {
            memberId = await createMemberStub(client, {
              firstName: String(responses.first_name || ''),
              lastName: String(responses.last_name || ''),
              email: String(responses.email || ''),
              password: value.password,
              phone: responses.phone ? String(responses.phone) : null,
            })
            createdNewStubMemberId = memberId
          }

          if (!memberId) {
            await client.query('ROLLBACK')
            return res.status(400).json({ success: false, message: 'Could not resolve member account' })
          }

          let discountBreakdown = null
          let freePassBreakdown = null
          try {
            const preview = await buildSignupOrderPreview(pool, {
              memberId,
              newSignups: [
                {
                  formId: value.formId,
                  slotGroupId: value.slotGroupId,
                  timeSlotId: firstOccurrence.id,
                  formTitle: detail.title,
                },
              ],
              promoCodes: value.promoCodes || [],
              memberContext: {
                city: null,
                school: responses.current_school != null ? String(responses.current_school).trim() : null,
                graduationYear:
                  responses.graduation_year != null && responses.graduation_year !== ''
                    ? Number(responses.graduation_year)
                    : null,
              },
            })
            discountBreakdown = preview.discounts
            freePassBreakdown = preview.freePasses
          } catch (previewErr) {
            console.warn('[scheduling] discount preview at submit:', previewErr.message)
          }

          const signupResult = await insertSignupForMember(client, {
            formId: value.formId,
            formRow,
            slotGroupId: value.slotGroupId,
            memberId,
            responses,
            firstOccurrenceId: firstOccurrence.id,
            formTitle: detail.title,
            mandateWaiver: detail.mandateWaiver,
            groupDisplayLabel: group.displayLabel,
            firstOccurrenceLabel: firstOccurrence.displayLabel,
          })

          const currentSchool = responses.current_school != null ? String(responses.current_school).trim() : ''
          if (currentSchool) {
            await linkMemberToSchoolFromName(client, memberId, currentSchool, 'signup')
          }

          await client.query('COMMIT')

          if (createdNewStubMemberId) {
            void notifyWelcomeNewMember(pool, createdNewStubMemberId, { context: 'scheduling_stub' })
          }

          const { signupId, signupStatus, positions, pricing } = signupResult

          if (freePassBreakdown?.enabled && freePassBreakdown.redemptions?.length) {
            const lineKey = programSlotSignupKey(
              value.formId,
              value.slotGroupId,
              firstOccurrence.id,
            )
            const lineRedemptions = freePassBreakdown.redemptions.filter(
              (r) => r.lineKey === lineKey || r.lineKey == null,
            )
            await persistFreePassRedemptions(pool, {
              signupId,
              memberId,
              redemptions: lineRedemptions,
            })
          }

          if (discountBreakdown?.enabled) {
            const lineKey = programSlotSignupKey(
              value.formId,
              value.slotGroupId,
              firstOccurrence.id,
            )
            await persistDiscountSnapshot(pool, {
              breakdown: discountBreakdown,
              keyToSignupId: { [lineKey]: signupId },
              fallbackSignupId: signupId,
            })
          }

          await sendSignupNotificationEmails(pool, {
            signupStatus,
            signupId,
            memberId,
            responses,
            formTitle: detail.title,
            slotLabel: signupResult.slotLabel,
            pricing,
            mandateWaiver: detail.mandateWaiver,
          })

          const refreshed = await pool.query('SELECT * FROM scheduling_signup WHERE id = $1', [signupId])
          const positionMessage = buildSignupPositionMessage({
            status: signupStatus,
            ...positions,
          })

          res.json({
            success: true,
            message: positionMessage,
            data: mapSignupRow(refreshed.rows[0], positions),
          })
        } catch (txErr) {
          await client.query('ROLLBACK')
          if (txErr.code === 'MAX_SLOTS') {
            return res.status(400).json({ success: false, message: txErr.message })
          }
          if (txErr.code === 'SLOT_UNAVAILABLE') {
            return res.status(400).json({ success: false, message: txErr.message })
          }
          if (txErr.message?.includes('already exists')) {
            return res.status(400).json({ success: false, message: txErr.message })
          }
          throw txErr
        } finally {
          client.release()
        }
      } catch (err) {
        console.error('[scheduling] createSignup:', err)
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
          return res.status(401).json({ success: false, message: 'Sign-in session expired. Please sign in again.' })
        }
        res.status(500).json({ success: false, message: err.message || 'Failed to submit signup' })
      }
    },

    async createSignupBatch(req, res) {
      try {
        const { error, value } = batchSignupSchema.validate(req.body, { abortEarly: false })
        if (error) {
          const msg = error.details[0]?.message || 'Validation error'
          return res.status(400).json({
            success: false,
            message: msg,
            errors: error.details.map((d) => d.message),
          })
        }

        const slotSignups = value.signups.filter((s) => s.lineType !== 'multi_class_pass')
        const passSignups = value.signups.filter((s) => s.lineType === 'multi_class_pass')

        const seenKeys = new Set()
        for (const entry of slotSignups) {
          const key = programSlotSignupKey(
            entry.formId,
            entry.slotGroupId,
            entry.timeSlotId ?? null,
          )
          if (seenKeys.has(key)) {
            return res.status(400).json({
              success: false,
              message: 'Duplicate slot selection in signup batch',
            })
          }
          seenKeys.add(key)
        }

        const resolvedEntries = []
        for (const entry of slotSignups) {
          try {
            const resolved = await resolveSignupEntryForInsert(pool, entry)
            resolvedEntries.push({ entry, ...resolved })
          } catch (resolveErr) {
            if (resolveErr.code === 'FORM_UNAVAILABLE' || resolveErr.code === 'INVALID_ENTRY') {
              return res.status(400).json({ success: false, message: resolveErr.message })
            }
            throw resolveErr
          }
        }

        const primaryFormRow = resolvedEntries[0]?.formRow ?? null
        let memberId = null
        let createdNewStubMemberId = null
        let responses = { ...value.responses }

        if (value.signupAuthToken) {
          const authFormId =
            resolvedEntries[0]?.entry.formId ??
            slotSignups[0]?.formId ??
            value.signups.find((s) => s.formId != null)?.formId
          const auth = verifySignupAuthToken(value.signupAuthToken, authFormId, {
            programsId:
              primaryFormRow?.programs_id != null ? Number(primaryFormRow.programs_id) : null,
          })
          memberId = Number(auth.memberId)
          const member = await findMemberById(pool, memberId)
          if (!member) {
            return res.status(401).json({ success: false, message: 'Account not found' })
          }
          for (const resolved of resolvedEntries) {
            verifySignupAuthToken(value.signupAuthToken, resolved.entry.formId, {
              programsId:
                resolved.formRow.programs_id != null ? Number(resolved.formRow.programs_id) : null,
            })
          }
          responses = {
            first_name: member.first_name,
            last_name: member.last_name,
            email: member.email,
            phone: member.phone || responses.phone,
            ...responses,
          }
        } else if (value.password && resolvedEntries.length > 0) {
          const validationErrors = validateSignupResponses(
            resolvedEntries[0].detail.signupFields,
            responses,
            { mandateWaiver: resolvedEntries[0].detail.mandateWaiver },
          )
          if (validationErrors.length > 0) {
            return res.status(400).json({
              success: false,
              message: validationErrors[0],
              errors: validationErrors,
            })
          }
        }

        const client = await pool.connect()
        try {
          await client.query('BEGIN')

          if (value.password && !memberId) {
            memberId = await createMemberStub(client, {
              firstName: String(responses.first_name || ''),
              lastName: String(responses.last_name || ''),
              email: String(responses.email || ''),
              password: value.password,
              phone: responses.phone ? String(responses.phone) : null,
            })
            createdNewStubMemberId = memberId
          }

          if (!memberId) {
            await client.query('ROLLBACK')
            return res.status(400).json({ success: false, message: 'Could not resolve member account' })
          }

          for (const resolved of resolvedEntries) {
            const existing = await client.query(
              `
              SELECT id FROM scheduling_signup
              WHERE member_id = $1
                AND slot_group_id = $2
                AND time_slot_id = $3
                AND orphaned_at IS NULL
                AND status IN ('confirmed', 'waitlisted')
              LIMIT 1
              `,
              [memberId, resolved.entry.slotGroupId, resolved.firstOccurrence.id],
            )
            if (existing.rows.length > 0) {
              const err = new Error('You are already signed up for one of the selected slots')
              err.code = 'ALREADY_SIGNED_UP'
              throw err
            }
          }

          const byPricingScope = new Map()
          for (const resolved of resolvedEntries) {
            const scope = pricingScopeKey(resolved.formRow)
            if (!byPricingScope.has(scope)) byPricingScope.set(scope, [])
            byPricingScope.get(scope).push(resolved)
          }

          for (const [, entries] of byPricingScope) {
            const activeCount = await countActiveSignupsForPricingScope(
              client,
              entries[0].formRow,
              memberId,
            )
            const { effectiveDbRow } = await loadEffectivePricingForForm(client, entries[0].formRow)
            const maxSlots =
              effectiveDbRow.max_slots_per_user != null
                ? Number(effectiveDbRow.max_slots_per_user)
                : null
            if (maxSlots != null && activeCount + entries.length > maxSlots) {
              const err = new Error(
                `Maximum of ${maxSlots} slot${maxSlots === 1 ? '' : 's'} reached for this program`,
              )
              err.code = 'MAX_SLOTS'
              throw err
            }
          }

          let discountBreakdown = null
          let freePassBreakdown = null
          let orderPreviewSnapshot = null
          try {
            const preview = await buildSignupOrderPreview(pool, {
              memberId,
              newSignups: [
                ...resolvedEntries.map((resolved) => ({
                  formId: resolved.entry.formId,
                  slotGroupId: resolved.entry.slotGroupId,
                  timeSlotId: resolved.firstOccurrence.id,
                  formTitle: resolved.detail.title,
                  selectedPricingOptionKey: resolved.entry.selectedPricingOptionKey,
                  useMultiClassPass: resolved.entry.useMultiClassPass,
                  lineType: 'slot',
                })),
                ...passSignups.map((p) => ({
                  lineType: 'multi_class_pass',
                  programsId: p.programsId,
                  packageId: p.packageId,
                })),
              ],
              promoCodes: value.promoCodes || [],
              memberContext: {
                city: null,
                school: responses.current_school != null ? String(responses.current_school).trim() : null,
                graduationYear:
                  responses.graduation_year != null && responses.graduation_year !== ''
                    ? Number(responses.graduation_year)
                    : null,
              },
            })
            discountBreakdown = preview.discounts
            freePassBreakdown = preview.freePasses
            orderPreviewSnapshot = preview
          } catch (previewErr) {
            console.warn('[scheduling] discount preview at batch submit:', previewErr.message)
          }

          const signupResults = []
          for (const resolved of resolvedEntries) {
            const signupResult = await insertSignupForMember(client, {
              formId: resolved.entry.formId,
              formRow: resolved.formRow,
              slotGroupId: resolved.entry.slotGroupId,
              memberId,
              responses,
              firstOccurrenceId: resolved.firstOccurrence.id,
              formTitle: resolved.detail.title,
              mandateWaiver: resolved.detail.mandateWaiver,
              groupDisplayLabel: resolved.group.displayLabel,
              firstOccurrenceLabel: resolved.firstOccurrence.displayLabel,
              pricingOptionKey: resolved.entry.selectedPricingOptionKey ?? null,
            })
            signupResults.push(signupResult)
          }

          const purchasedPasses = []
          for (const passEntry of passSignups) {
            const programsId = Number(passEntry.programsId)
            const packages = await loadProgramPassPackages(client, programsId)
            const pkg = packages.find((p) => p.id === passEntry.packageId)
            if (!pkg) {
              const err = new Error('Multi-class pass package is no longer available')
              err.code = 'INVALID_PASS'
              throw err
            }
            const created = await createMemberPassPurchase(client, {
              memberId,
              programsId,
              packageDef: pkg,
            })
            purchasedPasses.push({ ...created, programsId, packageDef: pkg })
          }

          const passRedemptionResults = []
          if (orderPreviewSnapshot?.newSignups) {
            for (let index = 0; index < resolvedEntries.length; index += 1) {
              const resolved = resolvedEntries[index]
              const signupId = signupResults[index]?.signupId
              if (signupId == null) continue
              const lineKey = programSlotSignupKey(
                resolved.entry.formId,
                resolved.entry.slotGroupId,
                resolved.firstOccurrence.id,
              )
              const previewLine = orderPreviewSnapshot.newSignups.find((l) => l.slotKey === lineKey)
              if (!previewLine?.multiClassPassApplied || previewLine.programsId == null) continue
              const passRow = await selectPassForRedemption(
                client,
                memberId,
                Number(previewLine.programsId),
              )
              if (!passRow) continue
              const redemption = await redeemPassForSignup(client, {
                memberPassId: Number(passRow.id),
                signupId,
                memberId,
                programsId: Number(previewLine.programsId),
              })
              passRedemptionResults.push({
                signupId,
                ...redemption,
                formTitle: resolved.detail.title,
                slotLabel: signupResults[index]?.slotLabel ?? '',
              })
            }
          }

          const currentSchool =
            responses.current_school != null ? String(responses.current_school).trim() : ''
          if (currentSchool) {
            await linkMemberToSchoolFromName(client, memberId, currentSchool, 'signup')
          }

          await client.query('COMMIT')

          if (createdNewStubMemberId) {
            void notifyWelcomeNewMember(pool, createdNewStubMemberId, { context: 'scheduling_stub' })
          }

          if (freePassBreakdown?.enabled && freePassBreakdown.redemptions?.length) {
            for (let index = 0; index < resolvedEntries.length; index += 1) {
              const resolved = resolvedEntries[index]
              const signupId = signupResults[index]?.signupId
              if (signupId == null) continue
              const lineKey = programSlotSignupKey(
                resolved.entry.formId,
                resolved.entry.slotGroupId,
                resolved.firstOccurrence.id,
              )
              const lineRedemptions = freePassBreakdown.redemptions.filter((r) => r.lineKey === lineKey)
              if (lineRedemptions.length) {
                await persistFreePassRedemptions(pool, {
                  signupId,
                  memberId,
                  redemptions: lineRedemptions,
                })
              }
            }
          }

          if (discountBreakdown?.enabled) {
            const keyToSignupId = {}
            resolvedEntries.forEach((resolved, index) => {
              const key = programSlotSignupKey(
                resolved.entry.formId,
                resolved.entry.slotGroupId,
                resolved.firstOccurrence.id,
              )
              const signupId = signupResults[index]?.signupId
              if (signupId != null) keyToSignupId[key] = signupId
            })
            await persistDiscountSnapshot(pool, {
              breakdown: discountBreakdown,
              keyToSignupId,
              fallbackSignupId: signupResults[0]?.signupId ?? null,
            })
          }

          // Bridge the created signups into the persisted family billing ledger.
          try {
            for (const redemption of passRedemptionResults) {
              await persistPassRedemptionCharge(pool, {
                memberId,
                signupId: redemption.signupId,
                formTitle: redemption.formTitle,
                slotLabel: redemption.slotLabel,
                packageLabel: redemption.packageLabel,
                classesRemainingAfter: redemption.classesRemainingAfter,
              })
            }

            const passRedemptionSignupIds = new Set(passRedemptionResults.map((r) => r.signupId))
            await persistSignupCharges(pool, {
              memberId,
              signups: signupResults
                .map((result, index) => ({ result, index }))
                .filter(({ result }) => !passRedemptionSignupIds.has(result.signupId))
                .map(({ result, index }) => ({
                  signupId: result.signupId,
                  formId: resolvedEntries[index].entry.formId,
                  slotGroupId: resolvedEntries[index].entry.slotGroupId,
                  timeSlotId: resolvedEntries[index].firstOccurrence.id,
                  formTitle: result.formTitle,
                  slotLabel: result.slotLabel,
                })),
              preview: orderPreviewSnapshot,
            })

            const { resolveProgramsSchema } = await import('../programs/schema.js')
            const schema = await resolveProgramsSchema(pool)
            for (const purchased of purchasedPasses) {
              const progRes = await pool.query(
                `SELECT display_name FROM ${schema.programsTable} WHERE id = $1`,
                [purchased.programsId],
              )
              await persistMultiClassPassPurchaseCharge(pool, {
                memberId,
                passId: purchased.passId,
                programsId: purchased.programsId,
                packageLabel: purchased.packageDef.label,
                priceCents: purchased.packageDef.priceCents,
                programDisplayName: progRes.rows[0]?.display_name ?? null,
              })
            }
          } catch (chargeErr) {
            console.warn('[scheduling] persistSignupCharges:', chargeErr.message)
          }

          const mappedSignups = []
          for (const signupResult of signupResults) {
            const { signupId, signupStatus, positions, pricing, responses: signupResponses } =
              signupResult
            await sendSignupNotificationEmails(pool, {
              signupStatus,
              signupId,
              memberId,
              responses: signupResponses,
              formTitle: signupResult.formTitle,
              slotLabel: signupResult.slotLabel,
              pricing,
              mandateWaiver: signupResult.mandateWaiver,
            })

            const refreshed = await pool.query('SELECT * FROM scheduling_signup WHERE id = $1', [
              signupId,
            ])
            mappedSignups.push({
              ...mapSignupRow(refreshed.rows[0], positions),
              formTitle: signupResult.formTitle,
              slotLabel: signupResult.slotLabel,
              pricing: signupResult.pricing,
            })
          }

          res.json({
            success: true,
            message:
              mappedSignups.length === 1
                ? buildSignupPositionMessage({
                    status: mappedSignups[0].status,
                    signupNumber: mappedSignups[0].signupNumber,
                    maxParticipants: mappedSignups[0].maxParticipants,
                    waitlistPosition: mappedSignups[0].waitlistPosition,
                  })
                : mappedSignups.length > 0
                  ? `Signed up for ${mappedSignups.length} classes`
                  : purchasedPasses.length > 0
                    ? `Purchased ${purchasedPasses.length} multi-class pass(es)`
                    : 'Enrollment complete',
            data: { signups: mappedSignups, purchasedPasses },
          })
        } catch (txErr) {
          await client.query('ROLLBACK')
          if (txErr.code === 'MAX_SLOTS') {
            return res.status(400).json({ success: false, message: txErr.message })
          }
          if (txErr.code === 'SLOT_UNAVAILABLE') {
            return res.status(400).json({ success: false, message: txErr.message })
          }
          if (txErr.code === 'ALREADY_SIGNED_UP') {
            return res.status(400).json({ success: false, message: txErr.message })
          }
          if (txErr.message?.includes('already exists')) {
            return res.status(400).json({ success: false, message: txErr.message })
          }
          throw txErr
        } finally {
          client.release()
        }
      } catch (err) {
        console.error('[scheduling] createSignupBatch:', err)
        if (err instanceof WeeklyTierSlotLimitError || err?.name === 'WeeklyTierSlotLimitError') {
          return res.status(400).json({ success: false, message: err.message })
        }
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
          return res.status(401).json({ success: false, message: 'Sign-in session expired. Please sign in again.' })
        }
        res.status(500).json({ success: false, message: err.message || 'Failed to submit signups' })
      }
    },

    async listLegacyForms(_req, res) {
      try {
        const result = await pool.query(
          `
          SELECT sf.*,
            EXISTS(
              SELECT 1 FROM events e
              WHERE e.scheduling_form_id = sf.id AND COALESCE(e.archived, FALSE) = FALSE
            ) AS event_linked,
            (SELECT COUNT(*)::int FROM scheduling_signup s WHERE s.form_id = sf.id) AS signup_count,
            (SELECT COUNT(*)::int FROM scheduling_slot_group sg WHERE sg.form_id = sf.id) AS slot_group_count
          FROM scheduling_form sf
          WHERE sf.deleted_at IS NULL
            AND sf.program_id IS NULL
            AND sf.programs_id IS NULL
          ORDER BY sf.created_at ASC
          `,
        )
        res.json({
          success: true,
          data: result.rows.map((row) => ({
            ...mapFormRow(row),
            programId: null,
            programsId: null,
            eventLinked: Boolean(row.event_linked),
            signupCount: Number(row.signup_count),
            slotGroupCount: Number(row.slot_group_count),
          })),
        })
      } catch (err) {
        console.error('[scheduling] listLegacyForms:', err)
        res.status(500).json({ success: false, message: 'Failed to load legacy forms' })
      }
    },

    async getAdminCalendar(req, res) {
      try {
        const range = parseCalendarDateRange(req.query)
        if (range.error) {
          return res.status(400).json({ success: false, message: range.error })
        }

        const programsId = req.query.programsId != null ? Number(req.query.programsId) : null
        if (req.query.programsId != null && !Number.isInteger(programsId)) {
          return res.status(400).json({ success: false, message: 'Invalid programsId' })
        }

        const programId = req.query.programId != null ? Number(req.query.programId) : null
        if (req.query.programId != null && !Number.isInteger(programId)) {
          return res.status(400).json({ success: false, message: 'Invalid programId' })
        }

        const formActive = String(req.query.formActive || 'all').toLowerCase()
        if (!['all', 'active', 'inactive'].includes(formActive)) {
          return res.status(400).json({ success: false, message: 'Invalid formActive filter' })
        }

        const data = await loadSchedulingCalendar(pool, {
          startDate: range.startDate,
          endDate: range.endDate,
          programsId,
          programId,
          formActive,
          publicOnly: false,
        })
        res.json({ success: true, data })
      } catch (err) {
        console.error('[scheduling] getAdminCalendar:', err)
        res.status(500).json({ success: false, message: 'Failed to load calendar' })
      }
    },

    async getPublicCalendar(req, res) {
      try {
        const range = parseCalendarDateRange(req.query)
        if (range.error) {
          return res.status(400).json({ success: false, message: range.error })
        }

        const programsId = req.query.programsId != null ? Number(req.query.programsId) : null
        if (req.query.programsId != null && !Number.isInteger(programsId)) {
          return res.status(400).json({ success: false, message: 'Invalid programsId' })
        }

        const programId = req.query.programId != null ? Number(req.query.programId) : null
        if (req.query.programId != null && !Number.isInteger(programId)) {
          return res.status(400).json({ success: false, message: 'Invalid programId' })
        }

        const { isEnrollSiteKey } = await import('./enrollSites.js')
        const site = String(req.query.site || 'athletics')
        if (!isEnrollSiteKey(site)) {
          return res.status(400).json({ success: false, message: 'Invalid enroll site' })
        }

        const data = await loadSchedulingCalendar(pool, {
          startDate: range.startDate,
          endDate: range.endDate,
          programsId,
          programId,
          formActive: 'active',
          publicOnly: true,
          site,
        })
        res.json({ success: true, data })
      } catch (err) {
        console.error('[scheduling] getPublicCalendar:', err)
        res.status(500).json({ success: false, message: 'Failed to load calendar' })
      }
    },

    async listPublicSchedulingClasses(_req, res) {
      try {
        const data = await loadPublicSchedulingClasses(pool)
        res.json({ success: true, data })
      } catch (err) {
        console.error('[scheduling] listPublicSchedulingClasses:', err)
        res.status(500).json({ success: false, message: 'Failed to load classes' })
      }
    },

    async listAdminForms(_req, res) {
      try {
        const result = await pool.query(
          'SELECT * FROM scheduling_form WHERE deleted_at IS NULL ORDER BY created_at DESC',
        )
        res.json({ success: true, data: result.rows.map(mapFormRow) })
      } catch (err) {
        console.error('[scheduling] listAdminForms:', err)
        res.status(500).json({ success: false, message: 'Failed to load forms' })
      }
    },

    async getAdminForm(req, res) {
      try {
        const detail = await loadFormDetail(pool, Number(req.params.id), {
          includeInactive: true,
        })
        if (!detail) {
          return res.status(404).json({ success: false, message: 'Form not found' })
        }
        res.json({ success: true, data: detail })
      } catch (err) {
        console.error('[scheduling] getAdminForm:', err)
        res.status(500).json({ success: false, message: 'Failed to load form' })
      }
    },

    async createAdminForm(req, res) {
      try {
        const { error, value } = formSchema.validate(req.body)
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const result = await pool.query(
          `
          INSERT INTO scheduling_form (
            title, description, start_date, end_date, is_active, signup_fields,
            max_slots_per_user, slot_cost_monthly_cents, free_slots_per_user
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
          `,
          [
            value.title,
            value.description || null,
            formatDateOnly(value.startDate),
            formatDateOnly(value.endDate),
            value.isActive !== false,
            JSON.stringify([...DEFAULT_SIGNUP_FIELDS]),
            value.maxSlotsPerUser ?? null,
            value.slotCostMonthlyCents ?? 0,
            value.freeSlotsPerUser ?? 0,
          ],
        )
        res.json({ success: true, data: await mapFormRowWithPricing(pool, result.rows[0]) })
      } catch (err) {
        console.error('[scheduling] createAdminForm:', err)
        res.status(500).json({ success: false, message: 'Failed to create form' })
      }
    },

    async updateAdminForm(req, res) {
      try {
        const { error, value } = formSchema.validate(req.body)
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const existing = await pool.query(
          'SELECT * FROM scheduling_form WHERE id = $1 AND deleted_at IS NULL',
          [req.params.id],
        )
        if (existing.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Form not found' })
        }
        const formRow = existing.rows[0]
        const programRow =
          formRow.programs_id != null
            ? await loadProgramPricingRow(pool, Number(formRow.programs_id))
            : null

        let overrides = value.pricingOverridesProgram
        if (overrides === undefined) {
          overrides = Boolean(formRow.pricing_overrides_program)
        }

        let maxSlots =
          value.maxSlotsPerUser !== undefined ? value.maxSlotsPerUser : formRow.max_slots_per_user
        let costCents =
          value.slotCostMonthlyCents !== undefined
            ? value.slotCostMonthlyCents
            : Number(formRow.slot_cost_monthly_cents ?? 0)
        let freeSlots =
          value.freeSlotsPerUser !== undefined
            ? value.freeSlotsPerUser
            : Number(formRow.free_slots_per_user ?? 0)
        let maxFreeTotal =
          value.maxFreeSlotsTotal !== undefined
            ? value.maxFreeSlotsTotal
            : formRow.max_free_slots_total
        let costUnit =
          value.costUnit !== undefined ? value.costUnit : formRow.cost_unit ?? 'per_month'

        if (overrides && !formRow.pricing_overrides_program) {
          const effective = resolveEffectiveFormPricing(programRow, formRow)
          if (value.maxSlotsPerUser === undefined) maxSlots = effective.maxSlotsPerUser
          if (value.slotCostMonthlyCents === undefined) costCents = effective.slotCostMonthlyCents
          if (value.freeSlotsPerUser === undefined) freeSlots = effective.freeSlotsPerUser
          if (value.maxFreeSlotsTotal === undefined) maxFreeTotal = effective.maxFreeSlotsTotal
          if (value.costUnit === undefined) costUnit = effective.costUnit
        }

        const result = await pool.query(
          `
          UPDATE scheduling_form
          SET title = $1, description = $2, start_date = $3, end_date = $4,
              is_active = COALESCE($5, is_active),
              max_slots_per_user = $6,
              slot_cost_monthly_cents = COALESCE($7, slot_cost_monthly_cents),
              free_slots_per_user = COALESCE($8, free_slots_per_user),
              max_free_slots_total = $9,
              pricing_overrides_program = $10,
              cost_amount_cents = COALESCE($7, cost_amount_cents),
              cost_unit = COALESCE($12, cost_unit),
              updated_at = now()
          WHERE id = $11 AND deleted_at IS NULL
          RETURNING *
          `,
          [
            value.title,
            value.description || null,
            formatDateOnly(value.startDate),
            formatDateOnly(value.endDate),
            value.isActive,
            maxSlots !== undefined ? maxSlots : null,
            costCents,
            freeSlots,
            maxFreeTotal !== undefined ? maxFreeTotal : null,
            overrides,
            req.params.id,
            costUnit,
          ],
        )
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Form not found' })
        }
        res.json({ success: true, data: await mapFormRowWithPricing(pool, result.rows[0]) })
      } catch (err) {
        console.error('[scheduling] updateAdminForm:', err)
        res.status(500).json({ success: false, message: 'Failed to update form' })
      }
    },

    async resetAdminFormPricing(req, res) {
      try {
        const { resetClassPricingToProgram } = await import('../programs/pricingDefaults.js')
        const { ensureProgramPricingColumns } = await import('../programs/schema.js')
        await ensureProgramPricingColumns(pool)
        const ok = await resetClassPricingToProgram(pool, Number(req.params.id))
        if (!ok) {
          return res.status(404).json({ success: false, message: 'Form not found' })
        }
        const existing = await pool.query(
          'SELECT * FROM scheduling_form WHERE id = $1 AND deleted_at IS NULL',
          [req.params.id],
        )
        res.json({ success: true, data: await mapFormRowWithPricing(pool, existing.rows[0]) })
      } catch (err) {
        console.error('[scheduling] resetAdminFormPricing:', err)
        res.status(500).json({ success: false, message: 'Failed to reset pricing' })
      }
    },

    async updateSignupFields(req, res) {
      try {
        const { error, value } = signupFieldsSchema.validate(req.body)
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const mandateWaiver = Boolean(value.mandateWaiver)
        const mergedFields = mergeSignupFieldsForSave(value.signupFields, mandateWaiver)
        const result = await pool.query(
          `
          UPDATE scheduling_form
          SET signup_fields = $1, mandate_waiver = $2, updated_at = now()
          WHERE id = $3 AND deleted_at IS NULL
          RETURNING *
          `,
          [JSON.stringify(mergedFields), mandateWaiver, req.params.id],
        )
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Form not found' })
        }
        res.json({ success: true, data: mapFormRow(result.rows[0]) })
      } catch (err) {
        console.error('[scheduling] updateSignupFields:', err)
        res.status(500).json({ success: false, message: 'Failed to update signup fields' })
      }
    },

    async patchAdminFormActive(req, res) {
      try {
        const { normalizeEnrollSites } = await import('./enrollSites.js')
        let enrollSites = null
        if (Array.isArray(req.body.enrollSites)) {
          enrollSites = normalizeEnrollSites(req.body.enrollSites, false)
        }
        const isActive =
          enrollSites != null ? enrollSites.length > 0 : Boolean(req.body.isActive)
        if (enrollSites == null && req.body.isActive === false) {
          enrollSites = []
        } else if (enrollSites == null && req.body.isActive === true) {
          enrollSites = normalizeEnrollSites(null, true)
        }
        const result = await pool.query(
          `
          UPDATE scheduling_form
          SET is_active = $1, enroll_sites = $2, updated_at = now()
          WHERE id = $3 AND deleted_at IS NULL
          RETURNING *
          `,
          [isActive, enrollSites, req.params.id],
        )
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Form not found' })
        }
        res.json({ success: true, data: mapFormRow(result.rows[0]) })
      } catch (err) {
        console.error('[scheduling] patchAdminFormActive:', err)
        res.status(500).json({ success: false, message: 'Failed to update form visibility' })
      }
    },

    async deleteAdminForm(req, res) {
      try {
        await pool.query(
          `UPDATE events SET scheduling_form_id = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE scheduling_form_id = $1`,
          [req.params.id],
        )
        const result = await pool.query(
          `
          UPDATE scheduling_form
          SET deleted_at = now(), is_active = FALSE, updated_at = now()
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING id
          `,
          [req.params.id],
        )
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Form not found' })
        }
        res.json({ success: true, message: 'Form deleted' })
      } catch (err) {
        console.error('[scheduling] deleteAdminForm:', err)
        res.status(500).json({ success: false, message: 'Failed to delete form' })
      }
    },

    async listOfferings(req, res) {
      try {
        const formId = Number(req.params.formId)
        const result = await pool.query(
          'SELECT * FROM scheduling_offering WHERE form_id = $1 ORDER BY start_date DESC, id DESC',
          [formId],
        )
        res.json({ success: true, data: result.rows.map(mapOfferingRow) })
      } catch (err) {
        console.error('[scheduling] listOfferings:', err)
        res.status(500).json({ success: false, message: 'Failed to load offerings' })
      }
    },

    async createOffering(req, res) {
      try {
        const { error, value } = offeringSchema.validate(sanitizeOfferingBody(req.body))
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const formId = Number(req.params.formId)
        const evergreen = Boolean(value.evergreen)
        const validated = validateOfferingDateRange(value.startDate, value.endDate, evergreen)
        if (!validated.ok) {
          return res.status(400).json({ success: false, message: validated.message })
        }
        const { startDate, endDate } = validated
        const countRes = await pool.query(
          'SELECT COUNT(*)::int AS c FROM scheduling_offering WHERE form_id = $1',
          [formId],
        )
        const isFirst = Number(countRes.rows[0].c) === 0
        const result = await pool.query(
          `
          INSERT INTO scheduling_offering (form_id, start_date, end_date, label, is_selected)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
          `,
          [formId, startDate, endDate, value.label || null, isFirst],
        )
        res.json({ success: true, data: mapOfferingRow(result.rows[0]) })
      } catch (err) {
        console.error('[scheduling] createOffering:', err)
        res.status(500).json({ success: false, message: 'Failed to create offering' })
      }
    },

    async updateOffering(req, res) {
      const client = await pool.connect()
      try {
        const { error, value } = offeringUpdateSchema.validate(sanitizeOfferingBody(req.body))
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        await client.query('BEGIN')
        const existingRes = await client.query(
          'SELECT * FROM scheduling_offering WHERE id = $1 FOR UPDATE',
          [req.params.id],
        )
        if (existingRes.rows.length === 0) {
          await client.query('ROLLBACK')
          return res.status(404).json({ success: false, message: 'Offering not found' })
        }
        const existing = existingRes.rows[0]

        const updates = []
        const vals = []
        let n = 1
        if (value.startDate !== undefined) {
          updates.push(`start_date = $${n++}`)
          vals.push(formatDateOnly(value.startDate))
        }
        if (value.evergreen === true) {
          updates.push('end_date = NULL')
        } else if (value.endDate !== undefined) {
          updates.push(`end_date = $${n++}`)
          vals.push(formatDateOnly(value.endDate))
        }
        if (value.label !== undefined) {
          updates.push(`label = $${n++}`)
          vals.push(value.label || null)
        }
        if (updates.length === 0) {
          await client.query('ROLLBACK')
          return res.status(400).json({ success: false, message: 'No fields to update' })
        }

        const newStart =
          value.startDate !== undefined
            ? formatDateOnly(value.startDate)
            : formatDateOnly(existing.start_date)
        const newEnd =
          value.evergreen === true
            ? null
            : value.endDate !== undefined
              ? formatDateOnly(value.endDate)
              : formatDateOnly(existing.end_date)
        const willBeEvergreen = newEnd == null
        const validated = validateOfferingDateRange(newStart, newEnd, willBeEvergreen)
        if (!validated.ok) {
          await client.query('ROLLBACK')
          return res.status(400).json({ success: false, message: validated.message })
        }

        updates.push('updated_at = now()')
        vals.push(req.params.id)
        const result = await client.query(
          `UPDATE scheduling_offering SET ${updates.join(', ')} WHERE id = $${n} RETURNING *`,
          vals,
        )
        const updated = result.rows[0]

        const oldStart = formatDateOnly(existing.start_date)
        const oldEnd = formatDateOnly(existing.end_date)
        const datesChanged = oldStart !== validated.startDate || oldEnd !== validated.endDate
        if (datesChanged) {
          await syncOfferingDatesToSlotGroups(client, Number(updated.id), {
            newStart: validated.startDate,
            newEnd: validated.endDate,
            oldStart,
            oldEnd,
          })
        }

        await client.query('COMMIT')
        res.json({ success: true, data: mapOfferingRow(updated) })
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        console.error('[scheduling] updateOffering:', err)
        res.status(500).json({ success: false, message: 'Failed to update offering' })
      } finally {
        client.release()
      }
    },

    async selectOffering(req, res) {
      try {
        const offeringRes = await pool.query(
          'SELECT * FROM scheduling_offering WHERE id = $1',
          [req.params.id],
        )
        if (offeringRes.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Offering not found' })
        }
        const row = offeringRes.rows[0]
        await pool.query(
          `UPDATE scheduling_offering SET is_selected = FALSE, updated_at = now()
           WHERE form_id = $1`,
          [row.form_id],
        )
        const result = await pool.query(
          `UPDATE scheduling_offering SET is_selected = TRUE, updated_at = now()
           WHERE id = $1 RETURNING *`,
          [req.params.id],
        )
        res.json({ success: true, data: mapOfferingRow(result.rows[0]) })
      } catch (err) {
        console.error('[scheduling] selectOffering:', err)
        res.status(500).json({ success: false, message: 'Failed to select offering' })
      }
    },

    async deleteOffering(req, res) {
      try {
        const refs = await pool.query(
          'SELECT COUNT(*)::int AS c FROM scheduling_slot_group WHERE offering_id = $1',
          [req.params.id],
        )
        if (Number(refs.rows[0].c) > 0) {
          return res.status(409).json({
            success: false,
            message: 'Cannot delete: slots reference this offering',
          })
        }
        const result = await pool.query(
          'DELETE FROM scheduling_offering WHERE id = $1 RETURNING id',
          [req.params.id],
        )
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Offering not found' })
        }
        res.json({ success: true, message: 'Offering deleted' })
      } catch (err) {
        console.error('[scheduling] deleteOffering:', err)
        res.status(500).json({ success: false, message: 'Failed to delete offering' })
      }
    },

    async createSlotBatch(req, res) {
      try {
        const { error, value } = slotBatchSchema.validate(req.body, { abortEarly: false })
        if (error) {
          return res.status(400).json({
            success: false,
            message: error.details[0].message,
            errors: error.details.map((d) => d.message),
          })
        }

        const rows = expandSlotBatch(value)
        if (rows.length === 0) {
          return res.status(400).json({ success: false, message: 'No slots to create' })
        }

        const batchActiveStart =
          value.activeDatesMode === 'custom' ? formatDateOnly(value.activeStart) : null
        const batchActiveEnd =
          value.activeDatesMode === 'custom' ? formatDateOnly(value.activeEnd) : null
        const batchDatesTbd = value.activeDatesMode === 'tbd'

        let offeringRow = null
        if (value.offeringId != null) {
          const offRes = await pool.query(
            'SELECT * FROM scheduling_offering WHERE id = $1 AND form_id = $2',
            [value.offeringId, req.params.formId],
          )
          if (offRes.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid offering' })
          }
          offeringRow = offRes.rows[0]
        }

        let resolvedActiveStart = batchActiveStart
        let resolvedActiveEnd = batchActiveEnd
        const inheritsOfferingDates =
          value.activeDatesMode === 'inherit' && value.offeringId != null && !batchDatesTbd
        if (value.activeDatesMode === 'inherit') {
          if (offeringRow) {
            resolvedActiveStart = formatDateOnly(offeringRow.start_date)
            resolvedActiveEnd = formatDateOnly(offeringRow.end_date)
          } else {
            const formRes = await pool.query(
              'SELECT start_date, end_date FROM scheduling_form WHERE id = $1',
              [req.params.formId],
            )
            resolvedActiveStart = formatDateOnly(formRes.rows[0]?.start_date)
            resolvedActiveEnd = formatDateOnly(formRes.rows[0]?.end_date)
          }
        }

        const client = await pool.connect()
        let groupRow = null
        const inserted = []
        try {
          await client.query('BEGIN')

          const groupRes = await client.query(
            `
            INSERT INTO scheduling_slot_group (
              form_id, offering_id, schedule_mode, max_participants,
              active_start, active_end, dates_tbd, inherits_offering_dates, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
            RETURNING *
            `,
            [
              req.params.formId,
              value.offeringId ?? null,
              value.scheduleMode,
              value.maxParticipants,
              resolvedActiveStart,
              resolvedActiveEnd,
              batchDatesTbd,
              inheritsOfferingDates,
            ],
          )
          groupRow = groupRes.rows[0]
          const groupId = groupRow.id

          for (const row of rows) {
            const result = await client.query(
              `
              INSERT INTO scheduling_time_slot (
                form_id, slot_group_id, schedule_mode, week_letter, day_of_week, specific_date,
                start_time, end_time, max_participants, active_start, active_end, dates_tbd, is_active
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE)
              RETURNING *
              `,
              [
                req.params.formId,
                groupId,
                row.scheduleMode,
                row.weekLetter,
                row.dayOfWeek,
                row.specificDate,
                row.startTime,
                row.endTime,
                value.maxParticipants,
                row.activeStart,
                row.activeEnd,
                row.datesTbd,
              ],
            )
            inserted.push(result.rows[0])
          }
          await client.query('COMMIT')
        } catch (e) {
          await client.query('ROLLBACK')
          throw e
        } finally {
          client.release()
        }

        const formRes = await pool.query('SELECT * FROM scheduling_form WHERE id = $1', [req.params.formId])
        const form = formRes.rows[0]
        const offeringById = offeringRow
          ? new Map([[Number(offeringRow.id), offeringRow]])
          : new Map()
        res.json({
          success: true,
          data: mapSlotGroupRow(groupRow, inserted, 0, form, 0, offeringById),
          count: inserted.length,
        })
      } catch (err) {
        console.error('[scheduling] createSlotBatch:', err)
        res.status(500).json({ success: false, message: 'Failed to create slots' })
      }
    },

    async updateTimeSlot(req, res) {
      try {
        if (req.body.scheduleMode) {
          const { error, value } = slotBatchSchema.validate(req.body, { abortEarly: false })
          if (error) {
            return res.status(400).json({
              success: false,
              message: error.details[0].message,
              errors: error.details.map((d) => d.message),
            })
          }

          const rows = expandSlotBatch(value)
          if (rows.length !== 1) {
            return res.status(400).json({
              success: false,
              message: 'Edit must define exactly one time slot',
            })
          }

          const row = rows[0]
          const result = await pool.query(
            `
            UPDATE scheduling_time_slot
            SET schedule_mode = $1, week_letter = $2, day_of_week = $3,
                specific_date = $4, start_time = $5, end_time = $6, max_participants = $7,
                active_start = $8, active_end = $9, dates_tbd = $10, updated_at = now()
            WHERE id = $11
            RETURNING *
            `,
            [
              row.scheduleMode,
              row.weekLetter,
              row.dayOfWeek,
              row.specificDate,
              row.startTime,
              row.endTime,
              row.maxParticipants,
              row.activeStart,
              row.activeEnd,
              row.datesTbd,
              req.params.id,
            ],
          )
          if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Time slot not found' })
          }
          const formRes = await pool.query('SELECT * FROM scheduling_form WHERE id = $1', [result.rows[0].form_id])
          const signupRes = await pool.query(
            `SELECT COUNT(*)::int AS c FROM scheduling_signup WHERE time_slot_id = $1 AND status = 'confirmed'`,
            [req.params.id],
          )
          return res.json({
            success: true,
            data: mapSlotRow(result.rows[0], signupRes.rows[0].c, formRes.rows[0]),
          })
        }

        const maxParticipants = Number(req.body.maxParticipants)
        if (!maxParticipants || maxParticipants < 1) {
          return res.status(400).json({ success: false, message: 'Invalid max participants' })
        }
        const result = await pool.query(
          `
          UPDATE scheduling_time_slot
          SET max_participants = $1, updated_at = now()
          WHERE id = $2
          RETURNING *
          `,
          [maxParticipants, req.params.id],
        )
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Time slot not found' })
        }
        res.json({ success: true, data: mapSlotRow(result.rows[0], 0) })
      } catch (err) {
        console.error('[scheduling] updateTimeSlot:', err)
        res.status(500).json({ success: false, message: 'Failed to update time slot' })
      }
    },

    async deleteTimeSlot(req, res) {
      try {
        const slotRes = await pool.query(
          'SELECT id, slot_group_id FROM scheduling_time_slot WHERE id = $1',
          [req.params.id],
        )
        if (slotRes.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Time slot not found' })
        }

        const groupId = slotRes.rows[0].slot_group_id
        if (groupId) {
          const remainingBefore = await pool.query(
            `SELECT COUNT(*)::int AS c FROM scheduling_time_slot WHERE slot_group_id = $1`,
            [groupId],
          )
          const isLastSlot = Number(remainingBefore.rows[0].c) <= 1
          if (!isLastSlot) {
            const signupRes = await pool.query(
              `SELECT COUNT(*)::int AS c FROM scheduling_signup WHERE slot_group_id = $1 AND status IN ('confirmed', 'waitlisted')`,
              [groupId],
            )
            if (Number(signupRes.rows[0].c) > 0) {
              return res.status(409).json({
                success: false,
                message: 'Cannot delete: active signups exist for this schedule',
              })
            }
          }
        }

        await pool.query('DELETE FROM scheduling_time_slot WHERE id = $1', [req.params.id])

        if (groupId) {
          const remaining = await pool.query(
            `SELECT COUNT(*)::int AS c FROM scheduling_time_slot WHERE slot_group_id = $1`,
            [groupId],
          )
          if (Number(remaining.rows[0].c) === 0) {
            await orphanSignupsForSlotGroup(pool, groupId)
            await pool.query('DELETE FROM scheduling_slot_group WHERE id = $1', [groupId])
          }
        }

        res.json({ success: true, message: 'Time slot deleted' })
      } catch (err) {
        console.error('[scheduling] deleteTimeSlot:', err)
        res.status(500).json({ success: false, message: 'Failed to delete time slot' })
      }
    },

    async deleteSlotGroup(req, res) {
      try {
        await orphanSignupsForSlotGroup(pool, req.params.id)
        const result = await pool.query('DELETE FROM scheduling_slot_group WHERE id = $1 RETURNING id', [
          req.params.id,
        ])
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Slot group not found' })
        }
        res.json({ success: true, message: 'Time slot deleted' })
      } catch (err) {
        console.error('[scheduling] deleteSlotGroup:', err)
        res.status(500).json({ success: false, message: 'Failed to delete time slot' })
      }
    },

    async adminCreateSignup(req, res) {
      try {
        const { error, value } = adminSignupSchema.validate(req.body, { abortEarly: false })
        if (error) {
          const msg = error.details[0]?.message || 'Validation error'
          return res.status(400).json({
            success: false,
            message: msg,
            errors: error.details.map((d) => d.message),
          })
        }

        const formRes = await pool.query('SELECT * FROM scheduling_form WHERE id = $1', [value.formId])
        if (formRes.rows.length === 0 || formRes.rows[0].deleted_at || !formRes.rows[0].is_active) {
          return res.status(404).json({ success: false, message: 'Scheduling form not available' })
        }
        const formRow = formRes.rows[0]
        const detail = await loadFormDetail(pool, value.formId)
        if (!detail) {
          return res.status(404).json({ success: false, message: 'Scheduling form not available' })
        }

        const group = detail.slotGroups.find((g) => g.id === value.slotGroupId)
        if (!group) {
          return res.status(400).json({ success: false, message: 'Invalid time slot group' })
        }
        const firstOccurrence =
          (value.timeSlotId != null
            ? group.occurrences.find((o) => o.id === value.timeSlotId)
            : null) ?? group.occurrences[0]
        if (!firstOccurrence) {
          return res.status(400).json({ success: false, message: 'Time slot has no schedule entries' })
        }
        if (value.timeSlotId != null && firstOccurrence.id !== value.timeSlotId) {
          return res.status(400).json({ success: false, message: 'Invalid time slot selection' })
        }

        const client = await pool.connect()
        try {
          await client.query('BEGIN')

          let memberId = value.memberId != null ? Number(value.memberId) : null
          let member = null
          let createdNewStubMemberId = null

          if (memberId) {
            member = await findMemberById(client, memberId)
            if (!member) {
              await client.query('ROLLBACK')
              return res.status(404).json({ success: false, message: 'Member not found' })
            }
          } else {
            const email = String(value.email || '').trim()
            member = await findMemberByEmail(client, email)
            if (member) {
              memberId = Number(member.id)
            } else {
              const firstName = String(value.firstName || value.responses?.first_name || '').trim()
              const lastName = String(value.lastName || value.responses?.last_name || '').trim()
              if (!firstName || !lastName) {
                await client.query('ROLLBACK')
                return res.status(400).json({
                  success: false,
                  message: 'First and last name required for new accounts',
                })
              }
              const generatedPassword = crypto.randomBytes(12).toString('base64url')
              memberId = await createMemberStub(client, {
                firstName,
                lastName,
                email,
                password: generatedPassword,
                phone: value.phone ? String(value.phone) : null,
              })
              createdNewStubMemberId = memberId
              member = await findMemberById(client, memberId)
            }
          }

          const responses = {
            first_name: member.first_name,
            last_name: member.last_name,
            email: member.email,
            phone: member.phone || value.phone || value.responses?.phone || null,
            ...value.responses,
          }

          const profileComplete =
            member.profile_complete != null ? Boolean(member.profile_complete) : false
          const adminStub = computeAdminStub(
            profileComplete,
            detail.signupFields,
            responses,
            detail.mandateWaiver,
          )

          const signupResult = await insertSignupForMember(client, {
            formId: value.formId,
            formRow,
            slotGroupId: value.slotGroupId,
            memberId,
            responses,
            firstOccurrenceId: firstOccurrence.id,
            formTitle: detail.title,
            mandateWaiver: detail.mandateWaiver,
            groupDisplayLabel: group.displayLabel,
            firstOccurrenceLabel: firstOccurrence.displayLabel,
            adminStub,
          })

          const currentSchool =
            responses.current_school != null ? String(responses.current_school).trim() : ''
          if (currentSchool) {
            await linkMemberToSchoolFromName(client, memberId, currentSchool, 'signup')
          }

          await client.query('COMMIT')

          if (createdNewStubMemberId) {
            void notifyWelcomeNewMember(pool, createdNewStubMemberId, { context: 'scheduling_stub' })
          }

          const { signupId, signupStatus, positions, pricing } = signupResult
          if (value.sendEmails) {
            await sendSignupNotificationEmails(pool, {
              signupStatus,
              signupId,
              memberId,
              responses,
              formTitle: detail.title,
              slotLabel: signupResult.slotLabel,
              pricing,
              mandateWaiver: detail.mandateWaiver,
            })
          }

          const refreshed = await pool.query('SELECT * FROM scheduling_signup WHERE id = $1', [signupId])
          const positionMessage = buildSignupPositionMessage({
            status: signupStatus,
            ...positions,
          })

          res.json({
            success: true,
            message: positionMessage,
            data: {
              ...mapSignupRow(refreshed.rows[0], positions),
              adminStub,
            },
          })
        } catch (txErr) {
          await client.query('ROLLBACK')
          if (txErr.code === 'MAX_SLOTS') {
            return res.status(400).json({ success: false, message: txErr.message })
          }
          if (txErr.code === 'SLOT_UNAVAILABLE') {
            return res.status(400).json({ success: false, message: txErr.message })
          }
          if (txErr.message?.includes('already exists')) {
            return res.status(400).json({ success: false, message: txErr.message })
          }
          throw txErr
        } finally {
          client.release()
        }
      } catch (err) {
        console.error('[scheduling] adminCreateSignup:', err)
        res.status(500).json({ success: false, message: err.message || 'Failed to create signup' })
      }
    },

    async listSignups(req, res) {
      try {
        const formId = req.query.formId ? Number(req.query.formId) : null
        const archivedOnly =
          req.query.archived === 'true' || req.query.archived === '1'
        const params = []
        let where = '1=1 AND s.orphaned_at IS NULL'
        where += archivedOnly ? ' AND s.archived_at IS NOT NULL' : ' AND s.archived_at IS NULL'
        if (formId) {
          params.push(formId)
          where += ` AND s.form_id = $${params.length}`
        }
        const result = await pool.query(
          `
          SELECT s.*, f.title AS form_title,
            f.signup_fields, f.mandate_waiver,
            m.profile_complete,
            ts.week_letter, ts.day_of_week, ts.specific_date, ts.start_time, ts.end_time, ts.schedule_mode,
            (
              SELECT COUNT(*)::int FROM scheduling_signup s2
              WHERE s2.form_id = s.form_id AND s2.member_id = s.member_id
                AND s2.status IN ('confirmed', 'waitlisted')
            ) AS total_slots_for_user,
            (
              SELECT COALESCE(json_agg(
                json_build_object(
                  'week_letter', o.week_letter,
                  'day_of_week', o.day_of_week,
                  'specific_date', o.specific_date,
                  'start_time', o.start_time,
                  'end_time', o.end_time,
                  'schedule_mode', o.schedule_mode
                )
                ORDER BY o.week_letter NULLS LAST, o.day_of_week NULLS LAST, o.specific_date NULLS LAST, o.start_time
              ), '[]'::json)
              FROM scheduling_time_slot o
              WHERE o.slot_group_id = s.slot_group_id
            ) AS group_occurrences
          FROM scheduling_signup s
          LEFT JOIN scheduling_time_slot ts ON ts.id = s.time_slot_id
          LEFT JOIN member m ON m.id = s.member_id
          JOIN scheduling_form f ON f.id = s.form_id
          WHERE ${where}
          ORDER BY s.created_at DESC
          `,
          params,
        )

        for (const row of result.rows) {
          if (!row.admin_stub) continue
          const signupFields = Array.isArray(row.signup_fields) ? row.signup_fields : []
          if (!effectiveAdminStub(row, signupFields, Boolean(row.mandate_waiver))) {
            await pool.query('UPDATE scheduling_signup SET admin_stub = FALSE WHERE id = $1', [row.id])
            row.admin_stub = false
          }
        }

        const enriched = await attachPositionsToSignups(pool, result.rows)
        res.json({
          success: true,
          data: enriched.map((mapped, i) => {
            const row = result.rows[i]
            const signupFields = Array.isArray(row.signup_fields) ? row.signup_fields : []
            const occurrences = Array.isArray(row.group_occurrences) ? row.group_occurrences : []
            const slotLabel =
              occurrences.length > 0
                ? buildGroupDisplayLabel(occurrences)
                : buildSlotDisplayLabel(row)
            return {
              ...mapped,
              slotLabel,
              adminStub: effectiveAdminStub(row, signupFields, Boolean(row.mandate_waiver)),
            }
          }),
        })
      } catch (err) {
        console.error('[scheduling] listSignups:', err)
        res.status(500).json({ success: false, message: 'Failed to load signups' })
      }
    },

    async updateSignupStatus(req, res) {
      try {
        if (req.body.archived !== undefined) {
          const archived = Boolean(req.body.archived)
          const existing = await pool.query(
            'SELECT * FROM scheduling_signup WHERE id = $1 AND orphaned_at IS NULL',
            [req.params.id],
          )
          if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Signup not found' })
          }
          const signup = existing.rows[0]
          if (archived && signup.status !== 'cancelled') {
            return res.status(400).json({
              success: false,
              message: 'Only cancelled signups can be archived',
            })
          }
          const result = await pool.query(
            `
            UPDATE scheduling_signup
            SET archived_at = CASE WHEN $1::boolean THEN now() ELSE NULL END
            WHERE id = $2
            RETURNING *
            `,
            [archived, req.params.id],
          )
          const updatedRow = result.rows[0]
          const positions = updatedRow?.slot_group_id
            ? await computeSignupPositions(pool, updatedRow.slot_group_id, updatedRow.id)
            : {}
          return res.json({ success: true, data: mapSignupRow(updatedRow, positions) })
        }

        const status = req.body.status
        if (!['confirmed', 'waitlisted', 'cancelled', 'paused', 'completed'].includes(status)) {
          return res.status(400).json({ success: false, message: 'Invalid status' })
        }

        try {
          await ensureEnrollmentLifecycleColumns(pool)
        } catch (schemaErr) {
          console.warn('[scheduling] status schema ensure:', schemaErr?.message ?? schemaErr)
        }

        const client = await pool.connect()
        let updatedRow = null
        let promotedRows = []
        let previousStatus = null
        let targetStatus = status

        try {
          await client.query('BEGIN')

          const existing = await client.query(
            'SELECT * FROM scheduling_signup WHERE id = $1 FOR UPDATE',
            [req.params.id],
          )
          if (existing.rows.length === 0) {
            await client.query('ROLLBACK')
            return res.status(404).json({ success: false, message: 'Signup not found' })
          }

          const signup = existing.rows[0]
          previousStatus = signup.status
          targetStatus = status

          if (
            status === 'confirmed' &&
            (previousStatus === 'cancelled' || previousStatus === 'completed') &&
            signup.slot_group_id
          ) {
            await client.query(
              'SELECT id FROM scheduling_slot_group WHERE id = $1 FOR UPDATE',
              [signup.slot_group_id],
            )
            const capRes = await client.query(
              `
              SELECT sg.max_participants,
                (SELECT COUNT(*)::int FROM scheduling_signup s
                 WHERE s.slot_group_id = sg.id AND s.status = 'confirmed') AS signup_count
              FROM scheduling_slot_group sg
              WHERE sg.id = $1
              `,
              [signup.slot_group_id],
            )
            if (capRes.rows.length === 0) {
              await client.query('ROLLBACK')
              return res.status(400).json({ success: false, message: 'Time slot no longer exists' })
            }
            const { max_participants, signup_count } = capRes.rows[0]
            targetStatus =
              Number(signup_count) < Number(max_participants) ? 'confirmed' : 'waitlisted'
          }

          const result = await updateSignupLifecycleStatus(client, req.params.id, targetStatus)
          updatedRow = result.rows[0]

          // Freeing a confirmed spot (cancel/complete) can promote from the waitlist.
          if (
            previousStatus === 'confirmed' &&
            (targetStatus === 'cancelled' || targetStatus === 'completed') &&
            signup.slot_group_id
          ) {
            promotedRows =
              (await trySavepoint(
                client,
                async () => {
                  await client.query(
                    'SELECT id FROM scheduling_slot_group WHERE id = $1 FOR UPDATE',
                    [signup.slot_group_id],
                  )
                  return promoteFromWaitlist(client, signup.slot_group_id, 1)
                },
                { logPrefix: '[scheduling] status promote waitlist' },
              )) ?? []
          }

          // Keep recurring subscriptions in sync with signup status.
          const source = { sourceType: 'scheduling_signup', sourceId: req.params.id }
          if (targetStatus === 'cancelled' && previousStatus !== 'cancelled') {
            await safeCancelSubscriptionsForSource(client, source)
            await safeRestorePassCreditsForSignup(client, {
              signupId: req.params.id,
              reason: 'Enrollment cancelled',
            })
          } else if (targetStatus === 'completed' && previousStatus !== 'completed') {
            await safeCancelSubscriptionsForSource(client, source)
          } else if (targetStatus === 'paused' && previousStatus !== 'paused') {
            await safeSetSubscriptionPausedForSource(client, { ...source, paused: true })
          } else if (targetStatus === 'confirmed' || targetStatus === 'waitlisted') {
            if (previousStatus === 'cancelled' || previousStatus === 'completed') {
              await safeReactivateSubscriptionForSource(client, source)
            } else if (previousStatus === 'paused') {
              await safeSetSubscriptionPausedForSource(client, { ...source, paused: false })
            }
          }

          await client.query('COMMIT')
        } catch (txErr) {
          await client.query('ROLLBACK')
          throw txErr
        } finally {
          client.release()
        }

        if (promotedRows.length > 0) {
          await sendPromotionEmails(pool, promotedRows)
        }

        if (updatedRow && targetStatus === 'confirmed' && previousStatus === 'cancelled') {
          try {
            const receipt = await notifyEnrollmentReceiptForSignup(pool, updatedRow.id, 'confirmed')
            if (receipt.sent) {
              await pool.query(
                'UPDATE scheduling_signup SET confirmation_email_sent_at = now() WHERE id = $1',
                [updatedRow.id],
              )
            }
          } catch (emailErr) {
            console.error('[scheduling] reconfirm email failed:', emailErr.message)
          }
        } else if (updatedRow && targetStatus === 'waitlisted' && previousStatus === 'cancelled') {
          try {
            const receipt = await notifyEnrollmentReceiptForSignup(pool, updatedRow.id, 'waitlisted')
            if (receipt.sent) {
              await pool.query(
                'UPDATE scheduling_signup SET confirmation_email_sent_at = now() WHERE id = $1',
                [updatedRow.id],
              )
            }
          } catch (emailErr) {
            console.error('[scheduling] reconfirm waitlist email failed:', emailErr.message)
          }
        }

        const positions = updatedRow?.slot_group_id
          ? await computeSignupPositions(pool, updatedRow.slot_group_id, updatedRow.id)
          : {}
        res.json({ success: true, data: mapSignupRow(updatedRow, positions) })
      } catch (err) {
        console.error('[scheduling] updateSignupStatus:', err)
        res.status(500).json({
          success: false,
          message: err?.message || 'Failed to update signup',
        })
      }
    },

    async resendSignupEmail(req, res) {
      try {
        const emailType = req.body?.emailType
        if (!['confirmation', 'waiver'].includes(emailType)) {
          return res.status(400).json({
            success: false,
            message: 'emailType must be confirmation or waiver',
          })
        }

        const signupId = Number(req.params.id)
        const ctx = await loadSignupContext(pool, signupId)
        if (!ctx) {
          return res.status(404).json({ success: false, message: 'Signup not found' })
        }

        const signup = ctx.signup

        if (emailType === 'confirmation') {
          if (signup.status === 'cancelled') {
            return res.status(400).json({
              success: false,
              message: 'Cannot resend confirmation for a cancelled signup',
            })
          }

          const receipt = await notifyEnrollmentReceiptForSignup(
            pool,
            signupId,
            signup.status === 'waitlisted' ? 'waitlisted' : 'confirmed',
          )
          if (!receipt.sent) {
            return res.status(400).json({
              success: false,
              message: 'Could not send enrollment receipt — member contact email may be missing.',
            })
          }
          await pool.query(
            'UPDATE scheduling_signup SET confirmation_email_sent_at = now() WHERE id = $1',
            [signupId],
          )
        } else {
          if (!ctx.mandateWaiver) {
            return res.status(400).json({
              success: false,
              message: 'Waiver is not mandated for this form',
            })
          }
          if (!ctx.parentEmail) {
            return res.status(400).json({ success: false, message: 'Parent email is missing' })
          }
          const responses =
            signup.responses && Object.keys(signup.responses).length > 0
              ? signup.responses
              : signup.field_responses || {}
          await sendWaiverEmail({
            parentFirstName: ctx.parentFirstName,
            parentEmail: ctx.parentEmail,
            athleteFirstName: ctx.registrantFirstName,
            athleteLastName: String(responses.last_name || signup.last_name || ''),
            formTitle: ctx.formTitle,
          })
          await pool.query(
            'UPDATE scheduling_signup SET waiver_email_sent_at = now() WHERE id = $1',
            [signupId],
          )
        }

        const refreshed = await pool.query('SELECT * FROM scheduling_signup WHERE id = $1', [signupId])
        const positions = signup.slot_group_id
          ? await computeSignupPositions(pool, signup.slot_group_id, signupId)
          : {}
        res.json({ success: true, data: mapSignupRow(refreshed.rows[0], positions) })
      } catch (err) {
        console.error('[scheduling] resendSignupEmail:', err?.cause || err)
        res.status(503).json({
          success: false,
          message: err.message || 'Failed to resend email',
        })
      }
    },

    async updateSlotGroupMax(req, res) {
      try {
        const maxParticipants = Number(req.body.maxParticipants)
        if (!maxParticipants || maxParticipants < 1) {
          return res.status(400).json({ success: false, message: 'Invalid max participants' })
        }

        const client = await pool.connect()
        let groupRow = null
        let promotedRows = []
        let demotedRows = []

        try {
          await client.query('BEGIN')

          const groupRes = await client.query(
            'SELECT * FROM scheduling_slot_group WHERE id = $1 FOR UPDATE',
            [req.params.id],
          )
          if (groupRes.rows.length === 0) {
            await client.query('ROLLBACK')
            return res.status(404).json({ success: false, message: 'Slot group not found' })
          }

          groupRow = groupRes.rows[0]
          const oldMax = Number(groupRow.max_participants)

          await client.query(
            'UPDATE scheduling_slot_group SET max_participants = $1, updated_at = now() WHERE id = $2',
            [maxParticipants, req.params.id],
          )
          await client.query(
            'UPDATE scheduling_time_slot SET max_participants = $1, updated_at = now() WHERE slot_group_id = $2',
            [maxParticipants, req.params.id],
          )

          const { promoted, demoted } = await rebalanceCapacity(
            client,
            Number(req.params.id),
            oldMax,
            maxParticipants,
          )
          promotedRows = promoted
          demotedRows = demoted

          await client.query('COMMIT')
        } catch (txErr) {
          await client.query('ROLLBACK')
          throw txErr
        } finally {
          client.release()
        }

        if (promotedRows.length > 0) {
          await sendPromotionEmails(pool, promotedRows)
        }
        if (demotedRows.length > 0) {
          await sendDemotionEmails(pool, demotedRows)
        }

        const formRes = await pool.query('SELECT * FROM scheduling_form WHERE id = $1', [groupRow.form_id])
        const occurrencesRes = await pool.query(
          'SELECT * FROM scheduling_time_slot WHERE slot_group_id = $1 ORDER BY id',
          [req.params.id],
        )
        const countRes = await pool.query(
          `
          SELECT
            (SELECT COUNT(*)::int FROM scheduling_signup WHERE slot_group_id = $1 AND status = 'confirmed') AS signup_count,
            (SELECT COUNT(*)::int FROM scheduling_signup WHERE slot_group_id = $1 AND status = 'waitlisted') AS waitlist_count
          `,
          [req.params.id],
        )
        const updatedGroup = await pool.query('SELECT * FROM scheduling_slot_group WHERE id = $1', [
          req.params.id,
        ])

        res.json({
          success: true,
          data: mapSlotGroupRow(
            updatedGroup.rows[0],
            occurrencesRes.rows,
            countRes.rows[0].signup_count,
            formRes.rows[0],
            countRes.rows[0].waitlist_count,
          ),
        })
      } catch (err) {
        console.error('[scheduling] updateSlotGroupMax:', err)
        res.status(500).json({ success: false, message: 'Failed to update capacity' })
      }
    },

    async updateSignupMemberPassword(req, res) {
      try {
        const { error, value } = memberPasswordUpdateSchema.validate(req.body)
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const signupRes = await pool.query('SELECT * FROM scheduling_signup WHERE id = $1', [
          req.params.id,
        ])
        if (signupRes.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Signup not found' })
        }
        const signup = signupRes.rows[0]
        if (!signup.member_id) {
          return res.status(400).json({ success: false, message: 'Signup has no linked member account' })
        }

        const responses =
          signup.responses && Object.keys(signup.responses).length > 0
            ? signup.responses
            : signup.field_responses || {}
        const registrantEmail = String(responses.email || signup.email || '').trim()
        const registrantFirstName = String(responses.first_name || signup.first_name || '').trim()

        let passwordToSet = value.password
        let mustChangePassword = false
        let emailed = false

        if (value.mode === 'email_temp') {
          if (!registrantEmail) {
            return res.status(400).json({ success: false, message: 'Signup has no email address' })
          }
          passwordToSet = generateTemporaryPassword()
          mustChangePassword = true
        }

        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          await updateMemberPassword(client, signup.member_id, passwordToSet, { mustChangePassword })
          await client.query('COMMIT')
        } catch (txErr) {
          await client.query('ROLLBACK')
          throw txErr
        } finally {
          client.release()
        }

        if (value.mode === 'email_temp') {
          try {
            await sendTemporaryPasswordEmail({
              registrantFirstName,
              registrantEmail,
              temporaryPassword: passwordToSet,
            })
            emailed = true
          } catch (emailErr) {
            console.error('[scheduling] temp password email failed:', emailErr.message)
            return res.status(503).json({
              success: false,
              message: emailErr.message || 'Password updated but failed to send email',
            })
          }
        }

        res.json({
          success: true,
          message:
            value.mode === 'email_temp'
              ? emailed
                ? 'Temporary password emailed'
                : 'Temporary password set'
              : 'Password updated',
        })
      } catch (err) {
        console.error('[scheduling] updateSignupMemberPassword:', err)
        res.status(500).json({ success: false, message: err.message || 'Failed to update password' })
      }
    },

    async listOrphanedSignups(req, res) {
      try {
        const formId = req.query.formId ? Number(req.query.formId) : null
        if (!formId) {
          return res.status(400).json({ success: false, message: 'formId required' })
        }
        const result = await pool.query(
          `
          SELECT s.*, f.title AS form_title
          FROM scheduling_signup s
          JOIN scheduling_form f ON f.id = s.form_id
          WHERE s.form_id = $1
            AND s.orphaned_at IS NOT NULL
            AND s.re_enrolled_at IS NULL
          ORDER BY s.orphaned_at DESC, s.id DESC
          `,
          [formId],
        )
        res.json({ success: true, data: result.rows.map(mapOrphanedSignupRow) })
      } catch (err) {
        console.error('[scheduling] listOrphanedSignups:', err)
        res.status(500).json({ success: false, message: 'Failed to load orphaned signups' })
      }
    },

    async deleteOrphanedSignup(req, res) {
      try {
        const result = await pool.query(
          `
          DELETE FROM scheduling_signup
          WHERE id = $1 AND orphaned_at IS NOT NULL AND re_enrolled_at IS NULL
          RETURNING id, member_id
          `,
          [req.params.id],
        )
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Orphaned signup not found' })
        }
        res.json({ success: true, message: 'Removed from orphaned list' })
      } catch (err) {
        console.error('[scheduling] deleteOrphanedSignup:', err)
        res.status(500).json({ success: false, message: 'Failed to remove orphaned signup' })
      }
    },

    async reEnrollOrphanedSignup(req, res) {
      try {
        const targetFormId = Number(req.body.targetFormId)
        const slotGroupId = Number(req.body.slotGroupId)
        if (!targetFormId || !slotGroupId) {
          return res.status(400).json({ success: false, message: 'targetFormId and slotGroupId required' })
        }

        const client = await pool.connect()
        let newSignupId = null
        let signupStatus = null
        let positions = null
        let responses = null
        let detail = null
        let slotLabel = ''
        let mandateWaiver = false

        try {
          await client.query('BEGIN')

          const orphanRes = await client.query(
            `
            SELECT * FROM scheduling_signup
            WHERE id = $1 AND orphaned_at IS NOT NULL AND re_enrolled_at IS NULL
            FOR UPDATE
            `,
            [req.params.id],
          )
          if (orphanRes.rows.length === 0) {
            await client.query('ROLLBACK')
            return res.status(404).json({ success: false, message: 'Orphaned signup not found' })
          }
          const orphan = orphanRes.rows[0]
          responses =
            orphan.responses && Object.keys(orphan.responses).length > 0
              ? orphan.responses
              : orphan.field_responses || {}

          let memberId = orphan.member_id != null ? Number(orphan.member_id) : null
          if (!memberId) {
            const email = String(responses.email || orphan.email || '').trim()
            if (email) {
              const existingMember = await findMemberByEmail(client, email)
              if (existingMember) memberId = Number(existingMember.id)
            }
          }
          if (!memberId) {
            await client.query('ROLLBACK')
            return res.status(400).json({
              success: false,
              message: 'No member account linked to this signup. Create a member account first.',
            })
          }

          const formRes = await client.query('SELECT * FROM scheduling_form WHERE id = $1', [targetFormId])
          if (formRes.rows.length === 0 || formRes.rows[0].deleted_at || !formRes.rows[0].is_active) {
            await client.query('ROLLBACK')
            return res.status(404).json({ success: false, message: 'Target scheduling form not available' })
          }
          const formRow = formRes.rows[0]

          detail = await loadFormDetail(client, targetFormId)
          if (!detail) {
            await client.query('ROLLBACK')
            return res.status(404).json({ success: false, message: 'Target scheduling form not available' })
          }

          const group = detail.slotGroups.find((g) => g.id === slotGroupId)
          if (!group) {
            await client.query('ROLLBACK')
            return res.status(400).json({ success: false, message: 'Invalid time slot group' })
          }
          mandateWaiver = detail.mandateWaiver

          const firstOccurrence = group.occurrences[0]
          if (!firstOccurrence) {
            await client.query('ROLLBACK')
            return res.status(400).json({ success: false, message: 'Time slot has no schedule entries' })
          }

          const signupResult = await insertSignupForMember(client, {
            formId: targetFormId,
            formRow,
            slotGroupId,
            memberId,
            responses,
            firstOccurrenceId: firstOccurrence.id,
            formTitle: detail.title,
            mandateWaiver,
            groupDisplayLabel: group.displayLabel,
            firstOccurrenceLabel: firstOccurrence.displayLabel,
          })

          newSignupId = signupResult.signupId
          signupStatus = signupResult.signupStatus
          positions = signupResult.positions
          slotLabel = signupResult.slotLabel

          await client.query(
            `
            UPDATE scheduling_signup
            SET re_enrolled_at = NOW(), re_enrolled_signup_id = $1
            WHERE id = $2
            `,
            [newSignupId, orphan.id],
          )

          await client.query('COMMIT')
        } catch (txErr) {
          await client.query('ROLLBACK')
          if (txErr.code === 'MAX_SLOTS') {
            return res.status(400).json({ success: false, message: txErr.message })
          }
          if (txErr.code === 'SLOT_UNAVAILABLE') {
            return res.status(400).json({ success: false, message: txErr.message })
          }
          throw txErr
        } finally {
          client.release()
        }

        await sendSignupNotificationEmails(pool, {
          signupStatus,
          signupId: newSignupId,
          memberId,
          responses,
          formTitle: detail.title,
          slotLabel,
          pricing: positions.pricing,
          mandateWaiver,
        })

        const refreshed = await pool.query('SELECT * FROM scheduling_signup WHERE id = $1', [newSignupId])
        res.json({
          success: true,
          message: buildSignupPositionMessage({ status: signupStatus, ...positions }),
          data: mapSignupRow(refreshed.rows[0], positions),
        })
      } catch (err) {
        console.error('[scheduling] reEnrollOrphanedSignup:', err)
        res.status(500).json({ success: false, message: err.message || 'Failed to re-enroll signup' })
      }
    },
  }
}
