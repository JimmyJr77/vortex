import { rowsHaveMultipleWeekLetters, sortOccurrenceRows } from './slotSort.js'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function formatTime(t) {
  if (!t) return null
  const s = String(t)
  return s.length >= 5 ? s.slice(0, 5) : s
}

export function formatDateOnly(value) {
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

export function buildSlotDisplayLabel(row, options = {}) {
  if (!row) return ''
  const siblingRows = options.siblingRows ?? options.occurrenceRows ?? null
  const includeWeek =
    options.includeWeek ??
    (siblingRows != null ? rowsHaveMultipleWeekLetters(siblingRows) : false)
  const parts = []
  if (includeWeek) {
    const letter = String(row.week_letter ?? 'A').trim() || 'A'
    parts.push(`${letter}-Week`)
  }
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

export function buildGroupDisplayLabel(occurrenceRows) {
  if (!occurrenceRows?.length) return ''
  const includeWeek = rowsHaveMultipleWeekLetters(occurrenceRows)
  return sortOccurrenceRows(occurrenceRows)
    .map((row) => buildSlotDisplayLabel(row, { includeWeek }))
    .join('; ')
}

/** Load group display labels and occurrence rows for signup slot labels. */
export async function loadGroupDisplayLabels(pool, groupIds) {
  const labels = new Map()
  const rowsByGroupId = new Map()
  const ids = [...new Set(groupIds.filter((id) => id != null).map(Number))]
  if (!ids.length) return { labels, rowsByGroupId }

  const slotsRes = await pool.query(
    `
    SELECT slot_group_id, week_letter, schedule_mode, specific_date, day_of_week, start_time, end_time
    FROM scheduling_time_slot
    WHERE slot_group_id = ANY($1::int[])
    ORDER BY slot_group_id, week_letter NULLS LAST, day_of_week NULLS LAST,
      specific_date NULLS LAST, start_time, id
    `,
    [ids],
  )

  const byGroup = new Map()
  for (const row of slotsRes.rows) {
    const gid = Number(row.slot_group_id)
    if (!byGroup.has(gid)) byGroup.set(gid, [])
    byGroup.get(gid).push(row)
  }
  for (const [gid, rows] of byGroup) {
    rowsByGroupId.set(gid, rows)
    labels.set(gid, buildGroupDisplayLabel(rows))
  }
  return { labels, rowsByGroupId }
}

export function slotLabelForSignupRow(row, groupLabels = new Map(), rowsByGroupId = new Map()) {
  const groupId = row.slot_group_id != null ? Number(row.slot_group_id) : null
  const siblingRows = groupId != null ? rowsByGroupId.get(groupId) : null
  const includeWeek = siblingRows ? rowsHaveMultipleWeekLetters(siblingRows) : false

  if (row.time_slot_id != null || row.start_time != null) {
    const label = buildSlotDisplayLabel(row, { includeWeek, siblingRows })
    if (label) return label
  }
  if (groupId != null) {
    const groupLabel = groupLabels.get(groupId)
    if (groupLabel) return groupLabel
  }
  return '—'
}

function formatUSDateShort(isoDate) {
  const normalized = formatDateOnly(isoDate)
  if (!normalized) return null
  const [year, month, day] = normalized.split('-').map(Number)
  const dt = new Date(Date.UTC(year, month - 1, day))
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Course offering window for member enrollment rows (offering → slot group → form). */
export function resolveEnrollmentOfferingDisplay(row) {
  if (row?.group_dates_tbd) {
    return {
      offering_label: row.offering_label?.trim() || null,
      offering_start_date: null,
      offering_end_date: null,
      offering_dates: 'Dates TBD',
    }
  }

  const start =
    formatDateOnly(row?.offering_start_date) ??
    formatDateOnly(row?.group_active_start) ??
    formatDateOnly(row?.form_start_date)
  const end =
    formatDateOnly(row?.offering_end_date) ??
    formatDateOnly(row?.group_active_end) ??
    formatDateOnly(row?.form_end_date)

  const startLabel = start ? formatUSDateShort(start) : null
  const endLabel = end ? formatUSDateShort(end) : null

  let offeringDates = '—'
  if (startLabel && endLabel) offeringDates = `${startLabel} – ${endLabel}`
  else if (startLabel) offeringDates = `From ${startLabel} · Ongoing`
  else if (endLabel) offeringDates = `Until ${endLabel}`

  return {
    offering_label: row?.offering_label?.trim() || null,
    offering_start_date: start,
    offering_end_date: end,
    offering_dates: offeringDates,
  }
}

/** "Jan 9, 2026 to Jun 15, 2026" for checkout and enrollment summaries. */
export function formatOfferingDateRangeLong(start, end) {
  const startLabel = start ? formatUSDateShort(start) : null
  const endLabel = end ? formatUSDateShort(end) : null
  if (startLabel && endLabel) return `${startLabel} to ${endLabel}`
  if (startLabel) return `From ${startLabel} · Ongoing`
  if (endLabel) return `Until ${endLabel}`
  return null
}

function pluralDayName(dayOfWeek) {
  const index = Number(dayOfWeek)
  if (!Number.isFinite(index) || index < 0 || index > 6) return null
  const name = DAY_NAMES[index]
  return name.endsWith('s') ? name : `${name}s`
}

/** Day-of-week or specific-date portion of a schedule (e.g. "Mondays" or "Mon, Wed"). */
export function buildScheduleDaysPart(rows) {
  const sorted = sortOccurrenceRows(rows || [])
  if (!sorted.length) return null

  if (sorted.every((row) => row.schedule_mode === 'date' && row.specific_date)) {
    const dates = sorted
      .map((row) => formatUSDateShort(row.specific_date))
      .filter(Boolean)
    return dates.length ? dates.join(', ') : null
  }

  const dayLabels = sorted
    .map((row) => {
      if (row.schedule_mode === 'date' && row.specific_date) {
        return formatUSDateShort(row.specific_date)
      }
      if (row.day_of_week != null) return pluralDayName(row.day_of_week)
      return null
    })
    .filter(Boolean)
  const unique = [...new Set(dayLabels)]
  return unique.length ? unique.join(', ') : null
}

/** Time range portion of a schedule (e.g. "19:00-20:30"). */
export function buildScheduleTimesPart(rows) {
  const sorted = sortOccurrenceRows(rows || [])
  if (!sorted.length) return null

  const startTime = formatTime(sorted[0].start_time)
  const endTime = formatTime(sorted[0].end_time)
  const sameTime =
    startTime &&
    endTime &&
    sorted.every(
      (row) => formatTime(row.start_time) === startTime && formatTime(row.end_time) === endTime,
    )

  if (sameTime) return `${startTime}-${endTime}`

  const ranges = sorted
    .map((row) => {
      const st = formatTime(row.start_time)
      const et = formatTime(row.end_time)
      return st && et ? `${st}-${et}` : null
    })
    .filter(Boolean)
  return ranges.length ? ranges.join(', ') : null
}

export function buildEnrollmentContextLine({
  sportName,
  programName,
  className,
  offeringDates,
  scheduleDays,
  scheduleTimes,
}) {
  return [
    sportName,
    programName,
    className,
    offeringDates,
    scheduleDays,
    scheduleTimes,
  ]
    .filter((part) => part != null && String(part).trim() !== '')
    .join(' · ')
}

function mapTaxonomyRow(row) {
  const className = row.class_name?.trim() || row.form_title?.trim() || 'Class'
  const programName = row.program_name?.trim() || null
  const sportName = row.sport_name?.trim() || null
  const programId = row.program_id != null ? Number(row.program_id) : null
  const classContextLine =
    buildEnrollmentContextLine({ sportName, programName, className }) || className
  return { className, programName, sportName, programId, classContextLine }
}

/**
 * Resolve sport · program · class labels for scheduling forms (canonical enrollment taxonomy).
 */
export async function loadEnrollmentTaxonomyByFormIds(pool, formIds) {
  const ids = [...new Set((formIds || []).filter((id) => id != null).map(Number))]
  const byFormId = new Map()
  if (!ids.length) return byFormId

  const { resolveProgramsSchema, ensurePrimaryDisciplineTagColumn } = await import('../programs/schema.js')
  await ensurePrimaryDisciplineTagColumn(pool)
  const schema = await resolveProgramsSchema(pool)
  const programsTable = schema.programsTable
  const programFkColumn = schema.programFkColumn

  const result = await pool.query(
    `
    SELECT DISTINCT ON (sf.id)
      sf.id AS form_id,
      sf.title AS form_title,
      COALESCE(linked_class.display_name, linked_class.name, title_class.display_name, title_class.name, sf.title) AS class_name,
      COALESCE(sf.programs_id, linked_class.${programFkColumn}, title_class.${programFkColumn}) AS program_id,
      COALESCE(pr.display_name, pr.name) AS program_name,
      COALESCE(
        primary_dt.name,
        (
          SELECT dt.name
          FROM program_discipline_tag pdt
          JOIN discipline_tag dt ON dt.id = pdt.tag_id
          WHERE pdt.programs_id = pr.id
          ORDER BY dt.sort_order NULLS LAST, dt.name
          LIMIT 1
        )
      ) AS sport_name
    FROM scheduling_form sf
    LEFT JOIN program linked_class ON linked_class.id = sf.program_id
    LEFT JOIN program title_class
      ON sf.program_id IS NULL
      AND TRIM(LOWER(title_class.display_name)) = TRIM(LOWER(sf.title))
    LEFT JOIN ${programsTable} pr
      ON pr.id = COALESCE(sf.programs_id, linked_class.${programFkColumn}, title_class.${programFkColumn})
    LEFT JOIN discipline_tag primary_dt ON primary_dt.id = pr.primary_discipline_tag_id
    WHERE sf.id = ANY($1::int[])
    ORDER BY sf.id, title_class.id NULLS LAST
    `,
    [ids],
  )

  for (const row of result.rows) {
    byFormId.set(Number(row.form_id), mapTaxonomyRow(row))
  }
  return byFormId
}

/** Resolve taxonomy for legacy member_program rows (program_id = class row). */
export async function loadEnrollmentTaxonomyByClassIds(pool, classIds) {
  const ids = [...new Set((classIds || []).filter((id) => id != null).map(Number))]
  const byClassId = new Map()
  if (!ids.length) return byClassId

  const { resolveProgramsSchema, ensurePrimaryDisciplineTagColumn } = await import('../programs/schema.js')
  await ensurePrimaryDisciplineTagColumn(pool)
  const schema = await resolveProgramsSchema(pool)
  const programsTable = schema.programsTable
  const programFkColumn = schema.programFkColumn

  const result = await pool.query(
    `
    SELECT
      class_p.id AS class_id,
      COALESCE(class_p.display_name, class_p.name, 'Class') AS class_name,
      class_p.${programFkColumn} AS program_id,
      COALESCE(pr.display_name, pr.name) AS program_name,
      COALESCE(
        primary_dt.name,
        (
          SELECT dt.name
          FROM program_discipline_tag pdt
          JOIN discipline_tag dt ON dt.id = pdt.tag_id
          WHERE pdt.programs_id = pr.id
          ORDER BY dt.sort_order NULLS LAST, dt.name
          LIMIT 1
        )
      ) AS sport_name
    FROM program class_p
    LEFT JOIN ${programsTable} pr ON pr.id = class_p.${programFkColumn}
    LEFT JOIN discipline_tag primary_dt ON primary_dt.id = pr.primary_discipline_tag_id
    WHERE class_p.id = ANY($1::bigint[])
    `,
    [ids],
  )

  for (const row of result.rows) {
    byClassId.set(Number(row.class_id), mapTaxonomyRow(row))
  }
  return byClassId
}

export function applyEnrollmentTaxonomy(row, taxonomy) {
  if (!taxonomy) return row
  return {
    ...row,
    class_name: taxonomy.className,
    program_name: taxonomy.programName,
    sport_name: taxonomy.sportName,
    program_id: taxonomy.programId ?? row.program_id ?? null,
    class_context_line: taxonomy.classContextLine,
  }
}

export function resolveSignupScheduleRows(entry, timeSlotsByGroup = new Map()) {
  const groupId = entry.slotGroupId != null ? Number(entry.slotGroupId) : null
  const timeSlotId = entry.timeSlotId != null ? Number(entry.timeSlotId) : null

  if (
    timeSlotId != null &&
    (entry.start_time != null ||
      entry.day_of_week != null ||
      entry.schedule_mode != null ||
      entry.specific_date != null)
  ) {
    return [entry]
  }

  const groupSlots = groupId != null ? timeSlotsByGroup.get(groupId) || [] : []
  if (timeSlotId != null) {
    const match = groupSlots.find((slot) => Number(slot.id) === timeSlotId)
    if (match) return [match]
  }
  return groupSlots
}

export function buildEnrollmentDisplayContext({
  sportName,
  programName,
  className,
  formRow,
  entry,
  offeringMeta,
  timeSlotsByGroup,
  groupLabels,
  rowsByGroupId = new Map(),
}) {
  const offering = resolveEnrollmentOfferingDisplay({
    offering_start_date: offeringMeta?.offering_start_date,
    offering_end_date: offeringMeta?.offering_end_date,
    group_active_start: offeringMeta?.group_active_start,
    group_active_end: offeringMeta?.group_active_end,
    form_start_date: formRow?.start_date,
    form_end_date: formRow?.end_date,
    group_dates_tbd: offeringMeta?.dates_tbd,
    offering_label: offeringMeta?.offering_label,
  })

  let offeringDates = null
  if (offering.offering_dates === 'Dates TBD') {
    offeringDates = 'Dates TBD'
  } else if (offering.offering_start_date || offering.offering_end_date) {
    offeringDates = formatOfferingDateRangeLong(
      offering.offering_start_date,
      offering.offering_end_date,
    )
  } else if (offering.offering_dates && offering.offering_dates !== '—') {
    offeringDates = offering.offering_dates
  }

  const scheduleRows = resolveSignupScheduleRows(entry, timeSlotsByGroup)
  const scheduleDays = buildScheduleDaysPart(scheduleRows)
  const scheduleTimes = buildScheduleTimesPart(scheduleRows)
  const slotLabel =
    entry.slotLabel ||
    slotLabelForSignupRow(
      {
        ...entry,
        slot_group_id: entry.slotGroupId,
        time_slot_id: entry.timeSlotId,
      },
      groupLabels,
      rowsByGroupId,
    )

  const resolvedClassName = className || formRow?.title || 'Class'
  const displayLine =
    buildEnrollmentContextLine({
      sportName,
      programName,
      className: resolvedClassName,
      offeringDates,
      scheduleDays,
      scheduleTimes,
    }) || resolvedClassName

  return {
    sportName: sportName ?? null,
    programName: programName ?? null,
    className: resolvedClassName,
    offeringDates,
    scheduleDays,
    scheduleTimes,
    displayLine,
    slotLabel,
  }
}
