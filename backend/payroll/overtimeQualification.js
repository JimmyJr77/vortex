import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {paidOvertimeReview} from './overtimeSource.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
function fingerprint(row){return createHash('sha256').update(JSON.stringify(compensationEvidence({version:1,facilityId:row.facility_id,runEmployeeId:row.id,employeeId:row.employee_id,runId:row.run_id,runKind:row.run_kind,paymentDate:new Date(row.payment_date).toISOString().slice(0,10),regular:String(row.regular_pay_cents),overtime:String(row.overtime_pay_cents),other:String(row.other_taxable_pay_cents),calculation:row.calculation_snapshot,statement:row.statement_snapshot}))).digest('hex')}
export function overtimeQualificationState(row){
 const source=paidOvertimeReview(row),sourceFingerprint=fingerprint(row),review=row.qualification_review
 const amount=review?Number(review.qualified_premium_cents):null
 const current=source.paidPremiumCents!==null&&review&&Number(review.facility_id)===Number(row.facility_id)&&Number(review.run_employee_id)===Number(row.id)&&review.source_fingerprint===sourceFingerprint&&Number.isSafeInteger(amount)&&amount>=0&&amount<=source.paidPremiumCents&&['FLSA_REQUIRED','NOT_FLSA_REQUIRED'].includes(review.flsa_status)&&(review.flsa_status!=='NOT_FLSA_REQUIRED'||amount===0)
 return {...source,sourceFingerprint,reviewId:review?Number(review.id):0,qualifiedPremiumCents:current?amount:null,qualificationStatus:current?'REVIEWED':review?'STALE_REVIEW':'REVIEW_REQUIRED',qualificationHistory:(row.qualification_history||[]).map(h=>({id:Number(h.id),flsaStatus:h.flsa_status,qualifiedPremiumCents:String(h.qualified_premium_cents),reference:h.reference,reviewedBy:h.created_by,reviewedAt:h.created_at,status:h.source_fingerprint!==sourceFingerprint?'STALE':Number(h.id)===Number(review?.id)?current?'CURRENT':'STALE':'SUPERSEDED'})),qualificationReview:review?{id:Number(review.id),flsaStatus:review.flsa_status,reference:review.reference,reviewedBy:review.created_by,reviewedAt:review.created_at}:null}
}
export function registerOvertimeQualificationRoutes(app,pool){
 app.post('/api/admin/payroll/runs/:runId/employees/:employeeId/overtime-qualification',async(req,res)=>{
  const db=await pool.connect()
  try{
   await db.query('BEGIN')
   if(!/^[1-9]\d*$/.test(req.params.runId)||!/^[1-9]\d*$/.test(req.params.employeeId))throw fail('Choose a valid payroll employee.')
   const row=(await db.query(`SELECT re.*,r.facility_id,r.run_kind,r.id AS run_id,r.calculation_snapshot,COALESCE(r.payment_date,p.pay_date) AS payment_date FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_employee e ON e.id=re.employee_id AND e.facility_id=r.facility_id WHERE r.facility_id=$1 AND r.id=$2 AND re.employee_id=$3 AND r.status='FINALIZED' AND COALESCE(r.payment_date,p.pay_date)>='2026-01-01' AND COALESCE(r.payment_date,p.pay_date)<'2027-01-01' FOR UPDATE OF r,re`,[req.canonicalAccess.facilityId,req.params.runId,req.params.employeeId])).rows[0]
   if(!row)throw fail('Finalized 2026 employee payroll not found.',404)
   const prior=(await db.query('SELECT * FROM payroll_overtime_qualification WHERE facility_id=$1 AND run_employee_id=$2 ORDER BY id DESC LIMIT 1',[row.facility_id,row.id])).rows[0]
   const state=overtimeQualificationState({...row,qualification_review:prior}),b=req.body||{},reference=typeof b.reference==='string'?b.reference.trim():''
   if(state.paidPremiumCents===null||b.sourceFingerprint!==state.sourceFingerprint)throw fail('Payroll premium evidence changed or needs reconciliation. Refresh the overtime source review.',409)
   if(b.confirmed!==true||!Number.isSafeInteger(b.expectedReviewId)||b.expectedReviewId<0||!Number.isSafeInteger(b.qualifiedPremiumCents)||b.qualifiedPremiumCents<0||b.qualifiedPremiumCents>state.paidPremiumCents||!['FLSA_REQUIRED','NOT_FLSA_REQUIRED'].includes(b.flsaStatus)||(b.flsaStatus==='NOT_FLSA_REQUIRED'&&b.qualifiedPremiumCents!==0)||reference.length<12||reference.length>2000)throw fail('Confirm the reviewed FLSA status, qualified premium within paid premium and a detailed source reference.')
   if(prior&&prior.source_fingerprint===b.sourceFingerprint&&Number(prior.qualified_premium_cents)===b.qualifiedPremiumCents&&prior.flsa_status===b.flsaStatus&&prior.reference===reference){await db.query('COMMIT');return res.json({success:true,data:{id:Number(prior.id),reused:true}})}
   if(b.expectedReviewId!==Number(prior?.id||0))throw fail('The qualification review changed. Refresh before saving.',409)
   const saved=(await db.query('INSERT INTO payroll_overtime_qualification(facility_id,run_employee_id,source_fingerprint,qualified_premium_cents,flsa_status,reference,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[row.facility_id,row.id,state.sourceFingerprint,b.qualifiedPremiumCents,b.flsaStatus,reference,req.adminId])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'OVERTIME_QUALIFICATION_REVIEWED','overtime_qualification',$3,$4)",[row.facility_id,req.adminId,String(saved.id),{runEmployeeId:Number(row.id),sourceFingerprint:state.sourceFingerprint}])
   await db.query('COMMIT');res.status(201).json({success:true,data:{id:Number(saved.id),reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to save overtime qualification.'})}finally{db.release()}
 })
}
