import Joi from 'joi'
import {
  countActiveSignupsForMember,
  createMemberStub,
  findMemberByEmail,
  findMemberById,
  updateMemberPassword,
} from '../members/createMemberStub.js'
import { sendConfirmationEmail } from './confirmationEmail.js'
import { sendDemotionEmail } from './demotionEmail.js'
import { sendMagicLinkEmail } from './magicLinkEmail.js'
import { sendPromotionEmail } from './promotionEmail.js'
import { sendWaitlistEmail } from './waitlistEmail.js'
import { sendWaiverEmail } from './waiverEmail.js'
import { computeMonthlyPricing } from './pricing.js'
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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

async function buildOrphanSnapshot(db, groupId) {
  const groupRes = await db.query(
    `
    SELECT sg.*, f.title AS form_title, f.start_date AS form_start_date, f.end_date AS form_end_date,
      c.name AS category_name
    FROM scheduling_slot_group sg
    JOIN scheduling_form f ON f.id = sg.form_id
    LEFT JOIN scheduling_category c ON c.id = sg.category_id
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
    categoryName: group.category_name || 'No Category',
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

  await db.query(
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
    `,
    [groupId, JSON.stringify(snapshot)],
  )
}

async function insertSignupForMember(
  client,
  {
    formId,
    formRow,
    signupCategoryId,
    slotGroupId,
    memberId,
    responses,
    firstOccurrenceId,
    categoryName,
    formTitle,
    mandateWaiver,
    groupDisplayLabel,
    firstOccurrenceLabel,
  },
) {
  const activeCount = await countActiveSignupsForMember(client, formId, memberId)
  const maxSlots = formRow.max_slots_per_user != null ? Number(formRow.max_slots_per_user) : null
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
      (form_id, category_id, time_slot_id, slot_group_id, member_id,
       first_name, last_name, email, phone, field_responses, responses, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
    `,
    [
      formId,
      signupCategoryId,
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
    ],
  )

  const signupId = insert.rows[0].id
  const positions = await computeSignupPositions(client, slotGroupId, signupId)
  const totalSlotsAfter = activeCount + 1
  const pricing = computeMonthlyPricing(formRow, totalSlotsAfter)
  positions.pricing = pricing

  return {
    signupRow: insert.rows[0],
    signupId,
    signupStatus,
    positions,
    pricing,
    slotLabel: groupDisplayLabel || firstOccurrenceLabel || '',
    categoryName,
    formTitle,
    mandateWaiver,
    responses,
  }
}

async function sendSignupNotificationEmails(pool, {
  signupStatus,
  signupId,
  responses,
  formTitle,
  categoryName,
  slotLabel,
  positions,
  pricing,
  mandateWaiver,
}) {
  let confirmationEmailSentAt = null
  let waiverEmailSentAt = null
  const emailParams = {
    registrantFirstName: String(responses.first_name || ''),
    registrantEmail: String(responses.email || ''),
    formTitle,
    categoryName,
    slotLabel,
    pricing,
  }

  if (signupStatus === 'confirmed') {
    try {
      await sendConfirmationEmail({
        ...emailParams,
        signupNumber: positions.signupNumber,
        maxParticipants: positions.maxParticipants,
      })
      confirmationEmailSentAt = new Date().toISOString()
    } catch (emailErr) {
      console.error('[scheduling] confirmation email failed:', emailErr.message)
    }
  } else {
    try {
      await sendWaitlistEmail({
        ...emailParams,
        waitlistPosition: positions.waitlistPosition,
      })
      confirmationEmailSentAt = new Date().toISOString()
    } catch (emailErr) {
      console.error('[scheduling] waitlist email failed:', emailErr.message)
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

function mapFormRow(row) {
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    startDate: formatDateOnly(row.start_date),
    endDate: formatDateOnly(row.end_date),
    signupFields: parseSignupFields(row),
    mandateWaiver: Boolean(row.mandate_waiver),
    isActive: row.is_active,
    maxSlotsPerUser: row.max_slots_per_user != null ? Number(row.max_slots_per_user) : null,
    slotCostMonthlyCents: Number(row.slot_cost_monthly_cents ?? 0),
    freeSlotsPerUser: Number(row.free_slots_per_user ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapCategoryRow(row) {
  return {
    id: Number(row.id),
    formId: row.form_id != null ? Number(row.form_id) : null,
    name: row.name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  }
}

function mapOfferingRow(row) {
  return {
    id: Number(row.id),
    formId: Number(row.form_id),
    categoryId: row.category_id != null ? Number(row.category_id) : null,
    startDate: formatDateOnly(row.start_date),
    endDate: formatDateOnly(row.end_date),
    label: row.label,
    isSelected: Boolean(row.is_selected),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function loadAllCategories(pool) {
  const result = await pool.query(
    'SELECT * FROM scheduling_category ORDER BY sort_order, id',
  )
  return result.rows.map(mapCategoryRow)
}

async function loadFormCategories(pool, formId, { includeInactive = false } = {}) {
  const result = await pool.query(
    `
    SELECT DISTINCT c.*
    FROM scheduling_category c
    WHERE c.id IN (
      SELECT category_id FROM scheduling_form_category WHERE form_id = $1
      UNION
      SELECT category_id FROM scheduling_time_slot WHERE form_id = $1 AND category_id IS NOT NULL
    )
    ${includeInactive ? '' : 'AND c.is_active = TRUE'}
    ORDER BY c.sort_order, c.id
    `,
    [formId],
  )
  return result.rows.map(mapCategoryRow)
}

function resolveSlotActiveDates(slot, form) {
  if (slot.dates_tbd) {
    return { activeStart: null, activeEnd: null, datesTbd: true, inheritsFormDates: false }
  }
  const activeStart =
    formatDateOnly(slot.active_start) ??
    formatDateOnly(slot.start_date) ??
    formatDateOnly(form?.start_date) ??
    null
  const activeEnd =
    formatDateOnly(slot.active_end) ??
    formatDateOnly(slot.end_date) ??
    formatDateOnly(form?.end_date) ??
    null
  const inheritsFormDates =
    !slot.active_start && !slot.start_date && Boolean(form?.start_date || form?.end_date)
  return { activeStart, activeEnd, datesTbd: false, inheritsFormDates }
}

function mapSlotRow(row, signupCount = 0, form = null) {
  const max = Number(row.max_participants)
  const count = Number(signupCount)
  const dates = resolveSlotActiveDates(row, form)
  const dayOfWeek = row.day_of_week
  return {
    id: Number(row.id),
    slotGroupId: row.slot_group_id != null ? Number(row.slot_group_id) : null,
    formId: Number(row.form_id),
    categoryId: row.category_id != null ? Number(row.category_id) : null,
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
    isActive: row.is_active,
    displayLabel: buildSlotDisplayLabel(row),
  }
}

function buildSlotDisplayLabel(row) {
  const parts = []
  if (row.week_letter) parts.push(`${row.week_letter}-Week`)
  if (row.schedule_mode === 'date' && row.specific_date) {
    parts.push(formatDateOnly(row.specific_date))
  } else if (row.day_of_week != null) {
    parts.push(DAY_NAMES[row.day_of_week])
  }
  const st = formatTime(row.start_time)
  const et = formatTime(row.end_time)
  if (st && et) parts.push(`${st}–${et}`)
  return parts.join(' · ')
}

function buildGroupDisplayLabel(occurrenceRows) {
  if (!occurrenceRows?.length) return ''
  return occurrenceRows.map((row) => buildSlotDisplayLabel(row)).join('; ')
}

function mapSlotGroupRow(groupRow, occurrenceRows, signupCount, form, waitlistCount = 0) {
  const max = Number(groupRow.max_participants)
  const count = Number(signupCount)
  const waitlist = Number(waitlistCount)
  const dates = resolveSlotActiveDates(groupRow, form)
  const occurrences = (occurrenceRows || []).map((row) => mapSlotRow(row, 0, form))
  return {
    id: Number(groupRow.id),
    formId: Number(groupRow.form_id),
    categoryId: groupRow.category_id != null ? Number(groupRow.category_id) : null,
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
    isActive: groupRow.is_active,
    displayLabel: buildGroupDisplayLabel(occurrenceRows),
    occurrences,
  }
}

function filterSlotRowsByVisibility(rows, _form, includeInactive) {
  if (includeInactive) return rows
  const today = new Date().toISOString().slice(0, 10)
  return rows.filter((slot) => {
    if (slot.dates_tbd) return true
    // Only slot-level custom dates gate visibility — form inherit dates are informational.
    const activeStart =
      formatDateOnly(slot.active_start) ?? formatDateOnly(slot.start_date) ?? null
    const activeEnd =
      formatDateOnly(slot.active_end) ?? formatDateOnly(slot.end_date) ?? null
    if (activeStart && activeStart > today) return false
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

function groupSlotsByCategory(categories, timeSlots, slotGroups = []) {
  const result = categories.map((cat) => {
    const catSlots = timeSlots.filter((s) => s.categoryId === cat.id)
    const catGroups = slotGroups.filter((g) => g.categoryId === cat.id)
    return {
      categoryId: cat.id,
      categoryName: cat.name,
      slots: catSlots,
      groups: catGroups,
      preview: buildSchedulePreview(catSlots),
    }
  })

  const uncatSlots = timeSlots.filter((s) => s.categoryId == null)
  const uncatGroups = slotGroups.filter((g) => g.categoryId == null)
  if (uncatGroups.length > 0) {
    result.unshift({
      categoryId: null,
      categoryName: 'No Category',
      slots: uncatSlots,
      groups: uncatGroups,
      preview: buildSchedulePreview(uncatSlots),
    })
  }

  return result
}

function mapSignupRow(row, positions = {}) {
  const responses = row.responses && Object.keys(row.responses).length > 0
    ? row.responses
    : row.field_responses || {}
  return {
    id: Number(row.id),
    formId: Number(row.form_id),
    memberId: row.member_id != null ? Number(row.member_id) : null,
    categoryId: row.category_id != null ? Number(row.category_id) : null,
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
    createdAt: row.created_at,
    categoryName: row.category_name || 'No Category',
    slotLabel: row.slot_label,
    formTitle: row.form_title,
    confirmationEmailSentAt: row.confirmation_email_sent_at || null,
    waiverEmailSentAt: row.waiver_email_sent_at || null,
    promotionEmailSentAt: row.promotion_email_sent_at || null,
    demotionEmailSentAt: row.demotion_email_sent_at || null,
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
        categoryName: ctx.categoryName,
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
        categoryName: ctx.categoryName,
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
  { includeInactive = false, categoryId, includeAllCategories = false } = {},
) {
  const formRes = await pool.query('SELECT * FROM scheduling_form WHERE id = $1', [formId])
  if (formRes.rows.length === 0) return null

  const form = formRes.rows[0]
  if (form.deleted_at) return null
  if (!includeInactive && !form.is_active) return null

  const categories = await loadFormCategories(pool, formId, { includeInactive })
  const allCategories = includeAllCategories ? await loadAllCategories(pool) : undefined

  const slotParams = [formId]
  let categoryFilter = ''
  if (categoryId === null) {
    categoryFilter = ' AND sg.category_id IS NULL'
  } else if (categoryId != null) {
    categoryFilter = ' AND sg.category_id = $2'
    slotParams.push(categoryId)
  }

  const groupWhere = includeInactive
    ? `sg.form_id = $1${categoryFilter}`
    : `sg.form_id = $1 AND sg.is_active = TRUE${categoryFilter}`

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
    WHERE ${slotWhere}${categoryFilter.replace(/sg\.category_id/g, 'ts.category_id')}
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

  const slotGroups = groupsRes.rows
    .filter((g) => (occurrencesByGroup.get(g.id) || []).length > 0)
    .map((g) => mapSlotGroupRow(g, occurrencesByGroup.get(g.id), g.signup_count, form, g.waitlist_count))

  const timeSlots = filteredOccurrences.map((s) => {
    const group = groupsRes.rows.find((g) => g.id === s.slot_group_id)
    const groupCount = group ? Number(group.signup_count) : 0
    return mapSlotRow(s, groupCount, form)
  })

  const categoryIdsWithSlots = new Set(
    slotGroups.map((g) => g.categoryId).filter((id) => id != null),
  )
  const categoriesWithSlots = categories.filter((c) => categoryIdsWithSlots.has(c.id))
  if (slotGroups.some((g) => g.categoryId == null)) {
    categoriesWithSlots.unshift({
      id: null,
      formId: null,
      name: 'No Category',
      sortOrder: -1,
      isActive: true,
    })
  }

  return {
    ...mapFormRow(form),
    categories: categoriesWithSlots,
    allCategories,
    slotGroups,
    timeSlots,
    slotsByCategory: groupSlotsByCategory(categoriesWithSlots, timeSlots, slotGroups),
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
  freeSlotsPerUser: Joi.number().integer().min(0).optional(),
})

const categorySchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  formId: Joi.number().integer().optional().allow(null),
  sortOrder: Joi.number().integer().min(0).optional(),
  isActive: Joi.boolean().optional(),
})

const offeringSchema = Joi.object({
  categoryId: Joi.number().integer().allow(null).required(),
  startDate: Joi.string().required(),
  endDate: Joi.string().required(),
  label: Joi.string().max(255).allow('', null).optional(),
})

const offeringUpdateSchema = Joi.object({
  startDate: Joi.string().optional(),
  endDate: Joi.string().optional(),
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
  categoryId: Joi.number().integer().allow(null).optional(),
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
  categoryId: Joi.number().integer().allow(null).optional(),
  slotGroupId: Joi.number().integer().required(),
  timeSlotId: Joi.number().integer().optional(),
  responses: Joi.object().default({}),
  signupAuthToken: Joi.string().trim().optional(),
  password: Joi.string().min(6).optional(),
}).custom((val, helpers) => {
  if (!val.signupAuthToken && !val.password) {
    return helpers.error('any.custom', { message: 'Sign in or set an account password to continue' })
  }
  if (val.signupAuthToken && val.password) {
    return helpers.error('any.custom', { message: 'Provide either sign-in session or new password, not both' })
  }
  return val
})

const checkEmailSchema = Joi.object({
  formId: Joi.number().integer().required(),
  email: Joi.string().email().required(),
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

const memberPasswordSchema = Joi.object({
  password: Joi.string().min(6).required(),
})

export function createSchedulingHandlers(pool) {
  return {
    async listPublicForms(_req, res) {
      try {
        const result = await pool.query(
          `
          SELECT sf.* FROM scheduling_form sf
          LEFT JOIN programs pr ON pr.id = sf.programs_id
          LEFT JOIN program_categories pc ON pc.id = sf.programs_id
          WHERE sf.deleted_at IS NULL
            AND sf.is_active = TRUE
            AND (
              sf.programs_id IS NULL
              OR COALESCE(pr.scheduling_active, pc.scheduling_active, TRUE) = TRUE
            )
          ORDER BY sf.created_at DESC
          `,
        )
        res.json({ success: true, data: result.rows.map(mapFormRow) })
      } catch (err) {
        console.error('[scheduling] listPublicForms:', err)
        res.status(500).json({ success: false, message: 'Failed to load scheduling forms' })
      }
    },

    async getPublicForm(req, res) {
      try {
        const formId = Number(req.params.id)
        let categoryId
        if (req.query.uncategorized === '1') {
          categoryId = null
        } else if (req.query.categoryId != null && req.query.categoryId !== '') {
          categoryId = Number(req.query.categoryId)
        }

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

        const detail = await loadFormDetail(pool, formId, { categoryId })
        if (!detail) {
          return res.status(404).json({ success: false, message: 'Scheduling form not found' })
        }
        res.json({ success: true, data: detail })
      } catch (err) {
        console.error('[scheduling] getPublicForm:', err)
        res.status(500).json({ success: false, message: 'Failed to load scheduling form' })
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
        const signupAuthToken = issueSignupAuthToken({
          formId: value.formId,
          memberId: member.id,
          email: member.email,
        })
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
        console.error('[scheduling] authLogin:', err)
        res.status(500).json({ success: false, message: 'Failed to sign in' })
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
        const signupAuthToken = issueSignupAuthToken({
          formId: value.formId,
          memberId: member.id,
          email: member.email,
        })
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

        const signupCategoryId = value.categoryId ?? null
        const group = detail.slotGroups.find((g) => g.id === value.slotGroupId)
        if (!group) {
          return res.status(400).json({ success: false, message: 'Invalid time slot group' })
        }
        if ((group.categoryId ?? null) !== signupCategoryId) {
          return res.status(400).json({ success: false, message: 'Time slot does not match category' })
        }

        const category =
          signupCategoryId != null
            ? detail.categories.find((c) => c.id === signupCategoryId)
            : { id: null, name: 'No Category' }
        if (signupCategoryId != null && !category) {
          return res.status(400).json({ success: false, message: 'Invalid category' })
        }
        const firstOccurrence = group.occurrences[0]
        if (!firstOccurrence) {
          return res.status(400).json({ success: false, message: 'Time slot has no schedule entries' })
        }

        let memberId = null
        let responses = { ...value.responses }

        if (value.signupAuthToken) {
          const auth = verifySignupAuthToken(value.signupAuthToken, value.formId)
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
          }

          if (!memberId) {
            await client.query('ROLLBACK')
            return res.status(400).json({ success: false, message: 'Could not resolve member account' })
          }

          const signupResult = await insertSignupForMember(client, {
            formId: value.formId,
            formRow,
            signupCategoryId,
            slotGroupId: value.slotGroupId,
            memberId,
            responses,
            firstOccurrenceId: firstOccurrence.id,
            categoryName: category.name,
            formTitle: detail.title,
            mandateWaiver: detail.mandateWaiver,
            groupDisplayLabel: group.displayLabel,
            firstOccurrenceLabel: firstOccurrence.displayLabel,
          })

          await client.query('COMMIT')

          const { signupId, signupStatus, positions, pricing } = signupResult
          await sendSignupNotificationEmails(pool, {
            signupStatus,
            signupId,
            responses,
            formTitle: detail.title,
            categoryName: category.name,
            slotLabel: signupResult.slotLabel,
            positions,
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
          includeAllCategories: true,
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
        res.json({ success: true, data: mapFormRow(result.rows[0]) })
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
        const result = await pool.query(
          `
          UPDATE scheduling_form
          SET title = $1, description = $2, start_date = $3, end_date = $4,
              is_active = COALESCE($5, is_active),
              max_slots_per_user = $6,
              slot_cost_monthly_cents = COALESCE($7, slot_cost_monthly_cents),
              free_slots_per_user = COALESCE($8, free_slots_per_user),
              updated_at = now()
          WHERE id = $9 AND deleted_at IS NULL
          RETURNING *
          `,
          [
            value.title,
            value.description || null,
            formatDateOnly(value.startDate),
            formatDateOnly(value.endDate),
            value.isActive,
            value.maxSlotsPerUser !== undefined ? value.maxSlotsPerUser : null,
            value.slotCostMonthlyCents,
            value.freeSlotsPerUser,
            req.params.id,
          ],
        )
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Form not found' })
        }
        res.json({ success: true, data: mapFormRow(result.rows[0]) })
      } catch (err) {
        console.error('[scheduling] updateAdminForm:', err)
        res.status(500).json({ success: false, message: 'Failed to update form' })
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

    async deleteAdminForm(req, res) {
      try {
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

    async listCategories(req, res) {
      try {
        const formId = req.query.formId ? Number(req.query.formId) : null
        const data = formId
          ? await loadFormCategories(pool, formId, { includeInactive: true })
          : await loadAllCategories(pool)
        res.json({ success: true, data })
      } catch (err) {
        console.error('[scheduling] listCategories:', err)
        res.status(500).json({ success: false, message: 'Failed to load categories' })
      }
    },

    async createCategory(req, res) {
      try {
        const { error, value } = categorySchema.validate(req.body)
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const maxSort = await pool.query(
          'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM scheduling_category',
        )
        const result = await pool.query(
          `
          INSERT INTO scheduling_category (form_id, name, sort_order, is_active)
          VALUES ($1, $2, $3, $4)
          RETURNING *
          `,
          [
            value.formId ?? null,
            value.name,
            value.sortOrder ?? Number(maxSort.rows[0].next),
            value.isActive !== false,
          ],
        )
        if (value.formId != null) {
          await pool.query(
            `
            INSERT INTO scheduling_form_category (form_id, category_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            `,
            [value.formId, result.rows[0].id],
          )
        }
        res.json({ success: true, data: mapCategoryRow(result.rows[0]) })
      } catch (err) {
        console.error('[scheduling] createCategory:', err)
        res.status(500).json({ success: false, message: 'Failed to create category' })
      }
    },

    async updateCategory(req, res) {
      try {
        const { error, value } = categorySchema.validate(req.body)
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const result = await pool.query(
          `
          UPDATE scheduling_category
          SET name = $1,
              sort_order = COALESCE($2, sort_order),
              is_active = COALESCE($3, is_active),
              updated_at = now()
          WHERE id = $4
          RETURNING *
          `,
          [
            value.name,
            value.sortOrder ?? null,
            value.isActive,
            req.params.id,
          ],
        )
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Category not found' })
        }
        res.json({ success: true, data: mapCategoryRow(result.rows[0]) })
      } catch (err) {
        console.error('[scheduling] updateCategory:', err)
        res.status(500).json({ success: false, message: 'Failed to update category' })
      }
    },

    async deleteCategory(req, res) {
      try {
        await pool.query('DELETE FROM scheduling_category WHERE id = $1', [req.params.id])
        res.json({ success: true, message: 'Category deleted' })
      } catch (err) {
        console.error('[scheduling] deleteCategory:', err)
        res.status(500).json({ success: false, message: 'Failed to delete category' })
      }
    },

    async listOfferings(req, res) {
      try {
        const formId = Number(req.params.formId)
        const params = [formId]
        let where = 'WHERE form_id = $1'
        if (req.query.categoryId === 'none') {
          where += ' AND category_id IS NULL'
        } else if (req.query.categoryId != null && req.query.categoryId !== '') {
          params.push(Number(req.query.categoryId))
          where += ` AND category_id = $${params.length}`
        }
        const result = await pool.query(
          `SELECT * FROM scheduling_offering ${where} ORDER BY start_date DESC, id DESC`,
          params,
        )
        res.json({ success: true, data: result.rows.map(mapOfferingRow) })
      } catch (err) {
        console.error('[scheduling] listOfferings:', err)
        res.status(500).json({ success: false, message: 'Failed to load offerings' })
      }
    },

    async createOffering(req, res) {
      try {
        const { error, value } = offeringSchema.validate(req.body)
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const formId = Number(req.params.formId)
        const startDate = formatDateOnly(value.startDate)
        const endDate = formatDateOnly(value.endDate)
        if (!startDate || !endDate) {
          return res.status(400).json({ success: false, message: 'Invalid start or end date' })
        }
        const countRes = await pool.query(
          'SELECT COUNT(*)::int AS c FROM scheduling_offering WHERE form_id = $1 AND category_id IS NOT DISTINCT FROM $2',
          [formId, value.categoryId ?? null],
        )
        const isFirst = Number(countRes.rows[0].c) === 0
        const result = await pool.query(
          `
          INSERT INTO scheduling_offering (form_id, category_id, start_date, end_date, label, is_selected)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
          `,
          [formId, value.categoryId ?? null, startDate, endDate, value.label || null, isFirst],
        )
        res.json({ success: true, data: mapOfferingRow(result.rows[0]) })
      } catch (err) {
        console.error('[scheduling] createOffering:', err)
        res.status(500).json({ success: false, message: 'Failed to create offering' })
      }
    },

    async updateOffering(req, res) {
      try {
        const { error, value } = offeringUpdateSchema.validate(req.body)
        if (error) {
          return res.status(400).json({ success: false, message: error.details[0].message })
        }
        const updates = []
        const vals = []
        let n = 1
        if (value.startDate !== undefined) {
          updates.push(`start_date = $${n++}`)
          vals.push(formatDateOnly(value.startDate))
        }
        if (value.endDate !== undefined) {
          updates.push(`end_date = $${n++}`)
          vals.push(formatDateOnly(value.endDate))
        }
        if (value.label !== undefined) {
          updates.push(`label = $${n++}`)
          vals.push(value.label || null)
        }
        if (updates.length === 0) {
          return res.status(400).json({ success: false, message: 'No fields to update' })
        }
        updates.push('updated_at = now()')
        vals.push(req.params.id)
        const result = await pool.query(
          `UPDATE scheduling_offering SET ${updates.join(', ')} WHERE id = $${n} RETURNING *`,
          vals,
        )
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Offering not found' })
        }
        res.json({ success: true, data: mapOfferingRow(result.rows[0]) })
      } catch (err) {
        console.error('[scheduling] updateOffering:', err)
        res.status(500).json({ success: false, message: 'Failed to update offering' })
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
           WHERE form_id = $1 AND category_id IS NOT DISTINCT FROM $2`,
          [row.form_id, row.category_id],
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
          if (value.categoryId != null) {
            await client.query(
              `
              INSERT INTO scheduling_form_category (form_id, category_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING
              `,
              [req.params.formId, value.categoryId],
            )
          }

          const groupRes = await client.query(
            `
            INSERT INTO scheduling_slot_group (
              form_id, category_id, offering_id, schedule_mode, max_participants,
              active_start, active_end, dates_tbd, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
            RETURNING *
            `,
            [
              req.params.formId,
              value.categoryId ?? null,
              value.offeringId ?? null,
              value.scheduleMode,
              value.maxParticipants,
              resolvedActiveStart,
              resolvedActiveEnd,
              batchDatesTbd,
            ],
          )
          groupRow = groupRes.rows[0]
          const groupId = groupRow.id

          for (const row of rows) {
            const result = await client.query(
              `
              INSERT INTO scheduling_time_slot (
                form_id, category_id, slot_group_id, schedule_mode, week_letter, day_of_week, specific_date,
                start_time, end_time, max_participants, active_start, active_end, dates_tbd, is_active
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE)
              RETURNING *
              `,
              [
                req.params.formId,
                row.categoryId,
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
        res.json({
          success: true,
          data: mapSlotGroupRow(groupRow, inserted, 0, form),
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
            SET category_id = $1, schedule_mode = $2, week_letter = $3, day_of_week = $4,
                specific_date = $5, start_time = $6, end_time = $7, max_participants = $8,
                active_start = $9, active_end = $10, dates_tbd = $11, updated_at = now()
            WHERE id = $12
            RETURNING *
            `,
            [
              row.categoryId,
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

    async deleteCategorySlots(req, res) {
      try {
        const { categoryId } = req.body
        if (!categoryId) {
          return res.status(400).json({ success: false, message: 'categoryId required' })
        }
        const groupsRes = await pool.query(
          'SELECT id FROM scheduling_slot_group WHERE form_id = $1 AND category_id = $2',
          [req.params.formId, categoryId],
        )
        for (const row of groupsRes.rows) {
          await orphanSignupsForSlotGroup(pool, row.id)
        }
        await pool.query(
          'DELETE FROM scheduling_slot_group WHERE form_id = $1 AND category_id = $2',
          [req.params.formId, categoryId],
        )
        res.json({ success: true, message: 'Category slots deleted' })
      } catch (err) {
        console.error('[scheduling] deleteCategorySlots:', err)
        res.status(500).json({ success: false, message: 'Failed to delete slots' })
      }
    },

    async listSignups(req, res) {
      try {
        const formId = req.query.formId ? Number(req.query.formId) : null
        const params = []
        let where = '1=1 AND s.orphaned_at IS NULL'
        if (formId) {
          params.push(formId)
          where += ` AND s.form_id = $${params.length}`
        }
        const result = await pool.query(
          `
          SELECT s.*, c.name AS category_name, f.title AS form_title,
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
          LEFT JOIN scheduling_category c ON c.id = s.category_id
          LEFT JOIN scheduling_time_slot ts ON ts.id = s.time_slot_id
          LEFT JOIN member m ON m.id = s.member_id
          JOIN scheduling_form f ON f.id = s.form_id
          WHERE ${where}
          ORDER BY s.created_at DESC
          `,
          params,
        )
        const enriched = await attachPositionsToSignups(pool, result.rows)
        res.json({
          success: true,
          data: enriched.map((mapped, i) => {
            const row = result.rows[i]
            const occurrences = Array.isArray(row.group_occurrences) ? row.group_occurrences : []
            const slotLabel =
              occurrences.length > 0
                ? buildGroupDisplayLabel(occurrences)
                : buildSlotDisplayLabel(row)
            return { ...mapped, slotLabel }
          }),
        })
      } catch (err) {
        console.error('[scheduling] listSignups:', err)
        res.status(500).json({ success: false, message: 'Failed to load signups' })
      }
    },

    async updateSignupStatus(req, res) {
      try {
        const status = req.body.status
        if (!['confirmed', 'waitlisted', 'cancelled'].includes(status)) {
          return res.status(400).json({ success: false, message: 'Invalid status' })
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

          if (status === 'confirmed' && previousStatus === 'cancelled' && signup.slot_group_id) {
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

          const result = await client.query(
            'UPDATE scheduling_signup SET status = $1 WHERE id = $2 RETURNING *',
            [targetStatus, req.params.id],
          )
          updatedRow = result.rows[0]

          if (
            previousStatus === 'confirmed' &&
            targetStatus === 'cancelled' &&
            signup.slot_group_id
          ) {
            await client.query(
              'SELECT id FROM scheduling_slot_group WHERE id = $1 FOR UPDATE',
              [signup.slot_group_id],
            )
            promotedRows = await promoteFromWaitlist(client, signup.slot_group_id, 1)
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
          const ctx = await loadSignupContext(pool, updatedRow.id)
          if (ctx?.registrantEmail) {
            const positions = await computeSignupPositions(
              pool,
              updatedRow.slot_group_id,
              updatedRow.id,
            )
            try {
              await sendConfirmationEmail({
                registrantFirstName: ctx.registrantFirstName,
                registrantEmail: ctx.registrantEmail,
                formTitle: ctx.formTitle,
                categoryName: ctx.categoryName,
                slotLabel: ctx.slotLabel,
                signupNumber: positions.signupNumber,
                maxParticipants: positions.maxParticipants,
              })
              await pool.query(
                'UPDATE scheduling_signup SET confirmation_email_sent_at = now() WHERE id = $1',
                [updatedRow.id],
              )
            } catch (emailErr) {
              console.error('[scheduling] reconfirm email failed:', emailErr.message)
            }
          }
        } else if (updatedRow && targetStatus === 'waitlisted' && previousStatus === 'cancelled') {
          const ctx = await loadSignupContext(pool, updatedRow.id)
          if (ctx?.registrantEmail) {
            const positions = await computeSignupPositions(
              pool,
              updatedRow.slot_group_id,
              updatedRow.id,
            )
            try {
              await sendWaitlistEmail({
                registrantFirstName: ctx.registrantFirstName,
                registrantEmail: ctx.registrantEmail,
                formTitle: ctx.formTitle,
                categoryName: ctx.categoryName,
                slotLabel: ctx.slotLabel,
                waitlistPosition: positions.waitlistPosition,
              })
              await pool.query(
                'UPDATE scheduling_signup SET confirmation_email_sent_at = now() WHERE id = $1',
                [updatedRow.id],
              )
            } catch (emailErr) {
              console.error('[scheduling] reconfirm waitlist email failed:', emailErr.message)
            }
          }
        }

        const positions = updatedRow?.slot_group_id
          ? await computeSignupPositions(pool, updatedRow.slot_group_id, updatedRow.id)
          : {}
        res.json({ success: true, data: mapSignupRow(updatedRow, positions) })
      } catch (err) {
        console.error('[scheduling] updateSignupStatus:', err)
        res.status(500).json({ success: false, message: 'Failed to update signup' })
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
          if (!ctx.registrantEmail) {
            return res.status(400).json({ success: false, message: 'Registrant email is missing' })
          }

          const positions = await computeSignupPositions(pool, signup.slot_group_id, signup.id)
          if (signup.status === 'waitlisted') {
            await sendWaitlistEmail({
              registrantFirstName: ctx.registrantFirstName,
              registrantEmail: ctx.registrantEmail,
              formTitle: ctx.formTitle,
              categoryName: ctx.categoryName,
              slotLabel: ctx.slotLabel,
              waitlistPosition: positions.waitlistPosition,
            })
          } else {
            await sendConfirmationEmail({
              registrantFirstName: ctx.registrantFirstName,
              registrantEmail: ctx.registrantEmail,
              formTitle: ctx.formTitle,
              categoryName: ctx.categoryName,
              slotLabel: ctx.slotLabel,
              signupNumber: positions.signupNumber,
              maxParticipants: positions.maxParticipants,
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
        const { error, value } = memberPasswordSchema.validate(req.body)
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
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          await updateMemberPassword(client, signup.member_id, value.password)
          await client.query('COMMIT')
        } catch (txErr) {
          await client.query('ROLLBACK')
          throw txErr
        } finally {
          client.release()
        }
        res.json({ success: true, message: 'Password updated' })
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
        const categoryId =
          req.body.categoryId === null || req.body.categoryId === undefined
            ? null
            : Number(req.body.categoryId)
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
        let categoryName = ''
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

          const signupCategoryId = categoryId
          const group = detail.slotGroups.find((g) => g.id === slotGroupId)
          if (!group) {
            await client.query('ROLLBACK')
            return res.status(400).json({ success: false, message: 'Invalid time slot group' })
          }
          if ((group.categoryId ?? null) !== signupCategoryId) {
            await client.query('ROLLBACK')
            return res.status(400).json({ success: false, message: 'Time slot does not match category' })
          }

          const category =
            signupCategoryId != null
              ? detail.categories.find((c) => c.id === signupCategoryId)
              : { id: null, name: 'No Category' }
          if (signupCategoryId != null && !category) {
            await client.query('ROLLBACK')
            return res.status(400).json({ success: false, message: 'Invalid category' })
          }
          categoryName = category.name
          mandateWaiver = detail.mandateWaiver

          const firstOccurrence = group.occurrences[0]
          if (!firstOccurrence) {
            await client.query('ROLLBACK')
            return res.status(400).json({ success: false, message: 'Time slot has no schedule entries' })
          }

          const signupResult = await insertSignupForMember(client, {
            formId: targetFormId,
            formRow,
            signupCategoryId,
            slotGroupId,
            memberId,
            responses,
            firstOccurrenceId: firstOccurrence.id,
            categoryName,
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
          responses,
          formTitle: detail.title,
          categoryName,
          slotLabel,
          positions,
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
