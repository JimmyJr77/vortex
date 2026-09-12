import {correctionPremiumEvidence} from './correctionOvertimeSource.js'
import {salaryPaidPremium} from './salaryOvertimeSource.js'
import {compensationEvidence} from './employmentCompensation.js'
import {retirementStatementLines,retirementStatementSummary} from './retirementStatement.js'
const same=(a,b)=>JSON.stringify(compensationEvidence(a))===JSON.stringify(compensationEvidence(b))
const safe=n=>Number.isSafeInteger(n)&&n>=0
export function paidOvertimeReview(row){
 const issues=[],fail=message=>issues.push(message),matches=(Array.isArray(row.calculation_snapshot?.employees)?row.calculation_snapshot.employees:[]).filter(e=>String(e.employeeId)===String(row.employee_id)),source=matches[0],statement=row.statement_snapshot
 if(matches.length!==1||!source||!statement)return {paidPremiumCents:null,issues:['Missing or duplicate retained employee calculation.'],qualificationStatus:'REVIEW_REQUIRED'}
 const posted=['regular_pay_cents','overtime_pay_cents','other_taxable_pay_cents'].map(k=>row[k]===null||row[k]===undefined||!/^\d+$/.test(String(row[k]))?NaN:Number(row[k]))
 if(posted.some(n=>!safe(n))||!safe(posted.reduce((a,b)=>a+b,0))||posted[0]!==source.regularPayCents||posted[1]!==source.overtimePayCents||posted[2]!==source.otherTaxablePayCents)fail('Posted earnings differ from retained payroll.')
 if(source.workweekPaymentVersion!==1||statement.workweekPaymentVersion!==1||!same(source.workweekPayments,statement.workweekPayments)||!Array.isArray(source.workweekPayments))fail('Retained workweek payments do not reconcile.')
 if(!Array.isArray(source.payItems)||!same(source.payItems,statement.payItems))fail('Retained pay items do not reconcile.')
 let premium=0,total=0;const weeks=new Set()
 for(const week of Array.isArray(source.workweekPayments)?source.workweekPayments:[]){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(week.week)||weeks.has(week.week)||!safe(week.straightTimePayCents)||!safe(week.premiumCents)){fail('Invalid or duplicate paid workweek evidence.');continue}
  weeks.add(week.week);premium+=week.premiumCents;total+=week.straightTimePayCents+week.premiumCents
 }
 if(source.payType==='SALARY'){
  if(statement.payType!=='SALARY'||!same(source.salaryCalculation,statement.salaryCalculation)||source.workweekPayments?.length)fail('Retained salary calculation does not reconcile.')
  try{premium=salaryPaidPremium(source)}catch(e){fail(e.message)}
 }else if(!safe(total)||total!==posted[0]+posted[1])fail('Regular and overtime wages require complete workweek payment allocation.')
 const items=Array.isArray(source.payItems)?source.payItems:[],known=['BONUS','BONUS_OVERTIME','PAID_LEAVE','LEAVE_PAYOUT','REIMBURSEMENT','PRETAX_DEDUCTION','POSTTAX_DEDUCTION','GARNISHMENT','SALARY_EXTRA_STRAIGHT_TIME','WAGE_CORRECTION','RETIREMENT_401K_PRETAX','RETIREMENT_401K_ROTH']
 if(items.some(item=>item.kind?.startsWith('RETIREMENT_'))||source.retirementPlans?.length||source.retirement401k||statement.retirement){
  try{const summary=retirementStatementSummary(source);if(!summary||!same(summary,statement.retirement))throw new Error('mismatch');retirementStatementLines(row)}catch{fail('Retirement deductions do not reconcile to retained payroll and statement evidence.')}
 }
 if(items.some(item=>!known.includes(item.kind)))fail('Correction or other earnings require separate premium reconciliation.')
 const taxableItems=items.filter(item=>['BONUS','BONUS_OVERTIME','PAID_LEAVE','LEAVE_PAYOUT','SALARY_EXTRA_STRAIGHT_TIME','WAGE_CORRECTION'].includes(item.kind))
 const taxableTotal=taxableItems.reduce((sum,item)=>sum+(safe(item.amountCents)?item.amountCents:NaN),0)
 if(!safe(taxableTotal)||taxableTotal!==posted[2])fail('Other taxable earnings do not reconcile to retained pay items.')
 const bonusPremiums=items.filter(item=>item.kind==='BONUS_OVERTIME'),allocations=items.filter(item=>item.kind==='BONUS'&&item.bonusAllocation)
 let bonusPaid=0,bonusAllocated=0
 for(const item of bonusPremiums){if(!safe(item.amountCents))fail('Invalid bonus premium amount.');else bonusPaid+=item.amountCents}
 for(const item of allocations){if(!safe(item.bonusAllocation.additionalOvertimeCents))fail('Invalid retained bonus allocation.');else bonusAllocated+=item.bonusAllocation.additionalOvertimeCents}
 if(!safe(bonusPaid)||!safe(bonusAllocated)||bonusPaid!==bonusAllocated)fail('Paid bonus premiums differ from retained allocations.')
 const corrections=items.filter(item=>item.kind==='WAGE_CORRECTION'),plans=source.correctionSettlements||[],settled=statement.correctionSettlements||[]
 if(!Array.isArray(plans)||!Array.isArray(settled)||plans.length!==corrections.length||settled.length!==corrections.length)fail('Correction premium settlement evidence is incomplete.')
 else {
  const seen=new Set()
  for(const item of corrections){
   const c=item.correction,matching=plans.filter(p=>p.authorizationId===c?.authorizationId&&p.requestId===c?.requestId),plan=matching[0],paid=settled.filter(p=>p.authorizationId===c?.authorizationId&&p.requestId===c?.requestId)
   if(!c||c.version!==1||!safe(c.authorizationId)||!c.authorizationId||!safe(c.requestId)||!c.requestId||seen.has(c.authorizationId)||matching.length!==1||paid.length!==1||plan.version!==1||paid[0].version!==1||plan.paymentApplied!==false||plan.status!=='AUTHORIZED_UNAPPLIED'||paid[0].status!=='SETTLED'||paid[0].paymentApplied!==true||!safe(paid[0].settlementId)||!paid[0].settlementId||Number(paid[0].runEmployeeId)!==Number(row.id)||plan.calculationFingerprint!==c.fingerprint||paid[0].calculationFingerprint!==c.fingerprint||plan.priorWageCorrectionCents!==item.amountCents||paid[0].priorWageCorrectionCents!==item.amountCents||!same(plan.overtimeSource,paid[0].overtimeSource)){fail('Correction premium does not match its paid authorization.');continue}
   seen.add(c.authorizationId)
   const evidence=plan.overtimeSource,recomputed=correctionPremiumEvidence(evidence?.runs,item.amountCents)
   if(!evidence||recomputed.status!=='RECONCILED'||!same(evidence,recomputed)){fail('Correction premium requires source reconciliation.');continue}
   premium+=evidence.premiumCents
  }
 }
 premium+=bonusPaid;if(!safe(premium))fail('Paid premium total exceeds safe precision.')
 return {paidPremiumCents:issues.length?null:premium,issues,qualificationStatus:'REVIEW_REQUIRED'}
}
