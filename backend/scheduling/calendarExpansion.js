const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
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

function intersectRange(...ranges) {
  let start = null
  let end = null
  for (const range of ranges) {
    if (!range) continue
    if (range.start) {
      start = start == null ? range.start : (range.start > start ? range.start : start)
    }
    if (range.end) {
      end = end == null ? range.end : (range.end < end ? range.end : end)
    }
  }
  if (start && end && start > end) return { start: null, end: null }
  return { start, end }
}

function resolveActiveDates(entity, form) {
  if (entity.dates_tbd || entity.datesTbd) {
    return { activeStart: null, activeEnd: null, datesTbd: true }
  }
  const activeStart =
    formatDateOnly(entity.active_start ?? entity.activeStart) ??
    formatDateOnly(entity.start_date ?? entity.startDate) ??
    formatDateOnly(form?.start_date ?? form?.startDate) ??
    null
  const activeEnd =
    formatDateOnly(entity.active_end ?? entity.activeEnd) ??
    formatDateOnly(entity.end_date ?? entity.endDate) ??
    formatDateOnly(form?.end_date ?? form?.endDate) ??
    null
  return { activeStart, activeEnd, datesTbd: false }
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

function mapRowToContext(row) {
  const form = {
    start_date: row.form_start_date,
    end_date: row.form_end_date,
  }
  const group = {
    active_start: row.sg_active_start,
    active_end: row.sg_active_end,
    dates_tbd: row.sg_dates_tbd,
    start_date: null,
    end_date: null,
  }
  const slotDates = resolveActiveDates(row, form)
  const groupDates = resolveActiveDates(group, form)
  const offeringRange = {
    start: formatDateOnly(row.offering_start_date),
    end: formatDateOnly(row.offering_end_date),
  }
  const effective = intersectRange(
    { start: offeringRange.start, end: offeringRange.end },
    { start: groupDates.activeStart, end: groupDates.activeEnd },
    { start: slotDates.activeStart, end: slotDates.activeEnd },
  )

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
    categoryId: row.category_id != null ? Number(row.category_id) : null,
    categoryName: row.category_name || (row.category_id == null ? 'No Category' : null),
    offeringLabel: row.offering_label || null,
    offeringStartDate: offeringRange.start,
    offeringEndDate: offeringRange.end,
    formActive: Boolean(row.form_is_active),
    slotGroupActive: Boolean(row.sg_is_active),
    slotActive: Boolean(row.is_active),
    scheduleMode: row.schedule_mode || 'day',
    weekLetter: row.week_letter || null,
    dayOfWeek: row.day_of_week,
    dayName: row.day_of_week != null ? DAY_NAMES[row.day_of_week] : null,
    specificDate: formatDateOnly(row.specific_date),
    startTime: formatTime(row.start_time),
    endTime: formatTime(row.end_time),
    datesTbd: Boolean(row.dates_tbd || row.sg_dates_tbd),
    effectiveStart: effective.start,
    effectiveEnd: effective.end,
    anchorDate: offeringRange.start || effective.start,
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
    categoryId: ctx.categoryId,
    categoryName: ctx.categoryName,
    offeringLabel: ctx.offeringLabel,
    offeringStartDate: ctx.offeringStartDate,
    offeringEndDate: ctx.offeringEndDate,
    formActive: ctx.formActive,
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
    categoryId: ctx.categoryId,
    categoryName: ctx.categoryName,
    offeringLabel: ctx.offeringLabel,
    formActive: ctx.formActive,
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
export function expandCalendarRange({ startDate, endDate, rows }) {
  const contexts = rows.map(mapRowToContext)
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
