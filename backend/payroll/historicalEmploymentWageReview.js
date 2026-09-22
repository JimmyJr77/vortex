import {historicalAnnualTotals} from './historicalAnnualPaymentDetail.js'
import {createHash,randomUUID} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {historicalEmploymentWageSource,historicalEmploymentWageReview} from './historicalEmploymentTaxWages.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(JSON.stringify(compensationEvidence(value))).digest('hex')
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)

export async function historicalEmploymentWageState(db,facilityId,employeeId,paymentDate){
 // Validate identities and dates before they reach PostgreSQL casts.
 historicalEmploymentWageSource([],{facilityId,employeeId,paymentDate})
 const employee=(await db.query('SELECT id,legal_first_name,legal_last_name FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facilityId,employeeId])).rows[0]
 if(!employee)throw fail('Employee not found.',404)
 const payments=(await db.query("SELECT * FROM payroll_historical_payment WHERE facility_id=$1 AND employee_id=$2 AND payment_date BETWEEN '2026-01-01'::date AND $3::date ORDER BY payment_date,id",[facilityId,employeeId,paymentDate])).rows
 const source=historicalEmploymentWageSource(payments,{facilityId,employeeId,paymentDate})
 const history=(await db.query('SELECT id,revision,source_fingerprint,source,review,created_at FROM payroll_historical_employment_wage_review WHERE facility_id=$1 AND employee_id=$2 AND tax_year=2026 ORDER BY revision DESC',[facilityId,employeeId])).rows
 const current=history[0]||null
 return {employee,source,history,current,status:!payments.length?'NO_IMPORTED_PAYMENTS':!current?'NEEDS_REVIEW':current.source_fingerprint!==source.fingerprint?'STALE':current.review.disposition}
}

export async function requireHistoricalEmploymentWages(db,facilityId,employeeId,paymentDate){
 const state=await historicalEmploymentWageState(db,facilityId,employeeId,paymentDate)
 if(state.status==='NO_IMPORTED_PAYMENTS')return []
 if(state.status!=='REVIEWED')throw fail('Review separate employment taxable-wage opening balances for imported payroll before approval.')
 const review=historicalEmploymentWageReview(state.source,state.current.review)
 return review.payments.map(payment=>({...payment,kind:'IMPORTED',employeeId:String(employeeId),reviewId:state.current.id,sourceFingerprint:state.source.fingerprint,reviewFingerprint:hash({id:state.current.id,review})}))
}

export async function historicalAnnualWageState(db,facilityId,employeeId,{start='2026-01-01',end='2026-12-31'}={}){
 const state=await historicalEmploymentWageState(db,facilityId,employeeId,'2026-12-31')
 if(state.status==='NO_IMPORTED_PAYMENTS')return {status:state.status,totals:null,reviewId:null,sourceFingerprint:state.source.fingerprint,issues:[]}
 const proof={reviewId:state.current?.id||null,sourceFingerprint:state.source.fingerprint}
 if(state.status!=='REVIEWED')return {...proof,status:state.status,totals:null,issues:['Imported payments need a current resolved employment wage review.']}
 try{
  const review=historicalEmploymentWageReview(state.source,state.current.review)
  historicalAnnualTotals(review.payments)
  const selected=review.payments.filter(p=>p.paymentDate>=start&&p.paymentDate<=end)
  return {...proof,status:'REVIEWED',totals:historicalAnnualTotals(selected),paymentCount:selected.length,issues:[]}
 }catch(error){if(error.status!==409)throw error;return {...proof,status:'NEEDS_ANNUAL_DETAIL',totals:null,issues:[error.message]}}
}

export function registerHistoricalEmploymentWageReview(app,pool){
 const path='/api/admin/payroll/employees/:employeeId/historical-employment-wages'
 const endpoint=(write,work)=>async(req,res)=>{
  res.setHeader('Cache-Control','no-store');let db
  try{
   db=await pool.connect();await db.query(write?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
   if(write)await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])
   const data=await work(db,req);await db.query('COMMIT');res.json({success:true,data})
  }catch(error){await db?.query('ROLLBACK').catch(()=>{});res.status(error.status||500).json({success:false,message:error.status?error.message:'Unable to retain imported taxable-wage review.'})}finally{db?.release()}
 }
 app.get(path,endpoint(false,(db,req)=>historicalEmploymentWageState(db,req.canonicalAccess.facilityId,req.params.employeeId,req.query.paymentDate)))
 app.post(path,endpoint(true,async(db,req)=>{
  const body=req.body||{},facilityId=req.canonicalAccess.facilityId,employeeId=req.params.employeeId
  if(!uuid(body.requestKey)||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)throw fail('Use a valid review request key and current revision.',400)
  const requestFingerprint=hash({employeeId,body:{...body,requestKey:undefined}})
  const previous=(await db.query('SELECT id,request_fingerprint FROM payroll_historical_employment_wage_review WHERE facility_id=$1 AND request_key=$2',[facilityId,body.requestKey])).rows[0]
  if(previous){if(previous.request_fingerprint!==requestFingerprint)throw fail('This request key belongs to a different imported-wage review.');return {id:previous.id,reused:true}}
  const state=await historicalEmploymentWageState(db,facilityId,employeeId,body.paymentDate)
  if((state.current?.revision||0)!==body.expectedRevision)throw fail('Another imported-wage review was saved. Refresh before continuing.')
  const review=historicalEmploymentWageReview(state.source,body),reviewId=randomUUID()
  await db.query('INSERT INTO payroll_historical_employment_wage_review(id,facility_id,employee_id,tax_year,revision,source_fingerprint,source,review,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,2026,$4,$5,$6,$7,$8,$9,$10)',[reviewId,facilityId,employeeId,body.expectedRevision+1,state.source.fingerprint,state.source,review,body.requestKey,requestFingerprint,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'HISTORICAL_EMPLOYMENT_WAGES_REVIEWED','historical_employment_wage_review',$3,$4)",[facilityId,req.adminId,reviewId,{employeeId,sourceFingerprint:state.source.fingerprint,review}])
  return {id:reviewId,reused:false}
 }))
}
