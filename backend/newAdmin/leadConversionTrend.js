import { id, inputError } from './common.js'
import { familyMemberSinceSql } from './familyMemberSince.js'
import { leadDirectoryCtes } from './leadDeduplication.js'
import { memberHasActiveMembershipSql } from './memberActivity.js'

const measures = ['inquiries', 'freeTrials', 'dropIns', 'directSignups', 'conversions']
const shift = (day, amount) => new Date(Date.parse(`${day}T12:00:00Z`) + amount * 86400000).toISOString().slice(0, 10)
function validDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T12:00:00Z`))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
}
export function conversionRange(query, today) {
  const end = query.end ?? today
  if (!validDay(end)) throw inputError('Choose a valid end date.')
  const start = query.start ?? shift(end, -364)
  const interval = query.interval ?? 'month'
  if (!validDay(start) || !validDay(end) || start > end || end > today
    || (Date.parse(end) - Date.parse(start)) / 86400000 > 1095
    || !['day', 'week', 'month'].includes(interval)) throw inputError('Choose valid dates through today, up to three years, and a daily, weekly or monthly interval.')
  return { start, end, interval }
}
const bucket = (day, interval) => interval === 'month' ? `${day.slice(0, 7)}-01`
  : interval === 'week' ? shift(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7)) : day

export function buildLeadConversionTrend(events, { start, end, interval }, today, timezone) {
  const buckets = new Map()
  for (let day = start; day <= end; day = shift(day, 1)) {
    const key = bucket(day, interval)
    if (!buckets.has(key)) buckets.set(key, { key, start: day, end: day, ...Object.fromEntries(measures.map(key => [key, 0])) })
    buckets.get(key).end = day
  }
  const totals = Object.fromEntries(measures.map(key => [key, 0]))
  for (const event of events) {
    if (!measures.includes(event.measure) || event.day < start || event.day > end) continue
    const count = Number(event.count)
    buckets.get(bucket(event.day, interval))[event.measure] += count
    totals[event.measure] += count
  }
  return { start, end, interval, today, timezone, totals, buckets: [...buckets.values()] }
}

export async function loadLeadConversionTrend(pool, facilityId, query = {}, now = new Date()) {
  const facility = id(facilityId, 'facility')
  const db = await pool.connect()
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    await db.query("SET LOCAL statement_timeout = '8s'")
    const { rows: [clock] } = await db.query(`SELECT COALESCE(NULLIF(timezone,''),'America/New_York') AS timezone,
      ($2::timestamptz AT TIME ZONE COALESCE(NULLIF(timezone,''),'America/New_York'))::date::text AS today
      FROM facility WHERE id=$1`, [facility, now])
    if (!clock) throw inputError('Facility not found.', 404)
    const range = conversionRange(query, clock.today)
    const localDay = value => `(${value} AT TIME ZONE $4)::date`
    const rows = await db.query(`/* new-admin:lead-conversion-trend */ WITH ${leadDirectoryCtes('$1')},
      member_families AS MATERIALIZED (
        SELECT m.id AS member_id,link.family_id FROM member m JOIN family_member link ON link.member_id=m.id
          JOIN family f ON f.id=link.family_id AND f.facility_id=$1 WHERE m.facility_id=$1
        UNION SELECT m.id,m.family_id FROM member m JOIN family f ON f.id=m.family_id AND f.facility_id=$1
          WHERE m.facility_id=$1 AND NOT EXISTS(SELECT 1 FROM family_member link WHERE link.member_id=m.id)
      ), inquiry_events AS MATERIALIZED (
        SELECT assignment.canonical_id AS id,min(source.created_at AT TIME ZONE 'UTC') AS occurred_at
        FROM lead_assignments assignment JOIN lead_base source ON source.id=assignment.id
        WHERE lower(btrim(COALESCE(source.inquiry_source,''),' /')) NOT IN ('free_trial','free-trial','free trial','trial')
        GROUP BY assignment.canonical_id
      ), prospect_events AS MATERIALIZED (
        SELECT assignment.canonical_id AS id,min(source.created_at AT TIME ZONE 'UTC') AS occurred_at
        FROM lead_assignments assignment JOIN lead_base source ON source.id=assignment.id GROUP BY assignment.canonical_id
      ), lead_members AS MATERIALIZED (
        SELECT r.id,linked.member_id FROM effective_leads r CROSS JOIN LATERAL (
          SELECT r.member_id UNION SELECT r.converted_member_id
          UNION SELECT NULLIF(to_jsonb(r)->>'dedup_trial_contact_member_id','')::bigint
          UNION SELECT CASE WHEN COALESCE(child->>'memberId',child->>'member_id','') ~ '^[0-9]{1,18}$'
            THEN COALESCE(child->>'memberId',child->>'member_id')::bigint END
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.campers)='array' THEN r.campers ELSE '[]'::jsonb END) child
        ) linked(member_id)
      ), booking_events AS MATERIALIZED (
        SELECT booking.member_id,booking.created_at AS occurred_at,
          CASE WHEN booking.benefit_type='free_trial' THEN 'freeTrials' ELSE 'dropIns' END AS measure
        FROM drop_in_registration booking JOIN scheduling_form form ON form.id=booking.form_id
          JOIN program class ON class.id=form.program_id AND class.facility_id=$1
          JOIN member athlete ON athlete.id=booking.member_id AND athlete.facility_id=$1
        WHERE booking.status IN ('confirmed','attended') AND (booking.benefit_type='free_trial'
          OR NOT ${memberHasActiveMembershipSql('booking.member_id', 'booking.class_date')})
      ), first_purchases AS MATERIALIZED (
        SELECT f.id AS family_id,${familyMemberSinceSql('f.id', '$1', '$5::date')}::date AS day
        FROM family f WHERE f.facility_id=$1
      ), conversion_events AS (
        SELECT purchase.*,NOT EXISTS (
          SELECT 1 FROM prospect_events inquiry JOIN lead_members lead ON lead.id=inquiry.id
            JOIN member_families household ON household.member_id=lead.member_id
            WHERE household.family_id=purchase.family_id AND ${localDay('inquiry.occurred_at')}<=purchase.day
          UNION ALL SELECT 1 FROM booking_events booking JOIN member_families household ON household.member_id=booking.member_id
            WHERE household.family_id=purchase.family_id AND ${localDay('booking.occurred_at')}<=purchase.day
        ) AS direct FROM first_purchases purchase WHERE purchase.day BETWEEN $2::date AND $3::date
      ), events AS (
        SELECT 'inquiries' AS measure,${localDay('occurred_at')} AS day FROM inquiry_events
        UNION ALL SELECT measure,${localDay('occurred_at')} FROM booking_events
        UNION ALL SELECT 'conversions',day FROM conversion_events
        UNION ALL SELECT 'directSignups',day FROM conversion_events WHERE direct
      ) SELECT measure,day::text,count(*)::int AS count FROM events
        WHERE day BETWEEN $2::date AND $3::date GROUP BY measure,day ORDER BY day`,
    [facility, range.start, range.end, clock.timezone, clock.today])
    const data = buildLeadConversionTrend(rows.rows, range, clock.today, clock.timezone)
    await db.query('COMMIT')
    return data
  } catch (error) { await db.query('ROLLBACK'); throw error }
  finally { db.release() }
}
