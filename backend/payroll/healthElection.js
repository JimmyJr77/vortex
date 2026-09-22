import {createHash,randomUUID} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {healthParticipantState} from './healthParticipantQualification.js'
import {employeeHealthDisclosure,healthDisclosureBytes} from './healthPlanDisclosure.js'
import {payrollEmployeeAuth,lockPayrollEmployeeSession} from './employeeAuth.js'
import {healthElectionProofCurrent} from './healthElectionProof.js'
const hash=value=>createHash('sha256').update(JSON.stringify(compensationEvidence(value))).digest('hex')
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
export async function healthElectionProposal(db,facility,employeeId,planId,effectiveOn){
 const participant=await healthParticipantState(db,facility,employeeId,planId,effectiveOn)
 if(participant.status!=='ELIGIBLE'||participant.current.effective_on!==effectiveOn)throw fail('Your hiring administrator must review eligibility and the permitted election date.',409)
 const review=participant.current.review,disclosure=await employeeHealthDisclosure(db,facility,employeeId,planId,effectiveOn)
 if(!['INITIAL_ENROLLMENT','OPEN_ENROLLMENT','PERMITTED_CHANGE'].includes(review.electionBasis)||!review.electionDeadline||!review.employeeElectionExplanation)throw fail('Your hiring administrator must retain the election window and employee explanation.',409)
 const selection=participant.source.selection
 const effectiveThrough=[participant.current.effective_through,disclosure.disclosure.planYearEndsOn,participant.source.planQualification.review.effectiveThrough].sort()[0]
 const terms=`I elect salary reduction for ${selection.planName} — ${selection.optionLabel} under ${disclosure.employerName}'s written Section 125 plan. The employee premium is $${(selection.monthlyCents/100).toFixed(2)} per month. The salary-reduction period begins ${effectiveOn} and ends ${effectiveThrough}. The separate wage-deduction authorization controls collection timing and amounts. This election is subject to the disclosed plan rules and may be changed only when the written plan and applicable rules permit a change. A request to change coverage or withdraw deduction authorization does not by itself establish a permitted cafeteria-plan election change. Declining this election does not cancel insurance coverage; contact your hiring administrator to reconcile coverage and payment arrangements.`
 const basis={version:1,facilityId:String(facility),employeeId:String(employeeId),onboardingCycle:participant.source.onboardingCycle,planId,planName:selection.planName,optionId:selection.optionId,optionLabel:selection.optionLabel,monthlyCents:selection.monthlyCents,effectiveOn,effectiveThrough,electionBasis:review.electionBasis,electionDeadline:review.electionDeadline,employeeExplanation:review.employeeElectionExplanation,participantQualificationId:participant.current.id,participantSourceFingerprint:participant.source.fingerprint,disclosureId:disclosure.id,disclosureSourceFingerprint:disclosure.sourceFingerprint,documentSha256:disclosure.documentSha256,documentPages:disclosure.documentPages,employeeTerms:disclosure.disclosure.employeeTerms,electionChangesTerms:disclosure.disclosure.electionChangesTerms,planYearStartsOn:disclosure.disclosure.planYearStartsOn,planYearEndsOn:disclosure.disclosure.planYearEndsOn,authorizationFingerprint:participant.source.authorization.proposalFingerprint,terms}
 return {...basis,fingerprint:hash(basis)}
}
async function clock(db,facility,employeeId){return (await db.query("SELECT (clock_timestamp() AT TIME ZONE timezone)::date::text AS today,clock_timestamp()::text AS signed_at,(SELECT max(COALESCE(r.payment_date,p.pay_date))::text FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee e ON e.payroll_run_id=r.id WHERE r.facility_id=$1 AND e.employee_id=$2 AND r.status IN ('APPROVED','FINALIZED')) AS last_committed FROM payroll_settings WHERE facility_id=$1",[facility,employeeId])).rows[0]}
export async function healthEmployeeElectionState(db,facility,employeeId,planId){
 const task=(await db.query("SELECT onboarding_cycle FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND task_key='PAY_REVIEW'",[facility,employeeId])).rows[0]
 if(!task)throw fail('Employee onboarding record not found.',404)
 const currentClock=await clock(db,facility,employeeId)
 const history=(await db.query('SELECT id,revision,onboarding_cycle,election,created_at FROM payroll_health_election WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3 ORDER BY onboarding_cycle DESC,revision DESC',[facility,employeeId,planId])).rows
 const dates=(await db.query("SELECT id,effective_on::text FROM payroll_health_participant_qualification WHERE facility_id=$1 AND employee_id=$2 AND onboarding_cycle=$3 AND plan_id=$4 AND review->>'disposition'='ELIGIBLE' AND effective_on>=$5::date AND review->>'electionDeadline'>=$5::text ORDER BY effective_on,revision DESC",[facility,employeeId,task.onboarding_cycle,planId,currentClock.today])).rows
 const offers=[],seen=new Set(),issues=[]
 for(const row of dates){if(seen.has(row.effective_on))continue;seen.add(row.effective_on)
  if(history.some(h=>h.election.proposal.participantQualificationId===row.id))continue
  try{const proposal=await healthElectionProposal(db,facility,employeeId,planId,row.effective_on);if(proposal.participantQualificationId!==row.id)continue;if(currentClock.last_committed&&proposal.effectiveOn<=currentClock.last_committed){issues.push('A committed payroll covers the proposed election date. Your hiring administrator must reconcile it before a new election.');continue}offers.push(proposal)}catch(e){if(e.status===409||e.status===404)issues.push(e.message);else throw e}
 }
 return {onboardingCycle:task.onboarding_cycle,offers,history,issues:[...new Set(issues)],today:currentClock.today}
}
export async function requireHealthElection(db,facility,employeeId,planId,paymentDate){
 const participant=await healthParticipantState(db,facility,employeeId,planId,paymentDate)
 if(participant.status!=='ELIGIBLE')throw fail('Current employee health qualification is required.',409)
 const proposal=await healthElectionProposal(db,facility,employeeId,planId,participant.current.effective_on)
 const row=(await db.query('SELECT id,election,proposal_fingerprint,created_at FROM payroll_health_election WHERE facility_id=$1 AND employee_id=$2 AND onboarding_cycle=$3 AND plan_id=$4 AND effective_on<=$5 AND effective_through>=$5 ORDER BY revision DESC LIMIT 1',[facility,employeeId,participant.source.onboardingCycle,planId,paymentDate])).rows[0]
 const timeZone=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]?.timezone
 if(!row||row.proposal_fingerprint!==proposal.fingerprint||row.election.action!=='ELECT'||row.election.proposalFingerprint!==proposal.fingerprint||hash(row.election.proposal)!==hash(proposal)||!healthElectionProofCurrent(row.election,proposal,timeZone,row.created_at))throw fail('Retain the employee’s current signed Section 125 election before collecting pretax health premiums.',409)
 return {id:row.id,proposalFingerprint:proposal.fingerprint,election:row.election,createdAt:new Date(row.created_at).toISOString(),timeZone}
}
export function registerHealthElection(app,pool){
 const auth=payrollEmployeeAuth(pool),base='/api/payroll/employee/health-plans/:planId/election'
 app.get('/api/payroll/employee/health-elections',auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const s=req.payrollEmployee
   const task=(await db.query("SELECT response FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND task_key='PAY_REVIEW'",[s.facility_id,s.employee_id])).rows[0]
   const retained=(await db.query('SELECT DISTINCT ON (plan_id) plan_id,election FROM payroll_health_election WHERE facility_id=$1 AND employee_id=$2 ORDER BY plan_id,onboarding_cycle DESC,revision DESC',[s.facility_id,s.employee_id])).rows
   const names=new Map(retained.map(row=>[row.plan_id,row.election.proposal.planName]))
   for(const item of task?.response?.benefitsElection?.selections||[])if(item.taxTreatment==='PRETAX'&&item.optionId!=='WAIVE')names.set(item.planId,item.planName)
   const plans=[];for(const [planId,planName] of names)plans.push({planId,planName,...await healthEmployeeElectionState(db,s.facility_id,s.employee_id,planId)})
   await db.query('COMMIT');res.json({success:true,data:{plans}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to load your health elections.'})}finally{db.release()}
 })
 app.get(`${base}/:electionId/document`,auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   if(!uuid(req.params.electionId))throw fail('Signed health election not found.',404)
   await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
   const s=req.payrollEmployee,row=(await db.query('SELECT disclosure_id,election FROM payroll_health_election WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3 AND id=$4',[s.facility_id,s.employee_id,req.params.planId,req.params.electionId])).rows[0]
   if(!row)throw fail('Signed health election not found.',404)
   const bytes=await healthDisclosureBytes(db,s.facility_id,row.disclosure_id)
   if(row.disclosure_id!==row.election.proposal.disclosureId||createHash('sha256').update(bytes).digest('hex')!==row.election.proposal.documentSha256)throw fail('The signed disclosure needs integrity review.',409)
   await db.query('COMMIT');res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition','attachment; filename="Signed-health-election-disclosure.pdf"');res.setHeader('X-Content-Type-Options','nosniff');res.send(bytes)
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retrieve your signed health plan disclosure.'})}finally{db.release()}
 })
 app.get(base,auth,async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const s=req.payrollEmployee,data=await healthEmployeeElectionState(db,s.facility_id,s.employee_id,req.params.planId);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to load your Section 125 election.'})}finally{db.release()}})
 app.post(base,auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const b=req.body||{},s=req.payrollEmployee
   if(!uuid(b.requestKey)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||!['ELECT','DECLINE'].includes(b.action)||b.confirmed!==true||b.disclosureConfirmed!==true||b.electionRulesConfirmed!==true||typeof b.signature!=='string'||b.signature.trim().length<2||b.signature.length>200||/[\u0000-\u001f\u007f]/.test(b.signature))throw fail('Read the plan disclosure and election rules, choose your election and sign with your full name.')
   const digest=hash({planId:req.params.planId,body:b})
   await db.query('BEGIN');await lockPayrollEmployeeSession(db,s)
   const old=(await db.query('SELECT id,request_fingerprint FROM payroll_health_election WHERE facility_id=$1 AND employee_id=$2 AND request_key=$3',[s.facility_id,s.employee_id,b.requestKey])).rows[0]
   if(old){if(old.request_fingerprint!==digest)throw fail('This request key belongs to a different health election.',409);await db.query('COMMIT');return res.json({success:true,data:{id:old.id,reused:true}})}
   const state=await healthEmployeeElectionState(db,s.facility_id,s.employee_id,req.params.planId),proposal=state.offers.find(p=>p.fingerprint===b.proposalFingerprint)
   if(!proposal||(state.history.find(row=>row.onboarding_cycle===state.onboardingCycle)?.revision||0)!==b.expectedRevision)throw fail('The election terms, permitted date or prior election changed. Reload before signing.',409)
   const currentClock=await clock(db,s.facility_id,s.employee_id)
   if(currentClock.today>proposal.electionDeadline||currentClock.today>proposal.effectiveOn||currentClock.last_committed&&proposal.effectiveOn<=currentClock.last_committed)throw fail('The prospective election window closed or payroll was committed. Ask your hiring administrator to review.',409)
   const id=randomUUID(),election={version:1,action:b.action,signature:b.signature.trim(),signedAt:currentClock.signed_at,confirmed:true,disclosureConfirmed:true,electionRulesConfirmed:true,proposalFingerprint:proposal.fingerprint,proposal}
   await db.query('INSERT INTO payroll_health_election(id,facility_id,employee_id,onboarding_cycle,plan_id,revision,participant_qualification_id,disclosure_id,effective_on,effective_through,proposal_fingerprint,election,employee_session_id,request_key,request_fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',[id,s.facility_id,s.employee_id,state.onboardingCycle,req.params.planId,b.expectedRevision+1,proposal.participantQualificationId,proposal.disclosureId,proposal.effectiveOn,proposal.effectiveThrough,proposal.fingerprint,election,s.session_id,b.requestKey,digest])
   await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'HEALTH_SECTION125_ELECTION_SIGNED','health_election',$2,$3)",[s.facility_id,id,{employeeId:String(s.employee_id),planId:req.params.planId,action:b.action,proposalFingerprint:proposal.fingerprint}])
   await db.query('COMMIT');res.json({success:true,data:{id,reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain your Section 125 election.'})}finally{db.release()}
 })
}
