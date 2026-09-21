import {employerRetirementJournalLines} from './retirementEmployerJournal.js'
import {retirementJournalLines} from './retirementJournal.js'
const fail=message=>Object.assign(new Error(message),{status:409})
const valid=n=>Number.isSafeInteger(n)&&n>=0
const add=(a,b)=>{if(!valid(a)||!valid(b)||!Number.isSafeInteger(a+b))throw fail('Retirement statement amounts require reconciliation.');return a+b}
const kinds=['RETIREMENT_401K_PRETAX','RETIREMENT_401K_ROTH']
export function retirementStatementSummary(employee){
 if(!employee?.employerRetirementPlans?.length&&!employee?.retirementPlans?.length&&!employee?.retirement401k&&!employee?.payItems?.some(i=>i.kind?.startsWith('RETIREMENT_')))return null
 retirementJournalLines({deduction_cents:employee.totalDeductionCents,calculation_snapshot:{employees:[employee]}})
 const employerPlans=employee.employerRetirementPlans||[]
 if(employerPlans.length){
  const first=employerPlans[0].calculation
  employerRetirementJournalLines({id:first?.runId,facility_id:first?.facilityId,calculation_snapshot:{employees:[employee]}})
  if(employerPlans.some(p=>!employee.retirementPlans?.some(e=>e.planId===p.planId)))throw fail('Employer statement requires matching employee plan evidence.')
 }
 return {version:1,...(employerPlans.length?{employerPlans:employerPlans.map(({planId,calculation:c})=>({planId,planName:employee.retirementPlans.find(e=>e.planId===planId).calculation.planName||planId,matchingCents:c.contribution.proposed.matchingCents,nonelectiveCents:c.contribution.proposed.nonelectiveCents,totalCents:c.contribution.proposed.totalCents}))}:{}),plans:employee.retirementPlans.map(({planId,calculation:c})=>({planId,planName:c.planName||planId,ordinaryPretaxCents:c.ordinary.pretax,ordinaryRothCents:c.ordinary.roth,catchUpPretaxCents:c.catchUp.pretax,catchUpRothCents:c.catchUp.roth}))}
}
export function retirementStatementLines(row){
 const snapshot=row.statement_snapshot||{},retirement=snapshot.retirement,items=(snapshot.payItems||[]).filter(i=>i.kind?.startsWith('RETIREMENT_'))
 if(!retirement&&!items.length)return []
 if(retirement?.version!==1||!Array.isArray(retirement.plans)||!retirement.plans.length||items.some(i=>!kinds.includes(i.kind)))throw fail('Retirement statement requires retained contribution evidence.')
 const seen=new Set(),lines=[];let pretax=0,roth=0
 for(const p of retirement.plans){
  if(typeof p.planId!=='string'||!p.planId||seen.has(p.planId)||typeof p.planName!=='string'||!p.planName)throw fail('Retirement statement plan identity requires reconciliation.')
  seen.add(p.planId)
  pretax=add(pretax,add(p.ordinaryPretaxCents,p.catchUpPretaxCents));roth=add(roth,add(p.ordinaryRothCents,p.catchUpRothCents))
  for(const [key,label] of [['ordinaryPretaxCents','401(k) pretax'],['ordinaryRothCents','401(k) Roth'],['catchUpPretaxCents','401(k) pretax catch-up'],['catchUpRothCents','401(k) Roth catch-up']])if(p[key])lines.push([label,p.planName.slice(0,200),-p[key]])
 }
 const sum=kind=>(snapshot.payItems||[]).filter(i=>i.kind===kind).reduce((n,i)=>add(n,i.amountCents),0)
 if(sum(kinds[0])!==pretax||sum(kinds[1])!==roth||!valid(Number(row.pretax_deduction_cents))||!valid(Number(row.posttax_deduction_cents))||add(pretax,sum('PRETAX_DEDUCTION'))!==Number(row.pretax_deduction_cents)||add(roth,sum('POSTTAX_DEDUCTION'))!==Number(row.posttax_deduction_cents))throw fail('Retirement statement does not reconcile to payroll deductions.')
 return lines
}

// Informational contributions are deliberately separate from wage/deduction
// lines; including them in the net-pay sum would overstate employee pay.
export function employerRetirementStatementLines(row){
 const retirement=row.statement_snapshot?.retirement
 if(retirement?.employerPlans===undefined)return []
 if(retirement.version!==1||!Array.isArray(retirement.employerPlans)||!Array.isArray(retirement.plans))throw fail('Employer statement requires retained contribution evidence.')
 const seen=new Set(),lines=[]
 for(const p of retirement.employerPlans){
  if(typeof p.planId!=='string'||!p.planId||seen.has(p.planId)||typeof p.planName!=='string'||!p.planName||!retirement.plans.some(e=>e.planId===p.planId&&e.planName===p.planName))throw fail('Employer statement plan identity requires reconciliation.')
  seen.add(p.planId)
  if(add(p.matchingCents,p.nonelectiveCents)!==p.totalCents)throw fail('Employer statement contribution amounts do not reconcile.')
  if(p.matchingCents)lines.push(['Employer 401(k) matching',p.planName.slice(0,200),p.matchingCents])
  if(p.nonelectiveCents)lines.push(['Employer 401(k) nonelective',p.planName.slice(0,200),p.nonelectiveCents])
 }
 return lines
}
