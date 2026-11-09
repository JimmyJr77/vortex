import { activeLedgerChargePredicate, settledRefundPredicate } from './billingLedgerSql.js'
import { requireAdminFacilityScope } from './adminFacilityScope.js'

export const ACCOUNTING_EXPORT_LIMIT = 10000
const LINE_SORT = { date: 'billed_at', person: 'member_name', class: 'class_name', billed: 'amount_cents', paid: 'paid_cents', balance: 'open_cents' }
const PAYMENT_SORT = { date: 'occurred_at', person: 'family_name', amount: 'signed_amount_cents', applied: 'filtered_applied_cents' }
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })
function positive(value, label, fallback = null) {
  if (value == null || value === '') return fallback
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number <= 0) throw fail(`Invalid ${label}.`)
  return number
}
function reportId(value, label) {
  const number=Number(value)
  if (!Number.isSafeInteger(number) || number===0) throw fail(`Invalid ${label}.`)
  return number
}
function date(value, label) {
  if (value == null || value === '') return null
  const text = String(value)
  const parsed = new Date(`${text}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) throw fail(`Invalid ${label} date.`)
  return text
}
function choice(value, allowed, fallback, label) {
  const result = value == null || value === '' ? fallback : String(value)
  if (!allowed.includes(result)) throw fail(`Invalid ${label}.`)
  return result
}
export function accountingFilters(query = {}, view = 'lines') {
  const filters = {
    from: date(query.from, 'from'), through: date(query.through, 'through'),
    dateField: choice(query.dateField, ['billed', 'paid'], 'billed', 'date field'),
    search: String(query.search ?? '').trim().slice(0, 200),
    memberId: positive(query.memberId, 'member'), classId: positive(query.classId, 'class'),
    status: choice(query.status, ['all', 'open', 'partial', 'paid', 'credit', 'voided', 'historical'], 'all', 'bill status'),
    kind: choice(query.kind, ['all', 'payment', 'refund'], 'all', 'payment kind'),
    paymentStatus: choice(query.paymentStatus, ['all', 'settled', 'pending', 'failed'], 'all', 'payment status'),
    sortBy: choice(query.sortBy, Object.keys(view === 'payments' ? PAYMENT_SORT : LINE_SORT), 'date', 'sort column'),
    sortDir: choice(String(query.sortDir ?? 'desc').toLowerCase(), ['asc', 'desc'], 'desc', 'sort direction'),
    page: positive(query.page, 'page', 1), pageSize: Math.min(100, positive(query.pageSize, 'page size', 25)),
  }
  if (filters.from && filters.through && filters.from > filters.through) throw fail('From date must precede through date.')
  if (filters.page > 1000000) throw fail('Page is too large.')
  return filters
}

// Every signed charge has exactly one report owner. Fold direct corrections and
// unambiguous historical price adjustments once; retain ambiguous standalone rows.
// Invoice totals are never financial input, including duplicate invoice versions.
const CTE = `WITH scoped_accounts AS (
  SELECT account.id,account.family_id,family.family_name,
    COALESCE(NULLIF(facility.timezone,''),'America/New_York') AS timezone, family.facility_id
  FROM family_billing_account account JOIN family ON family.id=account.family_id
  JOIN facility ON facility.id=family.facility_id WHERE family.facility_id=$1
), scoped_payments AS (
  SELECT record.*,family.family_name,record.record_family_id AS family_id,
    COALESCE(NULLIF(loc.timezone,''),'America/New_York') AS timezone
  FROM account_payment_current record JOIN facility loc ON loc.id=record.record_facility_id
  LEFT JOIN family ON family.id=record.record_family_id AND family.facility_id=$1
  WHERE record.record_facility_id=$1
), scoped_refunds AS (
  SELECT record.*,family.family_name,record.record_family_id AS family_id,
    COALESCE(NULLIF(loc.timezone,''),'America/New_York') AS timezone
  FROM account_refund_current record JOIN facility loc ON loc.id=record.record_facility_id
  LEFT JOIN family ON family.id=record.record_family_id AND family.facility_id=$1
  WHERE record.record_facility_id=$1
), charges AS (
  SELECT charge.*,charge.record_family_id AS family_id,COALESCE(account.family_name,family.family_name) AS family_name,
    COALESCE(account.timezone,loc.timezone,'America/New_York') AS timezone,charge.record_facility_id AS facility_id
  FROM account_charge_current charge LEFT JOIN scoped_accounts account ON account.id=charge.family_billing_account_id
  LEFT JOIN family ON family.id=charge.record_family_id AND family.facility_id=$1
  JOIN facility loc ON loc.id=charge.record_facility_id WHERE charge.record_facility_id=$1
), mapped AS (
  SELECT charge.*,COALESCE(parent.id,charge.id) AS owner_id
  FROM charges charge LEFT JOIN LATERAL (
    SELECT CASE WHEN COUNT(*)=1 THEN MIN(candidate.id) END AS id FROM account_charge_current candidate
    WHERE candidate.family_billing_account_id=charge.family_billing_account_id AND candidate.id<>charge.id
      AND candidate.source_type NOT IN ('charge_adjustment','refund_offset','price_adjustment','price_adjustment_reversal')
      AND ((charge.source_type IN ('charge_adjustment','refund_offset') AND candidate.id=charge.related_charge_id)
        OR (charge.source_type IN ('price_adjustment','price_adjustment_reversal')
          AND charge.subscription_id IS NOT NULL AND candidate.subscription_id=charge.subscription_id
          AND candidate.service_period_start=charge.service_period_start AND candidate.amount_cents>=0))
  ) parent ON TRUE
), applications AS (
  SELECT application.*,charge.owner_id,payment.paid_at,payment.method,payment.external_status AS payment_status,
    payment.family_billing_account_id,
    CASE WHEN application.application_kind='reversal' THEN -application.amount_cents ELSE application.amount_cents END::bigint AS signed_cents
  FROM billing_payment_application application JOIN mapped charge ON charge.id=application.billing_charge_id
  JOIN account_payment_current payment ON payment.id=application.billing_payment_id
    AND payment.family_billing_account_id=charge.family_billing_account_id
), settled_allocations AS (
  SELECT owner_id,billing_payment_id,paid_at,method,SUM(signed_cents)::bigint AS amount_cents,BOOL_OR(signed_cents>0) AS has_receipt
  FROM applications WHERE payment_status IN ('settled','succeeded')
  GROUP BY owner_id,billing_payment_id,paid_at,method
), charge_totals AS (
  SELECT owner_id,SUM(amount_cents)::bigint AS amount_cents,
    SUM(CASE WHEN id<>owner_id THEN amount_cents ELSE 0 END)::bigint AS adjustment_cents
  FROM mapped GROUP BY owner_id
), paid_totals AS (
  SELECT owner_id,SUM(amount_cents)::bigint AS amount_cents,
    MAX(paid_at) FILTER(WHERE has_receipt) AS last_paid_at,
    COUNT(*) FILTER(WHERE has_receipt) AS payment_count
  FROM settled_allocations GROUP BY owner_id
), credit_totals AS (
  SELECT target.owner_id,SUM(application.amount_cents)::bigint AS amount_cents
  FROM billing_charge_credit_application application
  JOIN billing_monthly_invoice_line target_line ON target_line.id=application.target_invoice_line_id
  JOIN billing_monthly_invoice_line credit_line ON credit_line.id=application.credit_invoice_line_id
  JOIN mapped target ON target.id=target_line.billing_charge_id
  JOIN mapped credit ON credit.id=credit_line.billing_charge_id AND credit.family_billing_account_id=target.family_billing_account_id
  WHERE credit.owner_id<>target.owner_id AND ${activeLedgerChargePredicate('credit')}
  GROUP BY target.owner_id
), line_values AS (
  SELECT root.*,COALESCE(member.first_name || ' ' || member.last_name,'Unassigned') AS member_name,
    member.id AS scoped_member_id, class.id AS class_id,
    COALESCE(class.display_name,class.name,signup.orphaned_snapshot->>'formTitle',root.record_class_name) AS class_name,
    values.amount_cents AS effective_cents,values.adjustment_cents,
    COALESCE(paid.amount_cents,0)::bigint AS paid_cents,paid.last_paid_at,COALESCE(paid.payment_count,0)::int AS payment_count,
    COALESCE(credits.amount_cents,0)::bigint AS credit_applied_cents,
    (root.historical_only OR NOT (${activeLedgerChargePredicate('root')})) AS ledger_retired
  FROM mapped root
  JOIN charge_totals values ON values.owner_id=root.id
  LEFT JOIN member ON member.id=root.member_id AND member.facility_id=root.facility_id
  LEFT JOIN billing_subscription subscription ON subscription.id=root.subscription_id
    AND subscription.family_billing_account_id=root.family_billing_account_id
  LEFT JOIN scheduling_signup signup ON signup.id=CASE
    WHEN root.source_type='scheduling_signup' AND root.source_id ~ '^[0-9]+(:|$)' THEN substring(root.source_id FROM '^[0-9]+')::bigint
    WHEN subscription.source_type='scheduling_signup' AND subscription.source_id ~ '^[0-9]+$' THEN subscription.source_id::bigint END
    AND (root.member_id IS NULL OR signup.member_id=root.member_id)
    AND EXISTS(SELECT 1 FROM member signup_member WHERE signup_member.id=signup.member_id AND signup_member.facility_id=root.facility_id)
  LEFT JOIN drop_in_registration drop_in ON root.source_type='drop_in'
    AND root.source_id ~ '^[0-9]+$' AND drop_in.id=CASE WHEN root.source_id ~ '^[0-9]+$' THEN root.source_id::bigint END
    AND (root.member_id IS NULL OR drop_in.member_id=root.member_id)
    AND EXISTS(SELECT 1 FROM member drop_in_member WHERE drop_in_member.id=drop_in.member_id AND drop_in_member.facility_id=root.facility_id)
  LEFT JOIN scheduling_form form ON form.id=COALESCE(signup.form_id,drop_in.form_id)
  LEFT JOIN program class ON class.id=form.program_id AND class.facility_id=root.facility_id
  LEFT JOIN paid_totals paid ON paid.owner_id=root.id
  LEFT JOIN credit_totals credits ON credits.owner_id=root.id
  WHERE root.owner_id=root.id
), lines AS (
  SELECT id,family_billing_account_id AS account_id,family_id,family_name,timezone,scoped_member_id AS member_id,member_name,
    class_id,class_name,description,charge_type,source_type,record_source AS source,created_at AS billed_at,
    (created_at AT TIME ZONE timezone)::date::text AS billed_date,service_period_start::text,service_period_end::text,
    amount_cents::bigint AS original_cents,adjustment_cents,effective_cents AS amount_cents,paid_cents,credit_applied_cents,
    CASE WHEN ledger_retired OR source_type IN ('membership_transfer_cancelled','membership_bill_recalled') THEN 0
      ELSE GREATEST(0,effective_cents-paid_cents-credit_applied_cents) END::bigint AS open_cents,
    CASE WHEN historical_only THEN 'historical' WHEN ledger_retired OR source_type IN ('membership_transfer_cancelled','membership_bill_recalled') THEN 'voided'
      WHEN effective_cents<0 THEN 'credit'
      WHEN effective_cents=0 AND COALESCE(gross_amount_cents,0)>0 AND COALESCE(discount_amount_cents,0)=gross_amount_cents THEN 'paid'
      WHEN effective_cents=0 THEN 'voided'
      WHEN paid_cents+credit_applied_cents>=effective_cents THEN 'paid'
      WHEN paid_cents+credit_applied_cents>0 THEN 'partial' ELSE 'open' END AS status,
    last_paid_at,(last_paid_at AT TIME ZONE timezone)::date::text AS last_paid_date,payment_count,ledger_retired
  FROM line_values

)`

function whereLines(filters, params, { dates = true, search = true, alias = 'line' } = {}) {
  const terms = []
  const bind = value => { params.push(value); return `$${params.length}` }
  if (filters.memberId) terms.push(`${alias}.member_id=${bind(filters.memberId)}`)
  if (filters.classId) terms.push(`${alias}.class_id=${bind(filters.classId)}`)
  if (filters.status !== 'all') terms.push(filters.status === 'open' ? `${alias}.open_cents>0` : `${alias}.status=${bind(filters.status)}`)
  if (search && filters.search) {
    const key = bind(`%${filters.search.replace(/[\\%_]/g, '\\$&')}%`)
    terms.push(`(${alias}.description ILIKE ${key} OR ${alias}.family_name ILIKE ${key} OR ${alias}.member_name ILIKE ${key} OR ${alias}.class_name ILIKE ${key} OR ${alias}.id::text ILIKE ${key})`)
  }
  if (dates && (filters.from || filters.through)) {
    const dateRef = filters.dateField === 'paid' ? '(selected_payment.paid_at AT TIME ZONE line.timezone)::date' : '(line.billed_at AT TIME ZONE line.timezone)::date'
    const dateTerms = []
    if (filters.from) dateTerms.push(`${dateRef}>=${bind(filters.from)}::date`)
    if (filters.through) dateTerms.push(`${dateRef}<=${bind(filters.through)}::date`)
    terms.push(filters.dateField === 'paid'
      ? `EXISTS(SELECT 1 FROM settled_allocations selected_payment WHERE selected_payment.owner_id=line.id AND selected_payment.has_receipt AND ${dateTerms.join(' AND ')})`
      : dateTerms.join(' AND '))
  }
  return terms.length ? terms.join(' AND ') : 'TRUE'
}
const numbers = new Set(['id','accountId','familyId','memberId','classId','originalCents','adjustmentCents','amountCents','paidCents','creditAppliedCents','openCents','paymentCount','signedAmountCents','appliedCents','filteredAppliedCents','unappliedCents','relatedPaymentId','refundedCents','chargeId','paymentId','sourceChargeId','targetChargeId','relatedChargeId'])
const camel = text => text.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
function mapRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key,value]) => {
    const name = camel(key)
    return [name,numbers.has(name) && value != null ? Number(value) : value]
  }))
}
function wrapper(row, filters) {
  const summary = Object.fromEntries(Object.entries(row.summary ?? {}).map(([key,value]) => [key,Number(value)]))
  return { rows:(row.rows ?? []).map(item => ({...mapRow(item),currency:'usd'})), summary,
    total:Number(row.total ?? 0),page:filters.page,pageSize:filters.pageSize,
    totalPages:Math.ceil(Number(row.total ?? 0)/filters.pageSize),timezone:row.timezone ?? 'America/New_York',
    currency:'usd',generatedAt:new Date().toISOString(),appliedFilters:filters }
}
const LINE_SUMMARY = `jsonb_build_object('billedCents',COALESCE(SUM(amount_cents),0),'paidCents',COALESCE(SUM(paid_cents),0),
 'creditAppliedCents',COALESCE(SUM(credit_applied_cents),0),'openCents',COALESCE(SUM(open_cents),0),
 'creditCents',COALESCE(SUM(-amount_cents) FILTER(WHERE amount_cents<0),0),'openCount',COUNT(*) FILTER(WHERE open_cents>0))`

export async function listAccountingLines(db,{facilityId,query = {},exportLimit = null} = {}) {
  const scope=requireAdminFacilityScope({facilityId}),filters=accountingFilters(query),params=[scope]
  const where=whereLines(filters,params)
  const limit=exportLimit ?? filters.pageSize,offset=exportLimit ? 0 : (filters.page-1)*filters.pageSize
  params.push(limit,offset)
  const result=await db.query(`${CTE}, filtered AS (SELECT line.* FROM lines line WHERE ${where}),
    page_rows AS (SELECT * FROM filtered ORDER BY ${LINE_SORT[filters.sortBy]} ${filters.sortDir} NULLS LAST,id ${filters.sortDir} LIMIT $${params.length-1} OFFSET $${params.length})
    SELECT (SELECT COUNT(*) FROM filtered)::bigint AS total,
      (SELECT ${LINE_SUMMARY} FROM filtered) AS summary,
      (SELECT COALESCE(NULLIF(timezone,''),'America/New_York') FROM facility WHERE id=$1) AS timezone,
      COALESCE((SELECT jsonb_agg(page_rows) FROM page_rows),'[]'::jsonb) AS rows`,params)
  return wrapper(result.rows[0],filters)
}

function paymentCte(filters, params) {
  const selected=whereLines(filters,params,{dates:false,search:false})
  const relational=Boolean(filters.memberId || filters.classId || filters.status!=='all')
  const imported = alias => filters.classId || filters.status!=='all' ? 'FALSE' : filters.memberId ? `EXISTS(SELECT 1 FROM family_member fm JOIN member m ON m.id=fm.member_id AND m.facility_id=${alias}.record_facility_id WHERE fm.family_id=${alias}.record_family_id AND fm.member_id=$2)` : 'TRUE'
  return `, selected_lines AS (SELECT line.* FROM lines line WHERE ${selected}), payment_allocations AS (
    SELECT billing_payment_id,SUM(amount_cents)::bigint AS amount_cents,
      SUM(amount_cents) FILTER(WHERE owner_id IN(SELECT id FROM selected_lines))::bigint AS filtered_cents
    FROM settled_allocations GROUP BY billing_payment_id
  ), payment_refunds AS (
    SELECT refund.payment_id,refund.family_billing_account_id,SUM(refund.amount_cents)::bigint AS amount_cents
    FROM account_refund_current refund JOIN scoped_accounts account ON account.id=refund.family_billing_account_id
    WHERE ${settledRefundPredicate('refund')} GROUP BY refund.payment_id,refund.family_billing_account_id
  ), payment_values AS (
    SELECT payment.id,'payment'::text AS kind,payment.family_billing_account_id AS account_id,payment.family_id,payment.family_name,payment.timezone,
      payment.paid_at AS occurred_at,(payment.paid_at AT TIME ZONE payment.timezone)::date::text AS occurred_date,
      payment.method,CASE WHEN payment.historical_only THEN 'historical' ELSE payment.external_status END AS status,payment.amount_cents::bigint AS amount_cents,payment.amount_cents::bigint AS signed_amount_cents,
      (payment.external_status IN ('settled','succeeded')) AS settled,
      COALESCE(allocation.amount_cents,0)::bigint AS applied_cents,
      COALESCE(allocation.filtered_cents,0)::bigint AS filtered_applied_cents,
      CASE WHEN payment.historical_only THEN 0 ELSE GREATEST(0,payment.amount_cents-COALESCE(refunds.amount_cents,0)-COALESCE(allocation.amount_cents,0)) END::bigint AS unapplied_cents,
      COALESCE(refunds.amount_cents,0)::bigint AS refunded_cents,NULL::bigint AS related_payment_id,
      COALESCE(payment.external_reference,payment.stripe_payment_intent_id,payment.stripe_invoice_id) AS reference
    FROM scoped_payments payment
    LEFT JOIN payment_allocations allocation ON allocation.billing_payment_id=payment.id
    LEFT JOIN payment_refunds refunds ON refunds.payment_id=payment.id AND refunds.family_billing_account_id=payment.family_billing_account_id
    WHERE (payment.historical_only AND ${imported('payment')}) OR (NOT payment.historical_only AND ${relational ? 'EXISTS(SELECT 1 FROM applications application JOIN selected_lines line ON line.id=application.owner_id WHERE application.billing_payment_id=payment.id)' : 'TRUE'})
    UNION ALL
    SELECT refund.id,'refund',refund.family_billing_account_id,refund.family_id,refund.family_name,refund.timezone,
      refund.created_at,(refund.created_at AT TIME ZONE refund.timezone)::date::text,
      COALESCE(payment.method,refund.record_payment_method),CASE WHEN refund.historical_only THEN 'historical' ELSE refund.external_status END,refund.amount_cents::bigint,-refund.amount_cents::bigint,
      ${settledRefundPredicate('refund')},0::bigint,NULL::bigint,0::bigint,0::bigint,refund.payment_id,
      COALESCE(refund.external_reference,refund.stripe_refund_id)
    FROM scoped_refunds refund
    LEFT JOIN account_payment_current payment ON payment.id=refund.payment_id AND payment.family_billing_account_id=refund.family_billing_account_id
    WHERE (refund.historical_only AND ${imported('refund')}) OR (NOT refund.historical_only AND (${relational ? `EXISTS(SELECT 1 FROM mapped charge JOIN selected_lines line ON line.id=charge.owner_id WHERE charge.id=refund.related_charge_id)
      OR EXISTS(SELECT 1 FROM applications application JOIN selected_lines line ON line.id=application.owner_id WHERE application.billing_payment_id=refund.payment_id)` : 'TRUE'}))

  )`
}
const PAYMENT_SUMMARY = `jsonb_build_object('receiptsCents',COALESCE(SUM(amount_cents) FILTER(WHERE kind='payment' AND settled),0),
 'refundsCents',COALESCE(SUM(amount_cents) FILTER(WHERE kind='refund' AND settled),0),
 'netCashCents',COALESCE(SUM(signed_amount_cents) FILTER(WHERE settled),0),
 'filteredAppliedCents',COALESCE(SUM(filtered_applied_cents) FILTER(WHERE kind='payment' AND settled),0),
 'unappliedCents',COALESCE(SUM(unapplied_cents) FILTER(WHERE kind='payment' AND settled),0),
 'paymentCount',COUNT(*) FILTER(WHERE kind='payment'),'refundCount',COUNT(*) FILTER(WHERE kind='refund'))`
export async function listAccountingPayments(db,{facilityId,query = {},exportLimit = null} = {}) {
  const scope=requireAdminFacilityScope({facilityId}),filters=accountingFilters(query,'payments'),params=[scope]
  const cte=paymentCte(filters,params),terms=[],bind=value=>{params.push(value);return `$${params.length}`}
  if(filters.from) terms.push(`(payment.occurred_at AT TIME ZONE payment.timezone)::date>=${bind(filters.from)}::date`)
  if(filters.through) terms.push(`(payment.occurred_at AT TIME ZONE payment.timezone)::date<=${bind(filters.through)}::date`)
  if(filters.kind!=='all') terms.push(`payment.kind=${bind(filters.kind)}`)
  if(filters.paymentStatus!=='all') terms.push(`CASE WHEN payment.settled THEN 'settled' WHEN payment.status IN ('failed','canceled','cancelled') THEN 'failed' ELSE 'pending' END=${bind(filters.paymentStatus)}`)
  if(filters.search) {const key=bind(`%${filters.search.replace(/[\\%_]/g,'\\$&')}%`);terms.push(`(payment.family_name ILIKE ${key} OR payment.reference ILIKE ${key} OR payment.id::text ILIKE ${key})`)}
  params.push(exportLimit ?? filters.pageSize,exportLimit ? 0 : (filters.page-1)*filters.pageSize)
  const result=await db.query(`${CTE}${cte}, filtered AS (SELECT payment.* FROM payment_values payment WHERE ${terms.join(' AND ')||'TRUE'}),
    page_rows AS (SELECT * FROM filtered ORDER BY ${PAYMENT_SORT[filters.sortBy]} ${filters.sortDir} NULLS LAST,kind,id ${filters.sortDir} LIMIT $${params.length-1} OFFSET $${params.length})
    SELECT (SELECT COUNT(*) FROM filtered)::bigint AS total,(SELECT ${PAYMENT_SUMMARY} FROM filtered) AS summary,
      (SELECT COALESCE(NULLIF(timezone,''),'America/New_York') FROM facility WHERE id=$1) AS timezone,COALESCE((SELECT jsonb_agg(page_rows) FROM page_rows),'[]'::jsonb) AS rows`,params)
  return wrapper(result.rows[0],filters)
}

export async function accountingLineDetail(db,{facilityId,id} = {}) {
  const params=[requireAdminFacilityScope({facilityId}),reportId(id,'bill')]
  const result=await db.query(`${CTE} SELECT row_to_json(line) AS line,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'paymentId',a.billing_payment_id,'chargeId',a.billing_charge_id,
      'kind',a.application_kind,'amountCents',a.amount_cents,'signedAmountCents',a.signed_cents,'allocatedAt',a.created_at,
      'paidAt',a.paid_at,'method',a.method,'paymentStatus',a.payment_status) ORDER BY a.created_at,a.id) FROM applications a WHERE a.owner_id=line.id),'[]'::jsonb) AS allocations,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',child.id,'description',child.description,'amountCents',child.amount_cents,'createdAt',child.created_at) ORDER BY child.created_at,child.id)
      FROM mapped child WHERE child.owner_id=line.id AND child.id<>line.id),'[]'::jsonb) AS adjustments,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',refund.id,'paymentId',refund.payment_id,'amountCents',refund.amount_cents,'refundedAt',refund.created_at,
      'status',refund.external_status,'ledgerTreatment',refund.ledger_treatment,'relatedChargeId',refund.related_charge_id) ORDER BY refund.created_at,refund.id)
      FROM account_refund_current refund WHERE refund.family_billing_account_id=line.account_id AND refund.related_charge_id IN(SELECT id FROM mapped WHERE owner_id=line.id)),'[]'::jsonb) AS refunds,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'sourceChargeId',credit_line.billing_charge_id,'targetChargeId',target_line.billing_charge_id,'amountCents',a.amount_cents,'appliedAt',a.created_at) ORDER BY a.created_at,a.id)
      FROM billing_charge_credit_application a JOIN billing_monthly_invoice_line credit_line ON credit_line.id=a.credit_invoice_line_id
      JOIN billing_monthly_invoice_line target_line ON target_line.id=a.target_invoice_line_id
      JOIN mapped source ON source.id=credit_line.billing_charge_id AND source.family_billing_account_id=line.account_id
      JOIN mapped target ON target.id=target_line.billing_charge_id AND target.family_billing_account_id=line.account_id
      WHERE source.owner_id=line.id OR target.owner_id=line.id),'[]'::jsonb) AS credit_applications
    FROM lines line WHERE line.id=$2`,params)
  const row=result.rows[0]
  if(!row) throw fail('Bill not found.',404)
  return {line:{...mapRow(row.line),currency:'usd'},allocations:row.allocations,adjustments:row.adjustments,refunds:row.refunds,creditApplications:row.credit_applications}
}

export async function accountingPaymentDetail(db,{facilityId,id,kind='payment'} = {}) {
  const params=[requireAdminFacilityScope({facilityId})],filters=accountingFilters({},'payments')
  const cte=paymentCte(filters,params)
  params.push(reportId(id,'payment'),choice(kind,['payment','refund'],'payment','payment kind'))
  const result=await db.query(`${CTE}${cte} SELECT row_to_json(payment) AS payment,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'paymentId',a.billing_payment_id,'chargeId',line.id,'kind',a.application_kind,
      'amountCents',a.amount_cents,'signedAmountCents',a.signed_cents,'allocatedAt',a.created_at,'paidAt',a.paid_at,'method',a.method,'paymentStatus',a.payment_status,
      'memberId',line.member_id,'memberName',line.member_name,'classId',line.class_id,'className',line.class_name,'description',line.description) ORDER BY a.created_at,a.id)
      FROM applications a JOIN lines line ON line.id=a.owner_id WHERE a.billing_payment_id=CASE WHEN payment.kind='payment' THEN payment.id ELSE payment.related_payment_id END),'[]'::jsonb) AS allocations,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',refund.id,'paymentId',refund.payment_id,'amountCents',refund.amount_cents,'refundedAt',refund.created_at,
      'status',refund.external_status,'ledgerTreatment',refund.ledger_treatment,'relatedChargeId',refund.related_charge_id) ORDER BY refund.created_at,refund.id)
      FROM account_refund_current refund WHERE refund.family_billing_account_id=payment.account_id AND refund.payment_id=CASE WHEN payment.kind='payment' THEN payment.id ELSE payment.related_payment_id END),'[]'::jsonb) AS refunds
    FROM payment_values payment WHERE payment.id=$2 AND payment.kind=$3`,params)
  const row=result.rows[0]
  if(!row) throw fail('Payment not found.',404)
  return {payment:{...mapRow(row.payment),currency:'usd'},allocations:row.allocations,refunds:row.refunds}
}

export async function accountingOptions(db,{facilityId,query={}} = {}) {
  const scope=requireAdminFacilityScope({facilityId}),search=String(query.q??'').trim().slice(0,100)
  const pattern=`%${search.replace(/[\\%_]/g,'\\$&')}%`
  const result=await db.query(`SELECT
    COALESCE((SELECT jsonb_agg(row) FROM (SELECT id,CONCAT_WS(' ',first_name,last_name) AS name FROM member
      WHERE facility_id=$1 AND CONCAT_WS(' ',first_name,last_name) ILIKE $2 ORDER BY last_name,first_name,id LIMIT 100) row),'[]'::jsonb) AS members,
    COALESCE((SELECT jsonb_agg(row) FROM (SELECT id,COALESCE(display_name,name) AS name FROM program
      WHERE facility_id=$1 AND COALESCE(display_name,name) ILIKE $2 ORDER BY name,id LIMIT 100) row),'[]'::jsonb) AS classes,
    (SELECT timezone FROM facility WHERE id=$1) AS timezone`,[scope,pattern])
  return {...result.rows[0],limit:100,currency:'usd'}
}
export function accountingCsvCell(value) {
  if(typeof value==='number' && Number.isFinite(value)) return String(value)
  let text=value==null?'':String(value)
  if(/^[\s\u0000-\u001f]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text)) text=`'${text}`
  return `"${text.replaceAll('"','""')}"`
}
export async function exportAccountingCsv(db,{facilityId,query={}}={}) {
  const view=choice(query.view,['lines','payments'],'lines','export view')
  const report=await(view==='lines'?listAccountingLines:listAccountingPayments)(db,{facilityId,query,exportLimit:ACCOUNTING_EXPORT_LIMIT+1})
  if(report.total>ACCOUNTING_EXPORT_LIMIT) throw fail(`Export exceeds ${ACCOUNTING_EXPORT_LIMIT.toLocaleString('en-US')} rows. Narrow the filters.`,409)
  const fields=view==='lines'
    ? [['id','Bill ID'],['billedDate','Posted date'],['familyName','Household'],['memberName','Person'],['className','Class'],['description','Description'],['status','Status'],['originalCents','Original (USD)'],['adjustmentCents','Adjustments (USD)'],['amountCents','Billed (USD)'],['paidCents','Paid (USD)'],['creditAppliedCents','Credit applied (USD)'],['openCents','Open (USD)'],['lastPaidDate','Last receipt date'],['servicePeriodStart','Service starts'],['servicePeriodEnd','Service ends']]
    : [['kind','Entry type'],['id','Entry ID'],['occurredDate','Payment / refund recorded date'],['familyName','Household'],['method','Method'],['status','Status'],['amountCents','Full receipt / refund (USD)'],['signedAmountCents','Signed cash (USD)'],['appliedCents','Net allocated (USD)'],['filteredAppliedCents','Matching allocation (USD)'],['unappliedCents','Unapplied (USD)'],['relatedPaymentId','Original payment ID'],['reference','Reference']]
  const cell=(row,key)=>key.endsWith('Cents') && row[key]!=null ? (Number(row[key])/100).toFixed(2) : accountingCsvCell(row[key])
  return {csv:[fields.map(([,label])=>accountingCsvCell(label)).join(','),...report.rows.map(row=>fields.map(([key])=>cell(row,key)).join(','))].join('\r\n')+'\r\n',view,total:report.total}
}
