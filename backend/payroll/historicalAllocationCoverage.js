import {previewHistoricalAllocation} from './historicalAllocationPreview.js'

// Revalidate every week of the original import, including weeks outside the
// current payroll period, before any portion can supply paid coverage.
export async function revalidateHistoricalAllocationCoverage(db,facility,reviews,loadEvidence,paymentDate){
 const imports=[...new Set(reviews.flatMap(r=>(r.historicalPayments||[]).map(p=>Number(p.id))))]
 if(!imports.length)return
 const payments=(await db.query('SELECT * FROM payroll_historical_payment WHERE facility_id=$1 AND id=ANY($2::bigint[])',[facility,imports])).rows
 const records=(await db.query(`SELECT DISTINCT ON(after_data->'input'->>'paymentId') id,entity_id,after_data FROM payroll_audit_log
 WHERE facility_id=$1 AND entity_type='employee' AND action='HISTORICAL_ALLOCATION_REVIEWED' AND after_data->'input'->>'paymentId'=ANY($2::text[])
 ORDER BY after_data->'input'->>'paymentId',id DESC`,[facility,imports.map(String)])).rows
 const today=(await db.query('SELECT (now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]?.today
 const cache=new Map()
 for(const id of imports){
  const payment=payments.find(p=>Number(p.id)===id),record=records.find(r=>Number(r.after_data.input.paymentId)===id)
  let state={status:'MISSING',issues:['Retain the imported wage allocation and source confirmation.']}
  if(record){
   state={status:'STALE',reviewId:Number(record.id),issues:[]}
   try{
    const saved=record.after_data.result,input=record.after_data.input
    if(!payment||String(payment.employee_id)!==String(record.entity_id)||saved.version!==1||saved.sourceConfirmed!==true||input.sourceConfirmed!==true||input.confirmed!==true)throw new Error('Imported source review is incomplete or no longer matches its employee.')
    if(!cache.has(input.payPeriodId))cache.set(input.payPeriodId,await loadEvidence(input.payPeriodId))
    const data=cache.get(input.payPeriodId)
    if(!data)throw new Error('The imported allocation review period is no longer available.')
    const current=previewHistoricalAllocation(payment,data.preview.employees.find(e=>Number(e.employeeId)===Number(payment.employee_id))?.employmentWeekReviews||[],data.period,today)
    if(paymentDate&&current.source.paymentDate>paymentDate)throw new Error('Imported wages were paid after the selected payroll payment date. Review payment chronology before settlement.')
    if(current.fingerprint!==saved.fingerprint||current.fingerprint!==input.fingerprint)throw new Error('Imported source or workweek evidence changed. Recalculate and retain a new imported allocation.')
    state={status:'CURRENT',reviewId:Number(record.id),fingerprint:current.fingerprint,weeks:current.weeks,source:current.source,issues:[]}
   }catch(error){state.issues.push(error.message)}
  }
  for(const review of reviews)for(const p of review.historicalPayments||[])if(Number(p.id)===id)p.allocationReview=state
 }
}
