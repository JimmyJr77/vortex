import { rowVisibleOnEnrollSite } from './enrollSites.js'
import { buildOfferingByIdFromRows, formatDateOnly, resolveSlotActiveDates } from './slotActiveDates.js'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function computeEnrollVisible(row, site) {
  const formVisible = rowVisibleOnEnrollSite(row.enroll_sites, row.form_is_active, site)
  if (!formVisible) return false
  if (row.programs_id == null) return true
  return rowVisibleOnEnrollSite(
    row.scheduling_enroll_sites,
    row.scheduling_active ?? true,
    site,
  )
}

function formatTime(t) {
  if (!t) return null
  const s = String(t)
  return s.length >= 5 ? s.slice(0, 5) : s
}

function parseDate(str) {
  if (!str) return null
  return new Date(`${str}T12:00:00`)
}

function daysBetween(startStr, endStr) {
  const start = parseDate(startStr)
  const end = parseDate(endStr)
  if (!start || !end) return 0
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
}

function dateInRange(dateStr, startStr, endStr) {
  if (startStr && dateStr < startStr) return false
  if (endStr && dateStr > endStr) return false
  return true
}

function monthBounds(year, month) {
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { monthStart, monthEnd, lastDay }
}

function daysInRange(startDate, endDate) {
  const dates = []
  const cur = parseDate(startDate)
  const last = parseDate(endDate)
  if (!cur || !last) return dates
  while (cur <= last) {
    dates.push(formatDateOnly(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function getWeekLetterForDate(dateStr, anchorStr, weekLetters) {
  const sorted = [...weekLetters].sort()
  if (sorted.length <= 1) return sorted[0] || 'A'
  if (!anchorStr) return sorted[0]
  const weekIndex = Math.floor(daysBetween(anchorStr, dateStr) / 7)
  const idx = ((weekIndex % sorted.length) + sorted.length) % sorted.length
  return sorted[idx]
}

function mapRowToContext(row, site = 'athletics', offeringById = null) {
  const form = {
    start_date: row.form_start_date,
    end_date: row.form_end_date,
  }
  const offeringId = row.sg_offering_id ?? row.offering_id ?? null
  const offeringStart = formatDateOnly(row.offering_start_date)
  const offeringEnd = formatDateOnly(row.offering_end_date)
  const groupRow = {
    active_start: row.sg_active_start,
    active_end: row.sg_active_end,
    dates_tbd: row.sg_dates_tbd,
    inherits_offering_dates: row.sg_inherits_offering_dates,
    offering_id: offeringId,
  }
  const slotRow = {
    active_start: row.active_start,
    active_end: row.active_end,
    dates_tbd: row.dates_tbd,
    offering_id: offeringId,
    inherits_offering_dates: row.sg_inherits_offering_dates,
  }

  let slotDates = resolveSlotActiveDates(slotRow, form, offeringById)
  if (
    groupRow.inherits_offering_dates &&
    !slotRow.dates_tbd &&
    !slotRow.active_start &&
    !slotRow.active_end
  ) {
    slotDates = resolveSlotActiveDates(groupRow, form, offeringById)
  }

  return {
    timeSlotId: Number(row.id),
    slotGroupId: Number(row.slot_group_id),
    formId: Number(row.form_id),
    classEventId: row.program_id != null ? Number(row.program_id) : null,
    programsId: row.programs_id != null ? Number(row.programs_id) : null,
    programName: row.program_name || null,
    className: row.class_name || row.form_title || 'Class',
    classDescription: row.class_description || null,
    skillLevel: row.skill_level || null,
    ageMin: row.age_min != null ? Number(row.age_min) : null,
    ageMax: row.age_max != null ? Number(row.age_max) : null,
    skillRequirements: row.skill_requirements || null,
    offeringId: offeringId != null ? Number(offeringId) : null,
    maxParticipants: row.max_participants != null ? Number(row.max_participants) : 0,
    signupCount: row.signup_count != null ? Number(row.signup_count) : 0,
    waitlistCount: row.waitlist_count != null ? Number(row.waitlist_count) : 0,
    offeringLabel: row.offering_label || null,
    offeringStartDate: offeringStart,
    offeringEndDate: offeringEnd,
    formActive: Boolean(row.form_is_active),
    enrollVisible: computeEnrollVisible(row, site),
    classActive: row.class_is_active == null ? true : Boolean(row.class_is_active),
    slotGroupActive: Boolean(row.sg_is_active),
    slotActive: Boolean(row.is_active),
    scheduleMode: row.schedule_mode || 'day',
    weekLetter: row.week_letter || null,
    dayOfWeek: row.day_of_week,
    dayName: row.day_of_week != null ? DAY_NAMES[row.day_of_week] : null,
    specificDate: formatDateOnly(row.specific_date),
    startTime: formatTime(row.start_time),
    endTime: formatTime(row.end_time),
    datesTbd: slotDates.datesTbd,
    effectiveStart: slotDates.activeStart,
    effectiveEnd: slotDates.activeEnd,
    anchorDate: offeringStart || slotDates.activeStart,
  }
}

function buildEventKey(ctx, date) {
  return `${ctx.formId}:${ctx.slotGroupId}:${ctx.timeSlotId}:${date}`
}

function buildTbdKey(ctx) {
  return `${ctx.formId}:${ctx.slotGroupId}:${ctx.timeSlotId}`
}

function buildEventPayload(ctx, date, weekLetter) {
  return {
    id: buildEventKey(ctx, date),
    date,
    startTime: ctx.startTime,
    endTime: ctx.endTime,
    formId: ctx.formId,
    classEventId: ctx.classEventId,
    programsId: ctx.programsId,
    programName: ctx.programName,
    className: ctx.className,
    classDescription: ctx.classDescription,
    skillLevel: ctx.skillLevel,
    ageMin: ctx.ageMin,
    ageMax: ctx.ageMax,
    skillRequirements: ctx.skillRequirements,
    offeringId: ctx.offeringId,
    slotGroupId: ctx.slotGroupId,
    timeSlotId: ctx.timeSlotId,
    maxParticipants: ctx.maxParticipants,
    signupCount: ctx.signupCount,
    waitlistCount: ctx.waitlistCount,
    spotsRemaining: Math.max(0, ctx.maxParticipants - ctx.signupCount),
    isFull: ctx.signupCount >= ctx.maxParticipants,
    offeringLabel: ctx.offeringLabel,
    offeringStartDate: ctx.offeringStartDate,
    offeringEndDate: ctx.offeringEndDate,
    formActive: ctx.formActive,
    enrollVisible: ctx.enrollVisible,
    classActive: ctx.classActive,
    slotGroupActive: ctx.slotGroupActive,
    slotActive: ctx.slotActive,
    weekLetter: weekLetter ?? null,
  }
}

function buildTbdPayload(ctx) {
  return {
    formId: ctx.formId,
    classEventId: ctx.classEventId,
    programsId: ctx.programsId,
    programName: ctx.programName,
    className: ctx.className,
    classDescription: ctx.classDescription,
    skillLevel: ctx.skillLevel,
    ageMin: ctx.ageMin,
    ageMax: ctx.ageMax,
    skillRequirements: ctx.skillRequirements,
    offeringId: ctx.offeringId,
    offeringLabel: ctx.offeringLabel,
    slotGroupId: ctx.slotGroupId,
    timeSlotId: ctx.timeSlotId,
    maxParticipants: ctx.maxParticipants,
    signupCount: ctx.signupCount,
    waitlistCount: ctx.waitlistCount,
    spotsRemaining: Math.max(0, ctx.maxParticipants - ctx.signupCount),
    isFull: ctx.signupCount >= ctx.maxParticipants,
    formActive: ctx.formActive,
    enrollVisible: ctx.enrollVisible,
    classActive: ctx.classActive,
    slotGroupActive: ctx.slotGroupActive,
    scheduleMode: ctx.scheduleMode,
    weekLetter: ctx.weekLetter,
    dayOfWeek: ctx.dayOfWeek,
    dayName: ctx.dayName,
    startTime: ctx.startTime,
    endTime: ctx.endTime,
  }
}

/**
 * Expand flat DB rows into calendar events for a date range (inclusive).
 */
export function expandCalendarRange({ startDate, endDate, rows, site = 'athletics' }) {
  const offeringById = buildOfferingByIdFromRows(rows)
  const contexts = rows.map((row) => mapRowToContext(row, site, offeringById))
  const weekLettersByGroup = new Map()
  for (const ctx of contexts) {
    if (!weekLettersByGroup.has(ctx.slotGroupId)) {
      weekLettersByGroup.set(ctx.slotGroupId, new Set())
    }
    if (ctx.scheduleMode === 'day') {
      weekLettersByGroup.get(ctx.slotGroupId).add(ctx.weekLetter || 'A')
    }
  }

  const events = []
  const tbdByKey = new Map()
  const eventKeys = new Set()
  const rangeDays = daysInRange(startDate, endDate)

  for (const ctx of contexts) {
    if (ctx.datesTbd) {
      const key = buildTbdKey(ctx)
      if (!tbdByKey.has(key)) {
        tbdByKey.set(key, buildTbdPayload(ctx))
      }
      continue
    }

    if (ctx.scheduleMode === 'date' && ctx.specificDate) {
      if (ctx.specificDate < startDate || ctx.specificDate > endDate) continue
      if (!dateInRange(ctx.specificDate, ctx.effectiveStart, ctx.effectiveEnd)) continue
      const key = buildEventKey(ctx, ctx.specificDate)
      if (eventKeys.has(key)) continue
      eventKeys.add(key)
      events.push(buildEventPayload(ctx, ctx.specificDate, null))
      continue
    }

    if (ctx.scheduleMode === 'day' && ctx.dayOfWeek != null) {
      const groupLetters = [...(weekLettersByGroup.get(ctx.slotGroupId) || new Set())].sort()
      const hasMultipleWeeks = groupLetters.length > 1
      const occurrenceLetter = ctx.weekLetter || 'A'

      for (const dateStr of rangeDays) {
        const d = parseDate(dateStr)
        if (!d || d.getDay() !== ctx.dayOfWeek) continue
        if (!dateInRange(dateStr, ctx.effectiveStart, ctx.effectiveEnd)) continue
        if (hasMultipleWeeks) {
          const activeLetter = getWeekLetterForDate(dateStr, ctx.anchorDate, groupLetters)
          if (activeLetter !== occurrenceLetter) continue
        }
        const key = buildEventKey(ctx, dateStr)
        if (eventKeys.has(key)) continue
        eventKeys.add(key)
        events.push(
          buildEventPayload(ctx, dateStr, hasMultipleWeeks ? occurrenceLetter : null),
        )
      }
    }
  }

  events.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date)
    if (dateCmp !== 0) return dateCmp
    const timeCmp = (a.startTime || '').localeCompare(b.startTime || '')
    if (timeCmp !== 0) return timeCmp
    return a.className.localeCompare(b.className)
  })

  const tbdPatterns = [...tbdByKey.values()].sort((a, b) => {
    const classCmp = a.className.localeCompare(b.className)
    if (classCmp !== 0) return classCmp
    return (a.startTime || '').localeCompare(b.startTime || '')
  })

  const startParts = startDate.split('-').map(Number)
  return {
    year: startParts[0],
    month: startParts[1],
    startDate,
    endDate,
    events,
    tbdPatterns,
  }
}

/**
 * Expand flat DB rows into calendar events for one month.
 */
export function expandCalendarMonth({ year, month, rows }) {
  const { monthStart, monthEnd } = monthBounds(year, month)
  return expandCalendarRange({ startDate: monthStart, endDate: monthEnd, rows })
}
