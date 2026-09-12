import {createHash,randomUUID} from 'node:crypto'
import {payrollEmployeeAuth,lockPayrollEmployeeSession} from './employeeAuth.js'
import {effectiveScheduleSettings} from './payCalendar.js'
import {marylandElectionFingerprint} from './marylandElectionFingerprint.js'
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value
const hash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)
const day=value=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10)
async function source(db,facility,employeeId,effectiveOn){
 const employee=(await db.query('SELECT * FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,employeeId])).rows[0]
 if(!employee)throw fail('Employee not found.',404)
 const settings=(await db.query('SELECT *, (clock_timestamp() AT TIME ZONE timezone)::date AS today FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]
 if(typeof effectiveOn!=='string'||!/^2026-\d{2}-\d{2}$/.test(effectiveOn)||!Number.isFinite(Date.parse(effectiveOn))||day(new Date(effectiveOn))!==effectiveOn||effectiveOn<day(settings.today))throw fail('Choose a valid current or future 2026 effective date.')
 if(!['ONBOARDING','ACTIVE','LEAVE'].includes(employee.employment_status)||employee.work_state!=='MD'||employee.residence_state!=='MD'||employee.w4_status!=='COMPLETE'||employee.state_withholding_status!=='COMPLETE')throw fail('Review current employment and completed Maryland tax forms before proposing this agreement.')
 const election=(await db.query('SELECT elections FROM payroll_tax_election WHERE facility_id=$1 AND employee_id=$2 AND tax_year=2026',[facility,employeeId])).rows[0]?.elections?.maryland
 if(!election||election.exempt||!Number.isSafeInteger(election.extraWithholdingCents)||election.extraWithholdingCents<0)throw fail('Review the saved nonexempt Maryland additional-withholding amount.')
 const schedule=await effectiveScheduleSettings(db,facility,settings,effectiveOn)
 if(!['WEEKLY','BIWEEKLY','SEMIMONTHLY','MONTHLY'].includes(schedule.pay_frequency))throw fail('Review a supported pay frequency.')
 const latest=(await db.query('SELECT revision,effective_on FROM payroll_maryland_additional_agreement WHERE facility_id=$1 AND employee_id=$2 ORDER BY revision DESC LIMIT 1',[facility,employeeId])).rows[0]
 if(latest&&effectiveOn<day(latest.effective_on))throw fail('The proposed date precedes retained agreement history.')
 const committed=(await db.query("SELECT 1 FROM payroll_run r JOIN payroll_run_employee e ON e.payroll_run_id=r.id JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.facility_id=$1 AND e.employee_id=$2 AND r.status IN ('APPROVED','FINALIZED') AND COALESCE(r.payment_date,p.pay_date) >= $3::date LIMIT 1",[facility,employeeId,effectiveOn])).rows.length
 if(committed)throw fail('Choose an effective date after already approved or paid payroll.')
 const cycles=(await db.query('SELECT DISTINCT onboarding_cycle FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 ORDER BY onboarding_cycle',[facility,employeeId])).rows.map(row=>row.onboarding_cycle)
 const agreement={version:1,employeeId:String(employeeId),verified:true,amountCents:election.extraWithholdingCents,payFrequency:schedule.pay_frequency,periodBasis:'PAYMENT_DATE',electionFingerprint:marylandElectionFingerprint(election)}
 const employeeTerms=`I agree to $${(agreement.amountCents/100).toFixed(2)} additional Maryland withholding per ${agreement.payFrequency.toLowerCase()} pay-calendar period beginning ${effectiveOn}. The period is determined by the payment date. Separate payments in the same period share this amount; amounts already withheld or reserved reduce the remaining deduction. This agreement supplements my saved MW507 election. I may contact payroll to request a change.`
 return {version:1,agreement,effectiveOn,expectedAgreementRevision:latest?.revision??0,hireDate:day(employee.hire_date),onboardingCycles:cycles,employeeTerms}
}
async function history(db,facility,employeeId){
 const rows=(await db.query('SELECT p.id,p.revision,p.terms,p.fingerprint,p.created_at,s.decision,s.signature,s.created_at AS signed_at,s.agreement_id FROM payroll_maryland_agreement_proposal p LEFT JOIN payroll_maryland_agreement_signature s ON s.proposal_id=p.id WHERE p.facility_id=$1 AND p.employee_id=$2 ORDER BY p.revision DESC',[facility,employeeId])).rows
 let actionable=false,reason='No employer proposal is available.'
 if(rows[0]&&!rows[0].decision){try{actionable=hash(await source(db,facility,employeeId,rows[0].terms.effectiveOn))===hash(rows[0].terms);reason=actionable?'Review the employer proposal and accept or decline.':'The proposal changed. Ask payroll to review new terms.'}catch(e){if(!e.status)throw e;reason=e.message}}
 else if(rows[0])reason='Your response has been retained.'
 return {history:rows,actionable,reason}
}
export function registerMarylandAgreementSigning(app,pool){
 const adminPath='/api/admin/payroll/employees/:id/maryland-agreement-proposals',employeePath='/api/payroll/employee/maryland-agreement-proposals'
 for(const isEmployee of [false,true])app.get(isEmployee?employeePath:adminPath,...(isEmployee?[payrollEmployeeAuth(pool)]:[]),async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  try{const facility=isEmployee?req.payrollEmployee.facility_id:req.canonicalAccess.facilityId,id=isEmployee?req.payrollEmployee.employee_id:req.params.id
   if(!(await pool.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,id])).rowCount)throw fail('Employee not found.',404)
   res.json({success:true,data:await history(pool,facility,id)})
  }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to load agreement proposals.'})}
 })
 app.get(`${adminPath}/preview`,async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  try{const terms=await source(pool,req.canonicalAccess.facilityId,req.params.id,req.query.effectiveOn);res.json({success:true,data:{terms,sourceFingerprint:hash(terms)}})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to review agreement terms.'})}
 })
 app.post(adminPath,async(req,res)=>{
  const db=await pool.connect()
  try{
   const b=req.body||{},facility=req.canonicalAccess.facilityId,id=req.params.id
   if(!uuid(b.requestKey)||b.confirmed!==true||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0)throw fail('Confirm the employer proposal and current revision.',400)
   const digest=hash(b)
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,id])
   const retry=(await db.query('SELECT * FROM payroll_maryland_agreement_proposal WHERE facility_id=$1 AND employee_id=$2 AND request_key=$3',[facility,id,b.requestKey])).rows[0]
   if(retry){if(retry.request_hash!==digest)throw fail('This request key was used for different terms.');await db.query('COMMIT');return res.json({success:true,data:{id:retry.id,reused:true}})}
   const latest=(await db.query('SELECT revision FROM payroll_maryland_agreement_proposal WHERE facility_id=$1 AND employee_id=$2 ORDER BY revision DESC LIMIT 1',[facility,id])).rows[0]
   if((latest?.revision??0)!==b.expectedRevision)throw fail('Proposal history changed. Reload before proposing new terms.')
   const terms=await source(db,facility,id,b.effectiveOn)
   if(b.sourceFingerprint!==hash(terms)||b.amountCents!==terms.agreement.amountCents||b.electionFingerprint!==terms.agreement.electionFingerprint||b.periodBasis!=='PAYMENT_DATE')throw fail('Review the exact current election amount and payment-date period basis.')
   const proposalId=randomUUID(),fingerprint=hash({id:proposalId,terms})
   await db.query('INSERT INTO payroll_maryland_agreement_proposal(id,facility_id,employee_id,revision,terms,fingerprint,created_by,request_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[proposalId,facility,id,b.expectedRevision+1,terms,fingerprint,req.adminId,b.requestKey,digest])
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'MARYLAND_AGREEMENT_PROPOSED','employee',$3,$4)",[facility,req.adminId,String(id),{proposalId,fingerprint}])
   await db.query('COMMIT');res.status(201).json({success:true,data:{id:proposalId,reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to propose agreement.'})}finally{db.release()}
 })
 app.post(`${employeePath}/:id/respond`,payrollEmployeeAuth(pool),async(req,res)=>{
  const db=await pool.connect()
  try{
   const b=req.body||{},s=req.payrollEmployee,signature=typeof b.signature==='string'?b.signature.trim():''
   if(!uuid(b.requestKey)||!uuid(req.params.id)||!['ACCEPT','DECLINE'].includes(b.decision)||b.confirmed!==true||signature.length<3||signature.length>200||/[\u0000-\u001f\u007f]/.test(signature))throw fail('Review the terms, enter your signature and confirm your response.',400)
   const digest=hash({proposalId:req.params.id,...b,signature})
   await db.query('BEGIN');await lockPayrollEmployeeSession(db,s)
   const retry=(await db.query('SELECT * FROM payroll_maryland_agreement_signature WHERE facility_id=$1 AND employee_id=$2 AND request_key=$3',[s.facility_id,s.employee_id,b.requestKey])).rows[0]
   if(retry){if(retry.request_hash!==digest)throw fail('This response key was already used for different terms.');await db.query('COMMIT');return res.json({success:true,data:{id:retry.id,agreementId:retry.agreement_id,reused:true}})}
   const proposal=(await db.query('SELECT * FROM payroll_maryland_agreement_proposal WHERE facility_id=$1 AND employee_id=$2 ORDER BY revision DESC LIMIT 1',[s.facility_id,s.employee_id])).rows[0]
   if(!proposal||proposal.id!==req.params.id||proposal.fingerprint!==b.proposalFingerprint||b.displayedTerms!==proposal.terms.employeeTerms)throw fail('Review the latest employer proposal before signing.')
   if((await db.query('SELECT 1 FROM payroll_maryland_agreement_signature WHERE proposal_id=$1',[proposal.id])).rowCount)throw fail('This proposal already has a retained response.')
   let agreementId=null
   if(b.decision==='ACCEPT'){
    const current=await source(db,s.facility_id,s.employee_id,proposal.terms.effectiveOn)
    if(hash(current)!==hash(proposal.terms))throw fail('The saved election, schedule or agreement history changed. Ask payroll for a new proposal.')
    const reference=`Internal employee agreement acceptance for proposal ${proposal.id}`,revision=current.expectedAgreementRevision+1
    const fingerprint=hash({proposal:proposal.fingerprint,signature,revision})
    agreementId=(await db.query("INSERT INTO payroll_maryland_additional_agreement(facility_id,employee_id,revision,status,agreement,effective_on,fingerprint,source_reference,request_key,request_hash,verified_by) VALUES($1,$2,$3,'ACTIVE',$4,$5,$6,$7,$8,$9,$10) RETURNING id",[s.facility_id,s.employee_id,revision,current.agreement,current.effectiveOn,fingerprint,reference,randomUUID(),digest,proposal.created_by])).rows[0].id
   }
   const id=randomUUID()
   await db.query('INSERT INTO payroll_maryland_agreement_signature(id,facility_id,employee_id,proposal_id,decision,signature,agreement_id,employee_session_id,request_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,s.facility_id,s.employee_id,proposal.id,b.decision,signature,agreementId,s.session_id,b.requestKey,digest])
   await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'MARYLAND_AGREEMENT_RESPONDED','employee',$2,$3)",[s.facility_id,String(s.employee_id),{proposalId:proposal.id,decision:b.decision,agreementId}])
   await db.query('COMMIT');res.json({success:true,data:{id,agreementId,reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain your agreement response.'})}finally{db.release()}
 })
}
