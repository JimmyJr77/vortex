import { id, inputError, pagination, searchValue, date, memberRow } from './common.js'
import { phoneSearchPattern } from '../phoneNumbers.js'
import { inquiryMemberMatchJoin } from './inquiryMemberMatch.js'
import { loadWorkspacePaymentMethod } from './paymentMethodSummary.js'
import { canonicalActiveHouseholdMemberPredicate } from '../billing/householdMembership.js'
import { loadCanonicalFinancialSnapshot } from '../billing/canonicalBillingAccount.js'
import { loadCustomerBillingAccount, loadCustomerBillingAnnualMemberships, upcomingRecurringPricingMonth, earliestActiveNextBillDate, billingMonthDueDate } from '../billing/customerBillingQueries.js'

export function workspaceNextBillDate(account, subscriptions, billingMonth) {
  // Household tuition is billed by the monthly ledger, not by an individual
  // class subscription's next_bill_date. Match the existing Billing summary.
  return account.household_monthly_billing_enabled === true
    ? billingMonthDueDate(billingMonth)
    : date(earliestActiveNextBillDate(subscriptions))
}

// One consistent local snapshot. This reader cannot create accounts, repair data,
// call Stripe, or collect payments, including through reused billing helpers.
export async function withFamilyRead(pool, fn) {
  const db = await pool.connect()
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    await db.query("SET LOCAL statement_timeout = '8s'")
    const result = await fn(db)
    await db.query('COMMIT')
    return result
  } catch (error) { await db.query('ROLLBACK'); throw error }
  finally { db.release() }
}

export async function listFamilies(pool, facilityId, query = {}) {
  const paging = pagination(query)
  const result = await pool.query(`/* family-workspace:directory */
    WITH matches AS (
      SELECT f.id,f.family_name,f.archived FROM family f WHERE f.facility_id=$1
      AND ($3::text='all' OR COALESCE(f.archived,FALSE)=($3='archived'))
      AND (f.family_name ILIKE $2 ESCAPE '\\' OR EXISTS (
        SELECT 1 FROM member m WHERE m.facility_id=$1
        AND ${canonicalActiveHouseholdMemberPredicate({ memberAlias: 'm', familyIdReference: 'f.id' })}
        AND (concat_ws(' ',m.first_name,m.last_name,m.email,m.phone) ILIKE $2 ESCAPE '\\'
          OR ($6::text IS NOT NULL AND regexp_replace(COALESCE(m.phone, ''), '[^0-9]', '', 'g') LIKE $6))))
    ), page AS (SELECT * FROM matches ORDER BY lower(family_name),id LIMIT $4 OFFSET $5)
    SELECT (SELECT count(*)::int FROM matches) AS total,
      COALESCE((SELECT jsonb_agg(row ORDER BY lower(row.family_name),row.id) FROM (
        SELECT p.*, (SELECT count(*)::int FROM member m WHERE m.facility_id=$1
          AND ${canonicalActiveHouseholdMemberPredicate({ memberAlias: 'm', familyIdReference: 'p.id' })}) AS people_count
        FROM page p) row),'[]'::jsonb) AS rows`,
  [id(facilityId), searchValue(query.search), ['all', 'archived'].includes(query.record) ? query.record : 'active', paging.pageSize, paging.offset, phoneSearchPattern(String(query.search ?? '').slice(0, 200))])
  const row = result.rows[0]
  return { rows: (row?.rows ?? []).map(r => ({ id: Number(r.id), name: r.family_name || 'Unnamed family', archived: Boolean(r.archived), peopleCount: r.people_count })),
    total: row?.total ?? 0, page: paging.page, pageSize: paging.pageSize, totalPages: Math.ceil((row?.total ?? 0) / paging.pageSize) }
}

async function resolveFamily(db, facilityId, { familyId, memberId }) {
  if (familyId != null) return id(familyId, 'family')
  const result = await db.query(`/* family-workspace:resolve-member */
    SELECT m.id,ARRAY(SELECT fm.family_id FROM family_member fm JOIN family f ON f.id=fm.family_id AND f.facility_id=$2
      WHERE fm.member_id=m.id AND fm.is_active=TRUE) AS families,
      CASE WHEN NOT EXISTS(SELECT 1 FROM family_member fm WHERE fm.member_id=m.id) THEN m.family_id END AS legacy_family
    FROM member m WHERE m.id=$1 AND m.facility_id=$2`, [id(memberId, 'member'), facilityId])
  const row = result.rows[0]
  if (!row) throw inputError('Member not found.', 404)
  const families = [...new Set((row.families ?? []).map(Number))]
  if (families.length === 1) return families[0]
  if (families.length === 0 && row.legacy_family != null) return Number(row.legacy_family)
  throw inputError('This member has no unambiguous current family. Open the individual profile to review their history.', 409)
}

async function readFamily(db, facilityId, familyId) {
  const result = await db.query(`/* family-workspace:family */
    SELECT f.id,f.family_name,f.archived,COALESCE(NULLIF(loc.timezone,''),'America/New_York') AS timezone,
      (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(loc.timezone,''),'America/New_York'))::date::text AS today,
      to_regclass('stripe_customer_projection') IS NOT NULL AS has_payment_projection
    FROM family f JOIN facility loc ON loc.id=f.facility_id WHERE f.id=$1 AND f.facility_id=$2`, [familyId, facilityId])
  if (!result.rows[0]) throw inputError('Family not found.', 404)
  return result.rows[0]
}

// Preserve inactive/former people without treating them as currently enrolled.
async function readPeople(db, familyId, facilityId) {
  const result = await db.query(`/* family-workspace:people */
    SELECT m.id,m.first_name,m.last_name,m.email,m.phone,m.date_of_birth,m.is_active,m.app_user_id,
      $1::bigint AS family_id,
      EXISTS(SELECT 1 FROM facility f WHERE f.id=m.facility_id AND f.owner_user_id=m.app_user_id) AS is_owner,
      ARRAY(SELECT a.child_member_id FROM parent_guardian_authority a
        JOIN member child ON child.id=a.child_member_id AND child.facility_id=$2
        WHERE a.parent_member_id=m.id AND a.has_legal_authority=TRUE ORDER BY a.child_member_id) AS guardian_for,
      ${canonicalActiveHouseholdMemberPredicate({ memberAlias: 'm' })} AS current_household
    FROM member m WHERE m.facility_id=$2 AND (
      EXISTS(SELECT 1 FROM family_member fm WHERE fm.member_id=m.id AND fm.family_id=$1)
      OR (m.family_id=$1 AND NOT EXISTS(SELECT 1 FROM family_member fm WHERE fm.member_id=m.id))
      OR EXISTS(SELECT 1 FROM account_record_source h WHERE h.family_id=$1 AND h.member_id=m.id AND h.facility_id=$2 AND NOT h.deleted))
    ORDER BY current_household DESC,m.last_name,m.first_name,m.id`, [familyId, facilityId])
  return result.rows.map(r => ({ ...memberRow(r), name: `${r.first_name} ${r.last_name}`.trim(), isOwner: r.is_owner, currentHousehold: r.current_household, guardianFor: r.guardian_for.map(Number) }))
}

export function participationStatus(row, today) {
  if (row.orphaned || row.archived || (row.cancelDate && row.cancelDate <= today) || (row.endDate && row.endDate < today)) return 'ended'
  if (!['confirmed', 'requested'].includes(row.status)) return row.status
  if (row.pauseDate && row.pauseDate <= today) return 'paused'
  if (row.startDate && row.startDate > today) return 'upcoming'
  return row.cancelDate ? 'pending_cancellation' : row.status === 'requested' ? 'requested' : 'active'
}

async function readParticipation(db, people, family, facilityId) {
  const memberIds = people.filter(p => p.currentHousehold).map(p => p.id)
  const result = await db.query(`/* family-workspace:participation */
    SELECT s.id,s.member_id,f.title,s.status,s.enrollment_start_date::text AS start_date,
      s.cancel_effective_date::text AS cancel_date,s.pause_effective_date::text AS pause_date,
      COALESCE(o.end_date,g.active_end,f.end_date)::text AS end_date,
      COALESCE(o.start_date,g.active_start,f.start_date)::text AS program_start,
      s.orphaned_at IS NOT NULL AS orphaned,s.archived_at IS NOT NULL AS archived,
      COALESCE(schedule.slots,'[]'::jsonb) AS slots
    FROM account_enrollment_current s LEFT JOIN member m ON m.id=s.member_id AND m.facility_id=$2
    LEFT JOIN scheduling_form f ON f.id=s.form_id
    LEFT JOIN scheduling_slot_group g ON g.id=s.slot_group_id
    LEFT JOIN scheduling_offering o ON o.id=g.offering_id
    LEFT JOIN LATERAL (SELECT jsonb_agg(jsonb_build_object('day',ts.day_of_week,'start',ts.start_time,'end',ts.end_time,'date',ts.specific_date,'week',ts.week_letter) ORDER BY ts.day_of_week,ts.start_time) AS slots
      FROM scheduling_time_slot ts WHERE (s.time_slot_id IS NOT NULL AND ts.id=s.time_slot_id)
        OR (s.time_slot_id IS NULL AND ts.slot_group_id=s.slot_group_id)) schedule ON TRUE
    WHERE s.member_id=ANY($1::bigint[]) AND s.status IN ('confirmed','requested','paused','waitlisted')
    ORDER BY s.enrollment_start_date,s.id`, [memberIds, facilityId])
  return result.rows.map(r => {
    const row = { id: Number(r.id), memberId: Number(r.member_id), className: r.title || 'Archived class', status: r.status,
      startDate: [r.start_date, r.program_start].filter(Boolean).sort().at(-1) ?? null,
      cancelDate: r.cancel_date, pauseDate: r.pause_date, endDate: r.end_date, orphaned: r.orphaned, archived: r.archived, slots: r.slots }
    return { ...row, status: participationStatus(row, family.today) }
  }).filter(row => !row.orphaned && !row.archived && row.status !== 'ended')
}

function decodeCursor(cursor) {
  if (!cursor) return null
  try {
    if (String(cursor).length > 500) throw new Error()
    const value = JSON.parse(Buffer.from(String(cursor), 'base64url').toString())
    if (!value.date || !Number.isFinite(Date.parse(value.date)) || typeof value.key !== 'string' || value.key.length > 100) throw new Error()
    return value
  } catch { throw inputError('Invalid history cursor.') }
}

export async function readFamilyHistory(db, { familyId, facilityId, memberIds, canViewBilling, cursor = null, limit = 25 }) {
  const after = decodeCursor(cursor)
  // Original records stay intact. Jackrabbit activity copies are suppressed only
  // in this display; the shared enrollment/financial row is displayed once.
  const result = await db.query(`/* family-workspace:history */
    WITH history AS (
      SELECT CASE WHEN s.historical_only THEN 'jackrabbit:'||s.record_import_id ELSE 'signup:'||s.id END AS key,COALESCE(s.created_at,'0001-01-01'::timestamptz) AS sort_at,'enrollment' AS kind,
        s.member_id,COALESCE(s.record_class_name,f.title,s.orphaned_snapshot->>'formTitle','Archived class') AS title,
        s.status||' · Start '||COALESCE(s.enrollment_start_date::text,'unknown')||
          COALESCE(' · Ends '||s.cancel_effective_date::text,'') AS summary,CASE WHEN s.record_source='jackrabbit' THEN 'Jackrabbit' ELSE 'Vortex' END AS source,NULL::bigint AS amount_cents
      FROM account_enrollment_current s LEFT JOIN member m ON m.id=s.member_id AND m.facility_id=$2
      LEFT JOIN scheduling_form f ON f.id=s.form_id WHERE s.record_family_id=$1 AND s.record_facility_id=$2
      UNION ALL
      SELECT 'dropin:'||d.id,d.created_at,'trial',d.member_id,COALESCE(f.title,'Archived class'),
        d.benefit_type||' · '||d.class_date::text||' · '||d.status,'Vortex',NULL::bigint
      FROM drop_in_registration d JOIN member m ON m.id=d.member_id AND m.facility_id=$2
      LEFT JOIN scheduling_form f ON f.id=d.form_id WHERE d.member_id=ANY($3::bigint[])
      UNION ALL
      SELECT 'transaction:'||t.kind||':'||t.id,COALESCE(t.occurred_at,'0001-01-01'::timestamptz),
        'transaction',t.member_id,t.description,'Source '||t.source_id,
        CASE WHEN t.source='jackrabbit' THEN 'Jackrabbit' ELSE 'Vortex' END,t.amount_cents
      FROM (
        SELECT 'charge' AS kind,id,record_family_id,record_facility_id,record_member_id AS member_id,record_source AS source,
          record_source_id AS source_id,record_description AS description,record_ledger_amount_cents AS amount_cents,created_at AS occurred_at
          FROM account_charge_current
        UNION ALL SELECT 'payment',id,record_family_id,record_facility_id,record_member_id,record_source,record_source_id,record_description,record_ledger_amount_cents,paid_at FROM account_payment_current
        UNION ALL SELECT 'refund',id,record_family_id,record_facility_id,record_member_id,record_source,record_source_id,record_description,record_ledger_amount_cents,created_at FROM account_refund_current
      ) t WHERE t.record_family_id=$1 AND t.record_facility_id=$2 AND $4
      UNION ALL
      SELECT 'inquiry:'||r.id,r.created_at AT TIME ZONE 'UTC','inquiry',
        COALESCE(NULLIF(to_jsonb(r)->>'converted_member_id','')::bigint,r.member_id,inquiry_contact.member_id),
        'Inquiry · '||concat_ws(' ',r.first_name,r.last_name),
        concat_ws(' · ',r.lead_status,r.message,r.admin_notes,
          CASE WHEN to_jsonb(r)->>'converted_member_id' IS NOT NULL THEN 'Explicit conversion' ELSE 'Contact match' END),
        'Vortex',NULL::bigint
      FROM registrations r ${inquiryMemberMatchJoin("NULLIF(to_jsonb(r)->>'facility_id','')::bigint", "to_jsonb(r)->>'email'")}
      WHERE (NULLIF(to_jsonb(r)->>'facility_id','')::bigint=$2 OR
        (to_jsonb(r)->>'facility_id' IS NULL AND EXISTS(SELECT 1 FROM member linked WHERE linked.id=r.member_id AND linked.facility_id=$2)))
        AND COALESCE(NULLIF(to_jsonb(r)->>'converted_member_id','')::bigint,r.member_id,inquiry_contact.member_id)=ANY($3::bigint[])
      UNION ALL
      SELECT 'activity:'||a.id,a.occurred_at,'account_activity',a.member_id,a.summary,
        a.event_type,'Vortex',NULL::bigint
      FROM billing_account_activity a JOIN family_billing_account b ON b.id=a.family_billing_account_id
      JOIN family f ON f.id=b.family_id AND f.facility_id=$2
      WHERE b.family_id=$1 AND $4 AND a.event_type NOT LIKE 'jackrabbit_%'
      UNION ALL
      SELECT 'note:'||n.id,n.created_at,'note',CASE WHEN n.subject_type='member' THEN n.subject_id ELSE NULL END,
        COALESCE(n.author_name,'Account note'),n.body,'Vortex',NULL::bigint
      FROM note n WHERE n.is_deleted=FALSE AND (
        (n.subject_type='family' AND n.subject_id=$1) OR
        (n.subject_type='member' AND n.subject_id=ANY($3::bigint[])) OR
        (n.subject_type='registration' AND n.subject_id IN (SELECT r.id FROM registrations r
          WHERE (NULLIF(to_jsonb(r)->>'facility_id','')::bigint=$2 OR (to_jsonb(r)->>'facility_id' IS NULL AND EXISTS(SELECT 1 FROM member linked WHERE linked.id=r.member_id AND linked.facility_id=$2))) AND COALESCE(NULLIF(to_jsonb(r)->>'converted_member_id','')::bigint,r.member_id)=ANY($3::bigint[]))))
    ) SELECT *,sort_at::text AS cursor_date FROM history
      WHERE ($5::timestamptz IS NULL OR (sort_at,key)<($5::timestamptz,$6::text))
      ORDER BY sort_at DESC,key DESC LIMIT $7`,
  [familyId, facilityId, memberIds, Boolean(canViewBilling), after?.date ?? null, after?.key ?? null, limit + 1])
  const more = result.rows.length > limit
  const rows = result.rows.slice(0, limit)
  const last = rows.at(-1)
  return { rows: rows.map(r => ({ key: r.key, date: r.cursor_date.startsWith('0001-') ? null : r.sort_at, kind: r.kind,
    memberId: r.member_id == null ? null : Number(r.member_id), title: r.title, summary: r.summary, source: r.source,
    amountCents: r.amount_cents == null ? null : Number(r.amount_cents) })),
  nextCursor: more ? Buffer.from(JSON.stringify({ date: last.cursor_date, key: last.key })).toString('base64url') : null }
}

export async function loadFamilyWorkspace(pool, { facilityId, familyId = null, memberId = null, canViewBilling = false, historyCursor = undefined }) {
  facilityId = id(facilityId, 'facility')
  return withFamilyRead(pool, async db => {
    const resolved = await resolveFamily(db, facilityId, { familyId, memberId })
    const family = await readFamily(db, facilityId, resolved)
    const people = await readPeople(db, resolved, facilityId)
    const memberIds = people.map(p => p.id)
    if (historyCursor !== undefined) return readFamilyHistory(db, { familyId: resolved, facilityId, memberIds, canViewBilling, cursor: historyCursor })
    const participation = await readParticipation(db, people, family, facilityId)
    const trials = await db.query(`/* family-workspace:trials */ SELECT d.id,d.member_id,d.class_date::text,d.benefit_type,d.status,f.title,
      count(*) OVER()::int AS total FROM drop_in_registration d
      JOIN member m ON m.id=d.member_id AND m.facility_id=$2 LEFT JOIN scheduling_form f ON f.id=d.form_id
      WHERE d.member_id=ANY($1::bigint[]) ORDER BY d.class_date DESC,d.id DESC LIMIT 25`, [memberIds, facilityId])
    const leads = await db.query(`/* family-workspace:leads */ SELECT r.id,r.first_name,r.last_name,r.lead_status,r.created_at,r.first_contacted_at,r.follow_up,
      NULLIF(to_jsonb(r)->>'converted_member_id','')::bigint AS converted_member_id,r.archived,r.message,r.admin_notes,count(*) OVER()::int AS total
      FROM registrations r ${inquiryMemberMatchJoin("NULLIF(to_jsonb(r)->>'facility_id','')::bigint", "to_jsonb(r)->>'email'")}
      WHERE (NULLIF(to_jsonb(r)->>'facility_id','')::bigint=$2 OR (to_jsonb(r)->>'facility_id' IS NULL AND EXISTS(
        SELECT 1 FROM member linked WHERE linked.id=r.member_id AND linked.facility_id=$2)))
        AND COALESCE(NULLIF(to_jsonb(r)->>'converted_member_id','')::bigint,r.member_id,inquiry_contact.member_id)=ANY($1::bigint[])
      ORDER BY r.created_at DESC,r.id DESC LIMIT 25`, [memberIds, facilityId])
    const history = await readFamilyHistory(db, { familyId: resolved, facilityId, memberIds, canViewBilling })
    let financial = null
    if (canViewBilling) {
      const account = await loadCustomerBillingAccount(db, resolved, facilityId)
      if (account) {
        const subscriptions = await db.query(`SELECT * FROM billing_subscription WHERE family_billing_account_id=$1 AND status <> 'cancelled'`, [account.id])
        const month = upcomingRecurringPricingMonth(new Date(), family.timezone)
        const snapshot = await loadCanonicalFinancialSnapshot(db, { accountId: account.id, subscriptions: subscriptions.rows, recurringBillingMonth: month })
        const memberships = await loadCustomerBillingAnnualMemberships(db, { accountId: account.id, members: people })
        // Older installations may not have the optional display projection yet.
        // Show unavailable details without fetching Stripe or installing schema on a GET.
        const paymentMethod = await loadWorkspacePaymentMethod(db, account, family.has_payment_projection)
        financial = { accountId: Number(account.id), payerMemberId: account.payer_member_id == null ? null : Number(account.payer_member_id),
          billingEmail: account.billing_email, billingPhone: account.billing_phone, ...snapshot,
          nextBillDate: workspaceNextBillDate(account, subscriptions.rows, month), memberships,
          paymentMethod: { available: paymentMethod.available, syncStatus: paymentMethod.syncStatus, syncedAt: paymentMethod.syncedAt,
            brand: paymentMethod.paymentMethod?.brand ?? null, last4: paymentMethod.paymentMethod?.last4 ?? null } }
      }
    }
    return { family: { id: resolved, name: family.family_name, archived: Boolean(family.archived) }, people, participation, today: family.today,
      trials: { rows: trials.rows.map(r => ({ id: Number(r.id), memberId: Number(r.member_id), className: r.title || 'Archived class', date: r.class_date, kind: r.benefit_type, status: r.status })), total: trials.rows[0]?.total ?? 0 },
      leads: { rows: leads.rows.map(r => ({ id: Number(r.id), name: `${r.first_name} ${r.last_name}`, status: r.lead_status,
        createdAt: r.created_at, contactedAt: r.first_contacted_at, followUp: r.follow_up, archived: Boolean(r.archived),
        linkType: r.converted_member_id ? 'explicit_conversion' : 'contact_match', message: r.message, notes: r.admin_notes })), total: leads.rows[0]?.total ?? 0 },
      history, financial, permissions: { canViewBilling: Boolean(canViewBilling) }, generatedAt: new Date().toISOString(),
      coverage: 'Jackrabbit entries retain their original dates and source references. Imported open enrollments are historical records, not confirmation of current attendance. Member history includes former household members; financial history belongs to this family account.' }
  })
}
