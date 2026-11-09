import { id, inputError, pagination, pageResult } from './common.js'

export async function jackrabbitHistory(db, facilityId, query = {}) {
  const paging = pagination(query)
  const familyId = query.familyId ? id(query.familyId, 'family') : null
  if(familyId && !(await db.query('SELECT id FROM family WHERE id=$1 AND facility_id=$2',[familyId,facilityId])).rows.length)throw inputError('Family not found.',404)
  const memberId = query.memberId ? id(query.memberId, 'member') : null
  if (memberId) {
    const member = await db.query('SELECT id FROM member WHERE id=$1 AND facility_id=$2', [memberId, facilityId])
    if (!member.rows.length) throw inputError('Member not found.', 404)
  }
  const values = [id(facilityId), memberId, query.from || null, query.through || null, familyId]
  for (const value of values.slice(2,4)) if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value)) throw inputError('Invalid history date.')
  if(values[2]&&values[3]&&values[2]>values[3])throw inputError('History start must precede end date.')
  const where = `source='jackrabbit' AND NOT deleted AND facility_id=$1 AND ($2::bigint IS NULL OR member_id=$2 OR
    (record_kind='transaction' AND member_id IS NULL AND family_id IN
      (SELECT family_id FROM family_member WHERE member_id=$2 AND is_active=TRUE)))
    AND ($3::date IS NULL OR occurred_on >= $3) AND ($4::date IS NULL OR occurred_on <= $4)
    AND ($5::bigint IS NULL OR family_id=$5)`
  const [summary, records] = await Promise.all([
    db.query(`SELECT COUNT(*) FILTER(WHERE record_kind='transaction')::int AS transactions,
      COUNT(*) FILTER(WHERE record_kind='enrollment')::int AS enrollments,
      COALESCE(-SUM(amount_cents) FILTER(WHERE record_kind='transaction' AND source_data->>'Type'='Payment'),0)::bigint AS receipts,
      COALESCE(SUM(amount_cents) FILTER(WHERE record_kind='transaction' AND source_data->>'Type' LIKE 'Refund -%'),0)::bigint AS refunds,
      COUNT(*) FILTER(WHERE record_kind='enrollment' AND member_id IS NULL)::int AS unresolved
      FROM account_record_source WHERE ${where}`, values),
    db.query(`SELECT *,imported_record_id AS id,COUNT(*) OVER()::int AS total FROM account_record_source WHERE ${where}
      AND record_kind IN ('transaction','enrollment','person','family','note','attendance')
      ORDER BY occurred_on DESC NULLS LAST,imported_record_id DESC LIMIT $6 OFFSET $7`, [...values,paging.pageSize,paging.offset]),
  ])
  const s = summary.rows[0]
  return { summary: {transactions:s.transactions,enrollments:s.enrollments,receiptsCents:Number(s.receipts),refundsCents:Number(s.refunds),netCashCents:Number(s.receipts)-Number(s.refunds),unresolved:s.unresolved},
    ...pageResult(records.rows.map(r=>({id:Number(r.id),kind:r.record_kind,sourceId:r.source_id,familyId:r.family_id==null?null:Number(r.family_id),memberId:r.member_id==null?null:Number(r.member_id),date:r.occurred_on,amountCents:r.amount_cents==null?null:Number(r.amount_cents),data:r.source_data})),records.rows[0]?.total||0,paging) }
}
