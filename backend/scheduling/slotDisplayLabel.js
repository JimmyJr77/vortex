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

export function buildSlotDisplayLabel(row) {
  if (!row) return ''
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

export function buildGroupDisplayLabel(occurrenceRows) {
  if (!occurrenceRows?.length) return ''
  return occurrenceRows.map((row) => buildSlotDisplayLabel(row)).join('; ')
}

/** Load display labels for slot groups that have no single time_slot_id on the signup. */
export async function loadGroupDisplayLabels(pool, groupIds) {
  const labels = new Map()
  const ids = [...new Set(groupIds.filter((id) => id != null).map(Number))]
  if (!ids.length) return labels

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
    labels.set(gid, buildGroupDisplayLabel(rows))
  }
  return labels
}

export function slotLabelForSignupRow(row, groupLabels = new Map()) {
  if (row.time_slot_id != null || row.start_time != null) {
    const label = buildSlotDisplayLabel(row)
    if (label) return label
  }
  const groupId = row.slot_group_id != null ? Number(row.slot_group_id) : null
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
  else if (startLabel) offeringDates = `From ${startLabel}`
  else if (endLabel) offeringDates = `Until ${endLabel}`

  return {
    offering_label: row?.offering_label?.trim() || null,
    offering_start_date: start,
    offering_end_date: end,
    offering_dates: offeringDates,
  }
}
