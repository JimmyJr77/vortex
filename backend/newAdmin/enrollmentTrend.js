import { id } from './common.js'
import { withFamilyRead } from './familyWorkspace.js'
import { summarizeMonths, summarizeLossRates, summarizeCurrent, acquisitionMetrics } from './enrollmentMetrics.js'

const OPEN_END = '9999-12-31'
function day(value) {
  const text = value instanceof Date ? value.toISOString() : String(value ?? '')
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return null
  const result = text.slice(0, 10)
  const parsed = new Date(`${result}T12:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === result ? result : null
}
const shiftDay = (value, offset) => new Date(Date.parse(`${value}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10)
const earliest = values => values.filter(Boolean).sort()[0] ?? null

// All classes and siblings share one family timeline. Intervals are [start,end):
// a first-of-month cancellation belongs to that month's opening cohort.
export function buildEnrollmentTrend({ historical = [], live = [], events = [], classes = [], subscriptions = null, spending = null, today, population = 'families' } = {}, now = new Date()) {
  today ||= new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const year = Number(today.slice(0, 4))
  const entity = row => population === 'students' ? row.member_id : row.family_id
  const bySignup = new Map()
  for (const event of events) {
    const key = String(event.signup_id ?? event.details?.sourceSignupId ?? '')
    const list = bySignup.get(key) ?? []
    list.push(event)
    bySignup.set(key, list)
  }
  const intervals = new Map(), liveStarts = new Map(), firstStarts = new Map(), uncertainFrom = []
  const activeLive = []
  let excludedRecords = 0, undatedCancellations = 0, unresolvedRecords = 0, openHistory = 0
  const recordStart = (family, start) => {
    if (start <= today) firstStarts.set(String(family), earliest([firstStarts.get(String(family)), start]))
  }
  const add = (family, start, end, knownEnd = true) => {
    if (family == null || !start || start >= end || start > today) return
    const key = String(family), rows = intervals.get(key) ?? []
    rows.push({ start, end, knownEnd })
    intervals.set(key, rows)
  }
  for (const row of live) {
    if (!['confirmed', 'cancelled', 'completed', 'paused'].includes(row.status)) continue
    const start = day(row.start_date), activity = bySignup.get(String(row.id)) ?? []
    if (activity.some(e => e.event_type === 'canceled_enrollment_error_suppressed' || /^(test|erroneous sign[ -]?up)[.!\s]*$/i.test(e.details?.reason?.trim() ?? ''))) {
      excludedRecords++
      continue
    }
    if (!start || entity(row) == null) { unresolvedRecords++; uncertainFrom.push(start ?? `${year}-01-01`); continue }
    // Persisted dates win over old scheduling events (e.g. a rescinded cancellation).
    const eventEnd = row.status === 'cancelled' ? earliest(activity.map(e => {
      if (e.event_type === 'enrollment_class_swapped') return day(e.details?.effectiveDate)
      if (e.event_type === 'enrollment_cancelled_immediately' || e.event_type === 'enrollment_cancellation_scheduled') {
        return day(e.after_value?.cancelEffectiveDate) ?? day(e.details?.preview?.effectiveDate) ?? (e.event_type === 'enrollment_cancelled_immediately' ? day(e.occurred_on) : null)
      }
      return null
    })) : null
    const end = earliest([day(row.cancel_date) ?? eventEnd, day(row.orphaned_date), day(row.completed_date),
      day(row.archived_date), day(row.program_end) ? shiftDay(day(row.program_end), 1) : null])
    if (!end || end > start) recordStart(entity(row), start)
    if (row.status === 'cancelled' && !end) {
      undatedCancellations++; uncertainFrom.push(start)
      // No guessed termination dates and no indefinite active canceled records.
      continue
    }
    if (row.status === 'completed' && !end) { unresolvedRecords++; uncertainFrom.push(start); continue }
    if (start <= today && (!end || end > start)) {
      add(entity(row), start, end ?? OPEN_END)
      if (!end || end > today) activeLive.push(row)
      const key = String(entity(row))
      liveStarts.set(key, earliest([liveStarts.get(key), start]))
    }
  }
  historical = historical.filter(row => !/trial|waitlist|requested/i.test(row.enrollment_type ?? ''))
  const historyThrough = historical.flatMap(r => [day(r.start_date), day(r.end_date)]).filter(d => d && d <= today).sort().at(-1) ?? null
  for (const row of historical) {
    const start = day(row.start_date)
    if (row.date_issue || !start || entity(row) == null || (row.end_date && !day(row.end_date))) {
      unresolvedRecords++; uncertainFrom.push(start ?? `${year}-01-01`); continue
    }
    let end = day(row.end_date), knownEnd = true
    if (!end) {
      openHistory++
      const handoff = liveStarts.get(String(entity(row)))
      // The import is a snapshot, not evidence of indefinite current enrollment.
      // Bridge reviewed household IDs to Vortex; never invent a cancellation.
      end = handoff && handoff > start ? handoff : shiftDay(historyThrough ?? start, 1)
      knownEnd = false
    }
    if (end > start) recordStart(entity(row), start)
    add(entity(row), start, end, knownEnd)
  }
  const families = [...intervals.values()].map(rows => {
    const merged = []
    for (const row of rows.sort((a, b) => a.start.localeCompare(b.start))) {
      const last = merged.at(-1)
      if (last && row.start <= last.end) {
        if (row.end > last.end) { last.end = row.end; last.knownEnd = row.knownEnd }
        else if (row.end === last.end) last.knownEnd ||= row.knownEnd
      } else merged.push({ ...row })
    }
    return merged
  })
  const coverageStart = earliest([...firstStarts.values()])
  const makeMonth = start => {
    const next = new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)), 1)).toISOString().slice(0, 10)
    const partial = today < next && today >= start
    const cutoff = partial ? today : shiftDay(next, -1)
    const opening = rows => rows.some(r => r.start < start && r.end >= start)
    const canceled = rows => {
      const last = rows.findLast(r => r.start <= cutoff)
      return Boolean(last?.knownEnd && last.end >= start && last.end <= cutoff)
    }
    const openingFamilies = families.filter(opening).length
    const lost = families.filter(rows => opening(rows) && canceled(rows)).length
    const covered = coverageStart != null && coverageStart < start
    const hasRecords = coverageStart != null && coverageStart <= cutoff
    return {
      key: start.slice(0, 7), label: new Date(`${start}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
      openingFamilies: covered ? openingFamilies : null,
      newFamilies: hasRecords ? [...firstStarts.values()].filter(first => first >= start && first <= cutoff).length : null,
      canceledFamilies: hasRecords ? families.filter(canceled).length : null,
      lostFamilies: covered ? lost : null,
      lossRate: covered && openingFamilies ? Math.round(lost / openingFamilies * 10000) / 100 : null,
      partial, provisional: uncertainFrom.some(date => date <= cutoff) || Boolean(openHistory && historyThrough && cutoff > historyThrough),
    }
  }
  const months = Array.from({ length: Number(today.slice(5, 7)) }, (_, index) => makeMonth(`${year}-${String(index + 1).padStart(2, '0')}-01`))
  const rollingMonths = Array.from({ length: 12 }, (_, index) => makeMonth(new Date(Date.UTC(year, Number(today.slice(5, 7)) - 13 + index, 1)).toISOString().slice(0, 10)))
  const summary = summarizeMonths(rollingMonths)
  const current = summarizeCurrent(activeLive, classes, today, subscriptions)
  const acquisition = spending == null ? null : acquisitionMetrics([...rollingMonths, months.at(-1)], spending, current, summary)
  const notes = [
    'New families are counted once, at their first recorded enrollment start across Jackrabbit and Vortex. Siblings, additional classes, class transfers and returning families are not new families. Trials, inquiries, waitlists and future starts are excluded.',
    'Cancellations count families whose final enrollment ended during the month and who had not returned by month end (or the as-of date). This includes completed programs; paused enrollments remain enrolled. Multiple class cancellations count once per family.',
    'Loss rate = starting families lost ÷ families enrolled at the start of the month × 100. Families that both join and leave in a month appear in cancellations but are outside the starting cohort. Same-month returns are retained. A missing or zero starting population has no loss rate.',
  ]
  notes.push('Summary cards use the previous 12 completed calendar months. Totals and averages use recorded months only; rate averages are arithmetic means of months with a nonzero known starting population. The current partial month is excluded.')
  if (openHistory) notes.push(`Jackrabbit enrollment dates extend through ${historyThrough}. Open imported records are bridged to the same family's first Vortex enrollment where available; otherwise they stop at that history cutoff without being counted as cancellations.`)
  if (undatedCancellations) notes.push(`${undatedCancellations} canceled enrollment records have no end date and are excluded from active/loss counts; their first enrollment starts are retained.`)
  if (unresolvedRecords) notes.push(`${unresolvedRecords} records have incomplete dates or unresolved family ownership and are excluded.`)
  if (excludedRecords) notes.push(`${excludedRecords} enrollments explicitly marked as tests or enrollment errors are excluded.`)
  let studentMonths, studentNotes, studentSummary
  if (population === 'families') {
    const student = buildEnrollmentTrend({ historical, live, events, today, population: 'students' }, now)
    studentMonths = student.months.map(({ openingFamilies, newFamilies, canceledFamilies, lostFamilies, ...month }) => ({
      ...month, openingStudents: openingFamilies, newStudents: newFamilies, canceledStudents: canceledFamilies, lostStudents: lostFamilies,
    }))
    studentSummary = summarizeLossRates(student.rollingMonths)
    studentNotes = [
      'Students are counted once by their shared member ID across Jackrabbit and Vortex. Additional classes, transfers and returning students are not new students. Trials, waitlists and future starts are excluded.',
      'A student cancels when their final enrollment ends and they have not returned by month end. Paused enrollments remain enrolled. Loss rate uses only students enrolled at the start of the month.',
      'Imported records without a resolved student are excluded. Open imported records bridge only to the same student’s first Vortex enrollment; otherwise they stop at the history cutoff without an invented cancellation.',
      'Family and student loss-rate cards use the same completed calendar months. Each population has its own starting cohort and known-month count; averages exclude the current partial month and months without a known, nonzero starting population.',
    ]
  }
  return { year, asOf: today, months, studentMonths, studentNotes, studentSummary, rollingMonths, summary, current, acquisition, notes, coverageStart, historyThrough, excludedRecords, undatedCancellations, unresolvedRecords }
}

// One bulk query over the local unified dataset, in a database-enforced read-only
// snapshot. Never contacts Jackrabbit/Stripe or invokes billing reconciliation.
export async function loadEnrollmentTrend(pool, facilityId, now = new Date(), { canViewFinancial = false } = {}) {
  return withFamilyRead(pool, async db => {
    const result = await db.query(`/* new-admin:enrollment-trend */
      SELECT ($2::timestamptz AT TIME ZONE COALESCE(NULLIF(loc.timezone,''),'America/New_York'))::date::text AS today,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'family_id',e.record_family_id,'status',e.status,
        'member_id',m.id,'gender',m.gender,'date_of_birth',m.date_of_birth::text,
        'form_id',e.form_id,'class_id',p.id,'class_name',e.record_class_name,'program_name',pr.display_name,
        'start_date',(CASE WHEN e.historical_only THEN e.enrollment_start_date ELSE COALESCE(e.enrollment_start_date,(e.created_at AT TIME ZONE loc.timezone)::date) END)::text,
        'cancel_date',e.cancel_effective_date::text,'orphaned_date',(e.orphaned_at AT TIME ZONE loc.timezone)::date::text,
        'completed_date',(e.completed_at AT TIME ZONE loc.timezone)::date::text,
        'archived_date',(e.archived_at AT TIME ZONE loc.timezone)::date::text,
        'date_issue',e.record_date_issue,'program_end',e.record_program_end::text,'historical_only',e.historical_only,'enrollment_type',e.record_enrollment_kind))
        FROM account_enrollment_current e
        LEFT JOIN member m ON m.id=e.member_id AND m.facility_id=$1
        LEFT JOIN scheduling_form sf ON sf.id=e.form_id
        LEFT JOIN program p ON p.id=sf.program_id AND p.facility_id=$1
        LEFT JOIN programs pr ON pr.id=COALESCE(p.programs_id,sf.programs_id) AND pr.facility_id=$1
        WHERE e.record_facility_id=$1),'[]') AS enrollments,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('signup_id',a.signup_id,'event_type',a.event_type,
        'after_value',a.after_value,'details',a.details,'occurred_on',(a.occurred_at AT TIME ZONE loc.timezone)::date::text))
        FROM billing_account_activity a JOIN family_billing_account b ON b.id=a.family_billing_account_id
        JOIN family f ON f.id=b.family_id AND f.facility_id=$1
        WHERE a.event_type IN ('enrollment_class_swapped','enrollment_cancelled_immediately','enrollment_cancellation_scheduled','canceled_enrollment_error_suppressed')),'[]') AS events,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name)) FROM program p
        WHERE p.facility_id=$1 AND p.is_active AND NOT COALESCE(p.archived,FALSE)),'[]') AS classes,
      ${canViewFinancial ? `COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'member_id',s.member_id,'family_id',f.id,
        'source_id',s.source_id,'status',s.status,'net_monthly_cents',s.net_monthly_cents))
        FROM billing_subscription s JOIN family_billing_account b ON b.id=s.family_billing_account_id
        JOIN family f ON f.id=b.family_id AND f.facility_id=$1
        WHERE s.source_type='scheduling_signup' AND s.status IN ('active','paused')
          AND s.pricing_option_key IS DISTINCT FROM 'annual_membership'
          AND s.start_date <= ($2::timestamptz AT TIME ZONE loc.timezone)::date
          AND (s.end_date IS NULL OR s.end_date > ($2::timestamptz AT TIME ZONE loc.timezone)::date)),'[]')` : 'NULL'} AS subscriptions,
      ${canViewFinancial ? `COALESCE((SELECT jsonb_agg(jsonb_build_object('month',to_char(ms.month,'YYYY-MM'),
        'amount_cents',ms.amount_cents,'version',ms.version)) FROM enrollment_marketing_spend ms WHERE ms.facility_id=$1
        AND ms.month >= (date_trunc('month',$2::timestamptz AT TIME ZONE loc.timezone) - interval '12 months')::date
        AND ms.month <= (date_trunc('month',$2::timestamptz AT TIME ZONE loc.timezone))::date),'[]')` : 'NULL'} AS spending
      FROM facility loc WHERE loc.id=$1`, [id(facilityId, 'facility'), now.toISOString()])
    const row = result.rows[0] ?? {}, records = row.enrollments ?? []
    return buildEnrollmentTrend({ today: row.today, events: row.events, classes: row.classes, subscriptions: row.subscriptions, spending: row.spending,
      live: records.filter(record => !record.historical_only),
      historical: records.filter(record => record.historical_only).map(record => ({ ...record, end_date: record.cancel_date })),
    }, now)
  })
}
