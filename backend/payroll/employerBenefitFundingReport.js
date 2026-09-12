import {createHash} from 'node:crypto'
import {benefitsReviewCurrent} from './benefitsReview.js'
import {compensationEvidence} from './employmentCompensation.js'
import {priorMonthlyBenefitCollection} from './monthlyBenefits.js'
const day=value=>new Date(value).toISOString().slice(0,10)
const canonical=value=>JSON.stringify(compensationEvidence(value))
const fail=()=>{throw Object.assign(new Error('Employer benefit funding evidence needs reconciliation with the retained enrollment and finalized payroll.'),{status:409})}
export async function employerBenefitFundingReport(db,facility,start,end){
 const rows=(await db.query(`SELECT r.id,r.status,r.run_kind,r.calculation_snapshot,COALESCE(r.payment_date,p.pay_date) AS payment_date,re.employee_id,re.posttax_deduction_cents
 FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee re ON re.payroll_run_id=r.id
 WHERE r.facility_id=$1 AND r.status='FINALIZED' AND COALESCE(r.payment_date,p.pay_date)>=date_trunc('month',$2::date)
 AND COALESCE(r.payment_date,p.pay_date)<date_trunc('month',$3::date)+interval '1 month'
 ORDER BY COALESCE(r.payment_date,p.pay_date),r.id,re.employee_id`,[facility,start,end])).rows
 const months=new Map(),groups=new Map()
 for(const row of rows){const key=canonical([String(row.employee_id),day(row.payment_date).slice(0,7)]);months.set(key,[...(months.get(key)||[]),row])}
 for(const [key,evidence] of months){
  for(const row of evidence){
   const matches=(row.calculation_snapshot?.employees||[]).filter(e=>String(e.employeeId)===String(row.employee_id)),employee=matches[0],funding=employee?.benefitCollection
   if(!matches.some(e=>e.benefitCollection?.status==='REVIEWED_EMPLOYER_FUNDED'))continue
   if(matches.length!==1)fail()
   const paymentDate=day(row.payment_date),month=paymentDate.slice(0,7),election=funding.election,review=funding.review
   if(matches.length!==1||row.run_kind!=='REGULAR'||funding.version!==1||funding.month!==month||funding.monthlyCents!==0||review?.disposition!=='ENROLLED_EMPLOYER_FUNDED'||review.effectiveOn>paymentDate||!benefitsReviewCurrent(review,election?.policyTerms,paymentDate,election,election?.catalogSnapshot||[])||employee.payItems?.some(i=>i.benefitDeduction))fail()
   const expected=election.selections.filter(s=>s.optionId!=='WAIVE').map(s=>({planId:s.planId,planName:s.planName,optionId:s.optionId,optionLabel:s.optionLabel,employeeMonthlyCents:0,employerMonthlyCents:s.employeeCostCents+s.employerCostCents,assumedEmployeeMonthlyCents:s.employeeCostCents}))
   if(!expected.length||expected.some(i=>!Number.isSafeInteger(i.employerMonthlyCents)||i.employerMonthlyCents<0)||canonical(funding.fundingItems)!==canonical(expected))fail()
   const fingerprint=createHash('sha256').update(canonical({review,election,items:expected})).digest('hex'),groupKey=canonical([key,fingerprint])
   const group=groups.get(groupKey)||{employeeId:String(row.employee_id),employeeName:employee.employeeName,month,effectiveOn:review.effectiveOn,items:expected,evidenceFingerprint:fingerprint,payrolls:[],employeeCollectedCents:0,reviewRequired:true}
   group.payrolls.push({runId:Number(row.id),paymentDate});groups.set(groupKey,group)
  }
 }
 const result=[],versions=new Map()
 for(const group of groups.values()){const key=canonical([group.employeeId,group.month]);versions.set(key,(versions.get(key)||0)+1)}
 for(const group of groups.values()){
  if(!group.payrolls.some(p=>p.paymentDate>=start&&p.paymentDate<=end))continue
  const evidence=months.get(canonical([group.employeeId,group.month]))
  let collected
  try{collected=priorMonthlyBenefitCollection(evidence,group.employeeId,group.month)}catch{fail()}
  group.employeeCollectedCents=collected?.monthlyCents||0
  group.employeeCollection=collected?{runId:collected.runId,paymentDate:collected.paymentDate,amountCents:collected.monthlyCents}:null
  group.coverageVersions=versions.get(canonical([group.employeeId,group.month]))
  result.push(group)
 }
 return result
}
export function employerBenefitFundingCsv(groups){
 return [['Coverage month','Employee ID','Employee at payment','Effective date','Plan ID','Plan','Option ID','Coverage option','Published employer monthly premium','Employee share assumed','Employee contributions collected in month (employee total; do not sum across rows)','Funding versions in month','Payroll evidence','Evidence fingerprint','Accounting status'],...groups.flatMap(g=>g.items.map(i=>[g.month,g.employeeId,g.employeeName,g.effectiveOn,i.planId,i.planName,i.optionId,i.optionLabel,(i.employerMonthlyCents/100).toFixed(2),(i.assumedEmployeeMonthlyCents/100).toFixed(2),(g.employeeCollectedCents/100).toFixed(2),g.coverageVersions,g.payrolls.map(p=>`${p.runId} (${p.paymentDate})`).join('; '),g.evidenceFingerprint,'REQUIRES_CARRIER_RECONCILIATION']))]
}
