import {createHash,randomUUID} from 'node:crypto'
import {benefitsReviewCurrent} from './benefitsReview.js'
import {compensationEvidence} from './employmentCompensation.js'
import {carrierContributions} from './carrierContributionMatching.js'
const fingerprint=value=>createHash('sha256').update(JSON.stringify(compensationEvidence(value))).digest('hex')
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const enrolled=review=>['ENROLLED','ENROLLED_EMPLOYER_FUNDED'].includes(review?.disposition)
const validDay=value=>typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
export function benefitCoverageMonth(month){
 if(typeof month!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw fail('Choose a valid coverage month.')
 return {start:`${month}-01`,end:new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10)}
}
// Enrollment decisions are independent of wages. Retained effective-dated
// decisions describe the review basis; they never assert carrier billing/payment.
export function benefitCoverageCandidates(records,month){
 const {start,end}=benefitCoverageMonth(month),employees=new Map(),result=[]
 for(const row of records){
  const task=row.snapshot,response=task?.response,review=response?.benefitsReview,election=response?.benefitsElection,basis=response?.paySetup?.basis
  if(task?.status!=='COMPLETE'||!validDay(review?.effectiveOn)||review.effectiveOn>end)continue
  if(!benefitsReviewCurrent(review,basis?.benefitsPolicy??review.policyTerms,end,election,basis?.benefitPlans??election?.catalogSnapshot??[]))continue
  const key=JSON.stringify([String(row.employee_id),Number(row.onboarding_cycle)]),group=employees.get(key)||{employeeId:String(row.employee_id),onboardingCycle:Number(row.onboarding_cycle),employeeName:row.employee_name,employmentStatus:row.employment_status,decisions:new Map()}
  // Database history is ordered oldest first; later reviews replace the same
  // effective-date decision without discarding the underlying audit history.
  group.decisions.set(review.effectiveOn,{effectiveOn:review.effectiveOn,disposition:review.disposition,review,election})
  employees.set(key,group)
 }
 for(const group of employees.values()){
  const all=[...group.decisions.values()].sort((a,b)=>a.effectiveOn.localeCompare(b.effectiveOn)),opening=all.filter(row=>row.effectiveOn<=start).at(-1),decisions=[...(opening?[opening]:[]),...all.filter(row=>row.effectiveOn>start)]
  const plans=new Map()
  for(const decision of decisions)if(enrolled(decision))for(const item of decision.election?.selections||[])if(item.optionId!=='WAIVE')plans.set(item.planId,item.planName)
  for(const [planId,planName] of plans){
   const evidence=decisions.map(row=>({effectiveOn:row.effectiveOn,disposition:row.disposition,electionId:row.election?.submissionId||null,review:row.review,selection:row.election?.selections?.find(item=>item.planId===planId)||null}))
   const source={employeeId:group.employeeId,onboardingCycle:group.onboardingCycle,planId,planName,month,employmentStatus:group.employmentStatus,decisions:evidence}
   result.push({...source,employeeName:group.employeeName,sourceFingerprint:fingerprint(source)})
  }
 }
 return result.sort((a,b)=>a.employeeId.localeCompare(b.employeeId)||a.onboardingCycle-b.onboardingCycle||a.planId.localeCompare(b.planId))
}
export async function benefitCoverageLedger(db,facility,month,{contributions:providedContributions}={}){
 const {start,end}=benefitCoverageMonth(month)
 const records=(await db.query("SELECT r.employee_id,r.onboarding_cycle,r.snapshot,e.legal_first_name||' '||e.legal_last_name AS employee_name,e.employment_status FROM payroll_onboarding_revision r JOIN payroll_employee e ON e.id=r.employee_id AND e.facility_id=r.facility_id WHERE r.facility_id=$1 AND r.snapshot->>'task_key'='PAY_REVIEW' ORDER BY r.id",[facility])).rows
 const candidates=benefitCoverageCandidates(records,month),contributions=providedContributions||await carrierContributions(db,facility,start,end)
 const payrolls=(await db.query("SELECT re.employee_id,r.id,COALESCE(r.payment_date,p.pay_date)::text AS payment_date FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee re ON re.payroll_run_id=r.id WHERE r.facility_id=$1 AND r.status='FINALIZED' AND COALESCE(r.payment_date,p.pay_date) BETWEEN $2::date AND $3::date ORDER BY r.id",[facility,start,end])).rows
 const reviews=(await db.query('SELECT * FROM payroll_benefit_coverage_review WHERE facility_id=$1 AND coverage_month=$2 ORDER BY revision DESC,id DESC',[facility,month])).rows.map(row=>({...row,created_at:new Date(row.created_at).toISOString()}))
 const rows=candidates.map(source=>{
  const history=reviews.filter(row=>String(row.employee_id)===source.employeeId&&row.onboarding_cycle===source.onboardingCycle&&row.plan_id===source.planId),current=history[0]||null
  const paid=payrolls.filter(row=>String(row.employee_id)===source.employeeId).map(row=>({runId:Number(row.id),paymentDate:row.payment_date})),collected=contributions.filter(row=>row.employeeId===source.employeeId&&row.planId===source.planId)
  return {...source,payrolls:paid,contributions:collected,employeeCollectedCents:collected.reduce((sum,row)=>sum+row.amountCents,0),status:!current?'NEEDS_REVIEW':current.source_fingerprint!==source.sourceFingerprint?'STALE':current.review.disposition==='RETRACTED'?'NEEDS_REVIEW':'REVIEWED',current,history}
 })
 // A changed enrollment can remove an old candidate. Keep its retained monthly
 // evidence visible and explicitly stale instead of silently dropping it.
 for(const saved of reviews)if(!rows.some(row=>row.employeeId===String(saved.employee_id)&&row.onboardingCycle===saved.onboarding_cycle&&row.planId===saved.plan_id)){
  const history=reviews.filter(row=>row.employee_id===saved.employee_id&&row.onboarding_cycle===saved.onboarding_cycle&&row.plan_id===saved.plan_id)
  const paid=payrolls.filter(row=>String(row.employee_id)===String(saved.employee_id)).map(row=>({runId:Number(row.id),paymentDate:row.payment_date})),collected=contributions.filter(row=>row.employeeId===String(saved.employee_id)&&row.planId===saved.plan_id)
  rows.push({...saved.source_snapshot,sourceFingerprint:null,payrolls:paid,contributions:collected,employeeCollectedCents:collected.reduce((sum,row)=>sum+row.amountCents,0),status:history[0].review.disposition==='RETRACTED'?'RETRACTED':'SOURCE_CHANGED',current:history[0],history})
 }
 return {month,rows}
}
export function registerBenefitCoverageLedger(app,pool){
 const base='/api/admin/payroll/benefit-coverage'
 const endpoint=(write,work)=>async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{await db.query(write?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');if(write)await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId]);const data=await work(db,req);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to reconcile monthly benefit coverage.'})}finally{db.release()}}
 app.get(base,endpoint(false,(db,req)=>benefitCoverageLedger(db,req.canonicalAccess.facilityId,req.query.month)))
 app.post(base,endpoint(true,async(db,req)=>{
  const b=req.body||{},facility=req.canonicalAccess.facilityId,{start,end}=benefitCoverageMonth(b.month)
  if(!['COVERED','NOT_COVERED','RETRACTED'].includes(b.disposition)||b.confirmed!==true||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||!Number.isSafeInteger(b.onboardingCycle)||b.onboardingCycle<1||!/^\d+$/.test(String(b.employeeId))||typeof b.planId!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(b.planId)||typeof b.requestKey!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(b.requestKey))throw fail('Confirm the current employee, coverage decision and revision.')
  for(const [key,min,max] of [['carrier',2,200],['reference',12,2000]])if(typeof b[key]!=='string'||b[key].trim().length<min||b[key].length>max||/[\u0000-\u001f\u007f]/.test(b[key]))throw fail('Enter the carrier and its coverage verification reference.')
  if(b.disposition==='COVERED'&&(!validDay(b.coverageStart)||!validDay(b.coverageEnd)||b.coverageStart<start||b.coverageEnd>end||b.coverageEnd<b.coverageStart))throw fail('Enter the actual covered dates within this month.')
  const review={disposition:b.disposition,carrier:b.carrier.trim(),reference:b.reference.trim(),coverageStart:b.disposition==='COVERED'?b.coverageStart:null,coverageEnd:b.disposition==='COVERED'?b.coverageEnd:null}
  const digest=fingerprint({employeeId:String(b.employeeId),cycle:b.onboardingCycle,planId:b.planId,month:b.month,sourceFingerprint:b.sourceFingerprint,expectedRevision:b.expectedRevision,review})
  const old=(await db.query('SELECT id,request_fingerprint FROM payroll_benefit_coverage_review WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
  if(old){if(old.request_fingerprint!==digest)throw fail('This coverage request was already used for different evidence.',409);return {id:old.id,reused:true}}
  const ledger=await benefitCoverageLedger(db,facility,b.month),source=ledger.rows.find(row=>row.employeeId===String(b.employeeId)&&row.onboardingCycle===b.onboardingCycle&&row.planId===b.planId)
  if(!source)throw fail('Retained employee coverage evidence was not found.',404)
  if((source.current?.revision||0)!==b.expectedRevision)throw fail('Another coverage review was saved. Reload the current revision.',409)
  if(b.disposition!=='RETRACTED'&&(!source.sourceFingerprint||source.sourceFingerprint!==b.sourceFingerprint))throw fail('Enrollment evidence changed. Review the current hiring benefits decision before saving.',409)
  if(b.disposition==='RETRACTED'&&(!source.current||source.current.review.disposition==='RETRACTED'))throw fail('Only a retained coverage review can be retracted.',409)
  const id=randomUUID(),snapshot={employeeId:source.employeeId,employeeName:source.employeeName,onboardingCycle:source.onboardingCycle,planId:source.planId,planName:source.planName,month:source.month,employmentStatus:source.employmentStatus,decisions:source.decisions}
  await db.query('INSERT INTO payroll_benefit_coverage_review(id,facility_id,employee_id,onboarding_cycle,plan_id,coverage_month,revision,source_fingerprint,source_snapshot,review,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[id,facility,b.employeeId,b.onboardingCycle,b.planId,b.month,b.expectedRevision+1,source.sourceFingerprint||source.current.source_fingerprint,snapshot,review,b.requestKey,digest,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'BENEFIT_COVERAGE_REVIEWED','benefit_coverage_review',$3,$4)",[facility,req.adminId,id,{month:b.month,employeeId:String(b.employeeId),planId:b.planId,disposition:b.disposition}])
  return {id,reused:false}
 }))
}
