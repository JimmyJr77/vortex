import {benefitsReviewCurrent} from './benefitsReview.js'
import {benefitsTerms,benefitPlans} from './benefitCatalog.js'
import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {benefitsDeductionProposal} from './benefitsDeductionAuthorization.js'
import {retirementStatementSummary} from './retirementStatement.js'
const day=value=>new Date(value).toISOString().slice(0,10)
const same=(a,b)=>JSON.stringify(compensationEvidence(a))===JSON.stringify(compensationEvidence(b))
function retainedAuthorization(saved){
 if(!saved?.proposal||saved.version!==1||typeof saved.signature!=='string'||saved.signature.trim().length<2||!Number.isFinite(Date.parse(saved.signedAt)))throw new Error('Reconcile the retained signed benefit deduction authorization.')
 const {fingerprint,...basis}=saved.proposal
 const computed=createHash('sha256').update(JSON.stringify(compensationEvidence(basis))).digest('hex')
 if(fingerprint!==computed||saved.proposalFingerprint!==computed||basis.version!==1||basis.timing!=='FIRST_REGULAR_PAYMENT_MONTHLY'||!Array.isArray(basis.items)||!basis.items.length||basis.items.some(i=>!Number.isSafeInteger(i.monthlyCents)||i.monthlyCents<=0)||basis.items.reduce((n,i)=>n+i.monthlyCents,0)!==basis.monthlyCents)throw new Error('The retained benefit deduction amounts do not match the signed authorization.')
 return basis
}
const amounts=items=>items.map(i=>({planId:i.planId,optionId:i.optionId,monthlyCents:i.monthlyCents,taxTreatment:i.taxTreatment})).sort((a,b)=>a.planId.localeCompare(b.planId))
export function priorMonthlyBenefitCollection(rows,employeeId,month){
 const charges=[]
 for(const row of rows){
  const matches=(row.calculation_snapshot?.employees||[]).filter(e=>Number(e.employeeId)===Number(employeeId))
  const frozen=matches[0],items=(frozen?.payItems||[]).filter(i=>i.benefitDeduction)
  if(!items.length)continue
  if(matches.length!==1||row.run_kind!=='REGULAR')throw new Error('Reconcile duplicate or unsupported monthly benefit payment evidence.')
  const collection=frozen.benefitCollection,saved=collection?.authorization,basis=retainedAuthorization(saved)
  const signedDay=new Intl.DateTimeFormat('en-CA',{timeZone:collection.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(saved.signedAt))
  if(collection.status!=='COLLECT_THIS_RUN'||typeof collection.timezone!=='string'||collection.signedDay!==signedDay||day(row.payment_date)<signedDay||day(row.payment_date)<basis.startOn||day(row.payment_date).slice(0,7)!==month)throw new Error('Reconcile the benefit collection date against the signed authorization.')
  if(Number(basis.employeeId)!==Number(employeeId)||items.some(i=>i.kind!=='POSTTAX_DEDUCTION'||i.benefitDeduction.month!==month||i.benefitDeduction.authorizationFingerprint!==saved.proposalFingerprint||i.amountCents!==i.benefitDeduction.monthlyCents)||!same(amounts(items.map(i=>i.benefitDeduction)),amounts(basis.items)))throw new Error('Monthly benefit deductions do not match their retained authorization.')
  const retirement=retirementStatementSummary(frozen)
  const roth=retirement?retirement.plans.reduce((n,p)=>n+p.ordinaryRothCents+p.catchUpRothCents,0):0
  const total=frozen.payItems.filter(i=>i.kind==='POSTTAX_DEDUCTION').reduce((n,i)=>n+Number(i.amountCents),roth)
  if(!Number.isSafeInteger(total)||total!==Number(row.posttax_deduction_cents)||total!==Number(frozen.posttaxDeductionCents))throw new Error('Monthly benefit deduction totals do not reconcile to the committed payroll.')
  charges.push({runId:Number(row.id),paymentDate:day(row.payment_date),status:row.status,items:basis.items,monthlyCents:basis.monthlyCents,authorizationFingerprint:saved.proposalFingerprint})
 }
 if(charges.length>1)throw new Error('More than one committed payroll collected benefits for this month. Reconcile the duplicate before continuing.')
 return charges[0]||null
}
async function priorCoverage(db,facility,employee,task,paymentDate){
 const history=(await db.query("SELECT id,snapshot FROM payroll_onboarding_revision WHERE facility_id=$1 AND employee_id=$2 AND task_id=$3 AND onboarding_cycle=$4 AND snapshot->'response'->'benefitsReview'->>'effectiveOn'<=$5 ORDER BY snapshot->'response'->'benefitsReview'->>'effectiveOn' DESC,id DESC",[facility,employee.id,task.id,task.onboarding_cycle,paymentDate])).rows
 const valid=history.find(row=>{const prior=row.snapshot,basis=prior.response?.paySetup?.basis;return prior.status==='COMPLETE'&&basis&&benefitsReviewCurrent(prior.response.benefitsReview,basis.benefitsPolicy,paymentDate,prior.response.benefitsElection,basis.benefitPlans||[])})
 if(!valid){if(history.some(row=>row.snapshot.response?.benefitsDeductionAuthorization)||typeof task.response?.benefitsDeductionAuthorization?.proposal?.startOn==='string'&&task.response.benefitsDeductionAuthorization.proposal.startOn<=paymentDate)throw new Error('Reconcile the retained prior benefits review before paying this earlier coverage period.');return null}
 const prior=valid.snapshot,response=prior.response,election=response.benefitsElection,saved=response.benefitsDeductionAuthorization||null
 const items=(election?.selections||[]).filter(item=>item.optionId!=='WAIVE'&&item.employeeCostCents>0)
 const required=response.benefitsReview.disposition==='ENROLLED'&&items.length>0
 if(required){
  const basis=retainedAuthorization(saved)
  if(Number(basis.employeeId)!==Number(employee.id)||Number(basis.onboardingCycle)!==Number(task.onboarding_cycle)||basis.electionId!==election.submissionId||basis.startOn!==response.benefitsReview.effectiveOn||!same(amounts(basis.items),amounts(items.map(item=>({...item,monthlyCents:item.employeeCostCents})))))throw new Error('Reconcile the prior coverage amounts and signed deduction authorization.')
 }
 return {task:prior,data:{required,status:required?'CURRENT':'NOT_REQUIRED',saved,proposal:required?saved.proposal:null},revisionId:Number(valid.id)}
}
export async function applyMonthlyBenefits(db,facility,preview,rawEmployees,settings,paymentDate,excludedRunId=null){
 paymentDate=day(paymentDate);const month=paymentDate.slice(0,7)
 const ids=preview.employees.map(e=>Number(e.employeeId))
 if(!ids.length)return
 const tasks=(await db.query("SELECT * FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=ANY($2::bigint[]) AND task_key='PAY_REVIEW'",[facility,ids])).rows
 if(!tasks.some(t=>t.response?.benefitsDeductionAuthorization||['ENROLLED','ENROLLED_EMPLOYER_FUNDED'].includes(t.response?.benefitsReview?.disposition)&&t.response?.benefitsElection?.selections?.some(s=>s.employeeCostCents>0)))return
 const prior=(await db.query(`SELECT r.id,r.status,r.run_kind,COALESCE(r.payment_date,p.pay_date) AS payment_date,r.calculation_snapshot,re.employee_id,re.posttax_deduction_cents
 FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee re ON re.payroll_run_id=r.id
 WHERE r.facility_id=$1 AND re.employee_id=ANY($2::bigint[]) AND r.status IN ('APPROVED','FINALIZED') AND r.id IS DISTINCT FROM $3::bigint
 AND to_char(COALESCE(r.payment_date,p.pay_date),'YYYY-MM')=$4 ORDER BY r.id`,[facility,ids,excludedRunId,month])).rows
 const today=(await db.query('SELECT (now() AT TIME ZONE $1)::date::text AS today',[settings.timezone])).rows[0].today
 for(const employee of preview.employees){
  let task=tasks.find(t=>Number(t.employee_id)===Number(employee.employeeId))
  if(!task)continue
  const withdrawal=task.response?.benefitsDeductionWithdrawal
  const raw=rawEmployees.find(e=>Number(e.id)===Number(employee.employeeId))
  let data=benefitsDeductionProposal(raw,task,settings,today)
  if(!data.required&&!data.saved&&task.response?.benefitsReview?.disposition!=='ENROLLED_EMPLOYER_FUNDED')continue
  const problem=message=>{const warning={employeeId:employee.employeeId,code:'BENEFIT_DEDUCTION_REVIEW',severity:'critical',blocking:true,message};employee.warnings.push(warning);preview.warnings.push(warning)}
  let datedCoverage=null
  try{
   const effective=task.response?.benefitsReview?.effectiveOn
   if(effective&&paymentDate<effective){
    if(task.status!=='COMPLETE'||!benefitsReviewCurrent(task.response?.benefitsReview,benefitsTerms(settings.onboarding_policy),today,task.response?.benefitsElection,benefitPlans(settings.onboarding_policy)))throw new Error('Complete the current future-dated benefits review before using prior coverage.')
    const previous=await priorCoverage(db,facility,raw,task,paymentDate)
    if(!previous)continue
    datedCoverage={revisionId:previous.revisionId,changeEffectiveOn:effective}
    task=previous.task;data=previous.data
   }
   if(!data.required){
    const employerFunded=task.response?.benefitsReview?.disposition==='ENROLLED_EMPLOYER_FUNDED'
    if((data.saved||employerFunded)&&employee.grossPayCents>0&&!datedCoverage&&(task.status!=='COMPLETE'||!benefitsReviewCurrent(task.response?.benefitsReview,benefitsTerms(settings.onboarding_policy),today,task.response?.benefitsElection,benefitPlans(settings.onboarding_policy))))throw new Error('Review the changed benefit election before removing previously authorized contributions from payroll.')
    if((data.saved||datedCoverage||employerFunded)&&employee.grossPayCents>0)employee.benefitCollection={...(employerFunded?{fundingItems:task.response.benefitsElection.selections.filter(s=>s.optionId!=='WAIVE').map(s=>({planId:s.planId,planName:s.planName,optionId:s.optionId,optionLabel:s.optionLabel,employeeMonthlyCents:0,employerMonthlyCents:s.employeeCostCents+s.employerCostCents,assumedEmployeeMonthlyCents:s.employeeCostCents}))}:{}),version:1,status:employerFunded?'REVIEWED_EMPLOYER_FUNDED':'REVIEWED_NO_CONTRIBUTION',month,monthlyCents:0,authorization:data.saved,review:task.response.benefitsReview,election:task.response.benefitsElection}
    continue
   }
   const withdrawn=!!withdrawal&&withdrawal.authorizationRequestKey===data.saved?.requestKey
   if(employee.grossPayCents<=0){if(data.status==='CURRENT'||data.status==='WITHDRAWN')employee.benefitCollection={version:1,status:'NO_WAGES',month,monthlyCents:data.proposal.monthlyCents,authorization:data.saved,...(withdrawn?{withdrawal}:{})};continue}
   if(data.status!=='CURRENT'&&!(data.status==='WITHDRAWN'&&withdrawn))throw new Error('Collect the current signed benefit deduction authorization before processing wages with employee benefit contributions.')
   const authorization=data.saved,basis=retainedAuthorization(authorization)
   const signedDay=new Intl.DateTimeFormat('en-CA',{timeZone:settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(authorization.signedAt))
   if(paymentDate<signedDay||paymentDate<basis.startOn)continue
   if(basis.items.some(i=>i.taxTreatment!=='POSTTAX'))throw new Error('Pretax benefit deductions require verified taxable-wage calculations before automatic collection is available.')
   const collected=priorMonthlyBenefitCollection(prior.filter(r=>Number(r.employee_id)===Number(employee.employeeId)),employee.employeeId,month)
   if(collected){
    if(collected.paymentDate>paymentDate||!same(amounts(collected.items),amounts(basis.items)))throw new Error('A different or later benefit deduction is already committed for this month. Reconcile the coverage change or payment order before continuing.')
    if(withdrawn){
     if(!Number.isFinite(Date.parse(withdrawal.recordedAt)))throw new Error('Reconcile the retained benefit withdrawal time.')
     const proof=(await db.query("SELECT status='FINALIZED' AND finalized_at<=$3::timestamptz AS eligible FROM payroll_run WHERE facility_id=$1 AND id=$2",[facility,collected.runId,withdrawal.recordedAt])).rows[0]
     if(proof?.eligible!==true)throw new Error('The earlier benefit collection was not finalized before withdrawal. Review its payment and authorization before continuing.')
    }
    employee.benefitCollection={version:1,status:'ALREADY_COLLECTED',month,monthlyCents:basis.monthlyCents,prior:collected,authorization,...(withdrawn?{withdrawal}:{})}
    continue
   }
   if(withdrawn)throw new Error('The employee withdrew this benefit deduction authorization. Review benefits funding and obtain a new authorization before collecting further deductions.')
   if(raw.employment_status==='TERMINATED'||raw.employment_status==='ONBOARDING')throw new Error('Review benefit continuation and dated deduction coverage before collecting from a former employment period.')
   const taxes=[employee.federalIncomeTaxCents,employee.stateIncomeTaxCents,employee.socialSecurityTaxCents,employee.medicareTaxCents,employee.additionalMedicareTaxCents]
   if(taxes.every(n=>n!==null)&&employee.grossPayCents-taxes.reduce((n,v)=>n+Number(v),0)-employee.totalDeductionCents<basis.monthlyCents)problem('Available wages cannot cover the full authorized monthly benefit contribution. Reimbursements cannot fund this wage deduction; resolve collection before approval.')
   employee.benefitCollection={version:1,status:'COLLECT_THIS_RUN',month,timezone:settings.timezone,signedDay,monthlyCents:basis.monthlyCents,authorization}
   for(const item of basis.items)employee.payItems.push({kind:'POSTTAX_DEDUCTION',name:`${item.planName} — ${item.optionLabel}`,amountCents:item.monthlyCents,benefitDeduction:{version:1,month,...item,authorizationFingerprint:authorization.proposalFingerprint}})
   employee.posttaxDeductionCents+=basis.monthlyCents;employee.totalDeductionCents+=basis.monthlyCents
   if(employee.netPayCents!==null)employee.netPayCents-=basis.monthlyCents
  }catch(e){problem(e.message)}finally{if(datedCoverage&&employee.benefitCollection)employee.benefitCollection.datedCoverage=datedCoverage}
 }
 preview.deductionCents=preview.employees.reduce((n,e)=>n+e.totalDeductionCents,0)
 preview.netPayCents=preview.employees.every(e=>e.netPayCents!==null)?preview.employees.reduce((n,e)=>n+e.netPayCents,0):null
}
