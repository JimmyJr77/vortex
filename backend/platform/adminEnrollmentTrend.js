// Enrollment dates describe service, rather than account creation or payment dates.
// Merge all athletes/classes in a household before measuring retention.
const OPEN_END = '9999-12-31'
function day(value) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? '')
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null
}
function nextDay(value) {
  return new Date(Date.parse(`${value}T12:00:00Z`) + 86400000).toISOString().slice(0, 10)
}
function earliest(values) { return values.filter(Boolean).sort()[0] ?? null }

export function buildEnrollmentTrend({ historical = [], live = [], events = [], historicalAvailable = true } = {}, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const year = Number(today.slice(0, 4))
  const bySignup = new Map()
  for (const event of events) {
    const id = String(event.signup_id ?? event.details?.sourceSignupId ?? '')
    const list = bySignup.get(id) ?? []
    list.push(event)
    bySignup.set(id, list)
  }
  const intervals = new Map()
  const uncertainFrom = []
  function add(family, start, end) {
    if (family == null || !start || start >= end || start > today) return
    const key = String(family)
    const rows = intervals.get(key) ?? []
    rows.push({ start, end })
    intervals.set(key, rows)
  }
  const liveStarts = new Map()
  let excludedRecords = 0
  for (const row of live) {
    const start = day(row.start_date)
    const activity = bySignup.get(String(row.id)) ?? []
    if (activity.some(e => /^(test|erroneous sign[ -]?up)[.!\s]*$/i.test(e.details?.reason?.trim() ?? ''))) {
      excludedRecords++
      continue
    }
    if (!start || row.family_id == null || row.status === 'waitlisted') continue
    const eventEnds = activity.map(e => {
      if (e.event_type === 'enrollment_class_swapped') return day(e.details?.effectiveDate)
      if (e.event_type === 'enrollment_cancellation_scheduled') return day(e.after_value?.cancelEffectiveDate)
      if (e.event_type === 'enrollment_cancelled_immediately' && row.status === 'cancelled' && !day(row.cancel_date)) return day(e.occurred_on)
      return null
    })
    const end = earliest([day(row.cancel_date), day(row.orphaned_date), day(row.completed_date),
      day(row.pause_date), day(row.archived_date), row.program_end ? nextDay(day(row.program_end)) : null, ...eventEnds])
    if (row.status === 'cancelled' && !end) {
      uncertainFrom.push(start)
      continue
    }
    if (!['confirmed', 'cancelled', 'completed', 'paused'].includes(row.status)) continue
    add(row.family_id, start, end ?? OPEN_END)
    if (start <= today && (!end || end > start)) {
      const key = String(row.family_id)
      liveStarts.set(key, earliest([liveStarts.get(key), start]))
    }
  }
  const historyThrough = historical.reduce((last, row) => {
    const date = [day(row.start_date), day(row.end_date)].filter(Boolean).sort().at(-1)
    return date && date > last ? date : last
  }, '')
  let carriedForward = false
  for (const row of historical) {
    const start = day(row.start_date)
    let end = day(row.end_date)
    if (!end) {
      // Jackrabbit open records are snapshots, not proof of indefinite retention.
      // Bridge to the family's current-system history; flag the assumption below.
      const handoff = liveStarts.get(String(row.family_id))
      end = handoff && handoff > start ? handoff : OPEN_END
      carriedForward = true
    }
    add(row.family_id, start, end)
  }
  const families = [...intervals.values()].map(rows => {
    const merged = []
    for (const row of rows.sort((a, b) => a.start.localeCompare(b.start))) {
      const last = merged.at(-1)
      if (last && row.start <= last.end) last.end = last.end > row.end ? last.end : row.end
      else merged.push({ ...row })
    }
    return merged
  })
  const coverageStart = earliest(families.map(rows => rows[0].start))
  const months = Array.from({ length: Number(today.slice(5, 7)) }, (_, index) => {
    const start = `${year}-${String(index + 1).padStart(2, '0')}-01`
    const next = new Date(Date.UTC(year, index + 1, 1)).toISOString().slice(0, 10)
    const partial = today < next && today >= start
    const cutoff = partial ? today : new Date(Date.parse(`${next}T12:00:00Z`) - 86400000).toISOString().slice(0, 10)
    // Include families canceling on the first, but exclude brand-new first-day starts.
    const opening = families.filter(rows => rows.some(r => r.start < start && r.end >= start))
    const lost = opening.filter(rows => !rows.some(r => r.start <= cutoff && r.end > cutoff)).length
    const covered = coverageStart != null && coverageStart < start
    const provisional = uncertainFrom.some(date => date <= cutoff) ||
      (carriedForward && Boolean(historyThrough) && cutoff > historyThrough) || !historicalAvailable
    return {
      key: start.slice(0, 7), label: new Date(`${start}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
      openingFamilies: covered ? opening.length : null,
      newFamilies: coverageStart && coverageStart <= cutoff ? families.filter(rows => rows[0].start >= start && rows[0].start <= cutoff).length : null,
      lostFamilies: covered ? lost : null,
      lossRate: covered && opening.length ? Math.round(lost / opening.length * 10000) / 100 : null,
      partial, provisional,
    }
  })
  const notes = ['New enrollees are families at their first recorded enrollment start, not individual athletes or classes. Returning families are not counted as new.',
    'Loss rate is the share of families enrolled entering the month with no enrollment remaining at month end (or today for the current month). Same-month returns and class transfers are retained.']
  if (coverageStart) notes.push(`Recorded history begins ${coverageStart}; the first recorded month has no verified opening population.`)
  if (carriedForward) notes.push(`Jackrabbit activity extends through ${historyThrough}. Open Jackrabbit enrollments are carried forward until current-system enrollment begins; later months are provisional pending migration reconciliation.`)
  if (uncertainFrom.length) notes.push(`${uncertainFrom.length} canceled enrollment records have no end date and are excluded; affected months are provisional.`)
  if (!historicalAvailable) notes.push('Jackrabbit history is unavailable. Figures use current-system records and are provisional.')
  return { year, asOf: today, months, notes, excludedRecords }
}

export async function loadEnrollmentTrend(pool, facilityId, now = new Date()) {
  let historicalAvailable = true
  const [historical, live, events] = await Promise.all([
    pool.query(`SELECT h.family_id,h.source_data->>'Enroll Date' AS start_date,
      h.source_data->>'Drop Date' AS end_date FROM jackrabbit_history_record h
      JOIN family f ON f.id=h.family_id AND f.facility_id=$1
      WHERE h.facility_id=$1 AND h.record_kind='enrollment'`, [facilityId]).catch(error => {
      if (error.code !== '42P01') throw error
      historicalAvailable = false
      return { rows: [] }
    }),
    pool.query(`SELECT s.id,m.family_id,s.status,
      COALESCE(s.enrollment_start_date,(s.created_at AT TIME ZONE 'America/New_York')::date)::text AS start_date,
      s.cancel_effective_date::text AS cancel_date,
      (s.orphaned_at AT TIME ZONE 'America/New_York')::date::text AS orphaned_date,
      (s.completed_at AT TIME ZONE 'America/New_York')::date::text AS completed_date,
      COALESCE(s.pause_effective_date,(s.paused_at AT TIME ZONE 'America/New_York')::date)::text AS pause_date,
      (s.archived_at AT TIME ZONE 'America/New_York')::date::text AS archived_date,
      COALESCE(o.end_date,g.active_end,f.end_date)::text AS program_end
      FROM scheduling_signup s JOIN member m ON m.id=s.member_id AND m.facility_id=$1
      JOIN family household ON household.id=m.family_id AND household.facility_id=$1
      LEFT JOIN scheduling_form f ON f.id=s.form_id
      LEFT JOIN scheduling_slot_group g ON g.id=s.slot_group_id
      LEFT JOIN scheduling_offering o ON o.id=g.offering_id`, [facilityId]),
    pool.query(`SELECT a.signup_id,a.event_type,a.after_value,a.details,
      (a.occurred_at AT TIME ZONE 'America/New_York')::date::text AS occurred_on
      FROM billing_account_activity a JOIN family_billing_account b ON b.id=a.family_billing_account_id
      JOIN family f ON f.id=b.family_id AND f.facility_id=$1
      WHERE a.event_type IN ('enrollment_class_swapped','enrollment_cancelled_immediately','enrollment_cancellation_scheduled')`, [facilityId]),
  ])
  return buildEnrollmentTrend({ historical: historical.rows, live: live.rows, events: events.rows, historicalAvailable }, now)
}
