import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
const fail=message=>Object.assign(new Error(message),{status:409})
const day=value=>new Date(value).toISOString().slice(0,10)
const next=value=>new Date(Date.parse(value+'T00:00:00Z')+7*86400000).toISOString().slice(0,10)
const safe=n=>Number.isSafeInteger(n)&&n>=0

export function previewHistoricalAllocation(payment,reviews,period,today){
 const source={id:Number(payment.id),employeeId:Number(payment.employee_id),periodStart:day(payment.period_start),periodEnd:day(payment.period_end),paymentDate:day(payment.payment_date),grossCents:Number(payment.gross_amount_cents),taxCents:Number(payment.employee_tax_withheld_cents),netCents:Number(payment.net_amount_cents),method:payment.method,reference:payment.reference,evidence:payment.evidence_note,source:payment.source}
 if(![source.grossCents,source.taxCents,source.netCents].every(safe)||!source.grossCents||BigInt(source.taxCents)+BigInt(source.netCents)!==BigInt(source.grossCents))throw fail('This payment needs a supported gross, tax and net wage breakdown before allocating its workweeks.')
 if(source.periodStart>source.periodEnd||source.periodEnd>source.paymentDate||source.paymentDate>today)throw fail('Review the imported work and actual payment dates before allocating earnings.')
 if(day(period.period_start)>source.periodStart||day(period.period_end)<source.periodEnd)throw fail('Choose a payroll review period covering the complete imported work period.')
 const selected=reviews.filter(r=>r.employeeId===source.employeeId&&r.week<=source.periodEnd&&r.end>=source.periodStart).sort((a,b)=>a.week.localeCompare(b.week))
 if(!selected.length||selected[0].week>source.periodStart||selected.at(-1).end<source.periodEnd||selected.some((r,i)=>i&&r.week!==next(selected[i-1].week)))throw fail('Review every workweek touched by this imported payment before allocating it.')
 const weeks=[],keys=new Set()
 let total=0n
 for(const review of selected){
  const allocation=review.allocationReview
  if(review.end>=today||allocation?.status!=='CURRENT'||allocation.coverage?.version!==1)throw fail('Each imported workweek needs a closed, current retained allocation with dated coverage.')
  if(review.payments.some(p=>p.runKind!=='OFF_CYCLE_REIMBURSEMENT'&&p.periodStart<=source.periodEnd&&p.periodEnd>=source.periodStart))throw fail('Native payroll already overlaps the imported work period. Resolve duplicate payment evidence first.')
  if(review.historicalPayments.some(p=>Number(p.id)!==source.id&&p.periodStart<=source.periodEnd&&p.periodEnd>=source.periodStart))throw fail('Another imported payment overlaps this work period. Reconcile the existing records first.')
  const entries=allocation.coverage.entries.filter(e=>e.workDate>=source.periodStart&&e.workDate<=source.periodEnd)
  for(const entry of entries){const key=`${entry.id}/${entry.workDate}`;if(keys.has(key))throw fail('Imported workweek coverage repeats a dated time segment.');keys.add(key)}
  const sum=field=>{const n=entries.reduce((n,e)=>{if(!safe(e[field]))throw fail('Imported coverage contains invalid hours or cents.');return n+BigInt(e[field])},0n);if(n>BigInt(Number.MAX_SAFE_INTEGER))throw fail('Imported coverage exceeds safe precision.');return Number(n)}
  const straightTimePayCents=sum('straightTimePayCents'),premiumCents=sum('premiumCents');total+=BigInt(straightTimePayCents)+BigInt(premiumCents)
  weeks.push({week:review.week,allocationReviewId:allocation.id,allocationFingerprint:allocation.fingerprint,workedMinutes:sum('minutes'),straightTimePayCents,premiumCents,coverage:{...allocation.coverage,entries}})
 }
 if(total!==BigInt(source.grossCents))throw fail('The dated earnings and premiums do not equal the imported gross payment. Reconcile the payment breakdown or allocation first.')
 const fingerprint=createHash('sha256').update(JSON.stringify(compensationEvidence({version:1,source,weeks}))).digest('hex')
 return {version:1,status:'DRAFT_IMPORTED_ALLOCATION',source,weeks,fingerprint,paymentApplied:false,requiresSourceConfirmation:true,reviewRequired:'Confirm wage-only source evidence and retain this allocation before using it as paid coverage. No historical record or payroll payment has changed.'}
}

export function registerHistoricalAllocationPreviewRoutes(app,pool,loadPreview){
 app.post('/api/admin/payroll/employees/:id/historical-payments/:paymentId/allocation-preview',async(req,res)=>{
  let db
  try{
   const facility=req.canonicalAccess.facilityId,periodId=Number(req.body?.payPeriodId)
   if(!Number.isSafeInteger(periodId)||periodId<=0)return res.status(400).json({success:false,message:'Choose the payroll period containing the imported work.'})
   db=await pool.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
   const payment=(await db.query('SELECT * FROM payroll_historical_payment WHERE facility_id=$1 AND employee_id=$2 AND id=$3',[facility,req.params.id,req.params.paymentId])).rows[0]
   if(!payment){await db.query('ROLLBACK');return res.status(404).json({success:false,message:'Historical payment not found.'})}
   const data=await loadPreview(db,facility,periodId)
   if(!data){await db.query('ROLLBACK');return res.status(404).json({success:false,message:'Payroll period not found.'})}
   const today=(await db.query('SELECT (now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0].today
   const reviews=data.preview.employees.find(e=>Number(e.employeeId)===Number(payment.employee_id))?.employmentWeekReviews||[]
   const result=previewHistoricalAllocation(payment,reviews,data.period,today)
   await db.query('COMMIT');res.json({success:true,data:result})
  }catch(error){if(db)await db.query('ROLLBACK');res.status(error.status||500).json({success:false,message:error.status?error.message:'Unable to preview imported payment allocation.'})}finally{db?.release()}
 })
}
