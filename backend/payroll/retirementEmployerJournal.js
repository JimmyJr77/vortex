const fail=message=>Object.assign(new Error(message),{status:409})
const add=(a,b)=>{if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<0||!Number.isSafeInteger(a+b))throw fail('Employer retirement accounting requires exact nonnegative cents.');return a+b}
export function employerRetirementJournalLines(run){
 const employees=run.calculation_snapshot?.employees||[]
 if(!employees.some(e=>e.employerRetirementPlans?.length))return []
 if(new Set(employees.map(e=>String(e.employeeId))).size!==employees.length)throw fail('Employer retirement accounting requires unique employees.')
 const groups=new Map()
 for(const employee of employees){
  const seen=new Set()
  for(const {planId,calculation:c} of employee.employerRetirementPlans||[]){
   const p=c?.contribution?.proposed
   if(!planId||seen.has(planId)||c?.requiresPayrollIntegration!==false||c.previewOnly!==false||c.contribution?.status!=='CALCULATED_NOT_AUTHORIZED'||c.contribution.issues?.length!==0||String(c.facilityId)!==String(run.facility_id)||String(c.runId)!==String(run.id)||String(c.employeeId)!==String(employee.employeeId)||c.planId!==planId)throw fail('Employer retirement accounting requires integrated, scoped plan evidence.')
   seen.add(planId)
   if(add(p?.matchingCents,p?.nonelectiveCents)!==p.totalCents||p.matchingCents!==c.contribution.required?.matchingCents||p.nonelectiveCents!==c.contribution.required?.nonelectiveCents||p.totalCents!==c.contribution.required?.totalCents)throw fail('Employer contribution components do not reconcile.')
   for(const [kind,value] of [['matching',p.matchingCents],['nonelective',p.nonelectiveCents]]){
    const description=`401(k) ${planId}: employer ${kind} contributions`
    groups.set(description,add(groups.get(description)||0,value))
   }
  }
 }
 return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).filter(([,amount])=>amount>0).flatMap(([description,amount])=>[['employerRetirement',amount,'Debit',description],['retirement',amount,'Credit',description]])
}
export async function verifyEmployerRetirementPosting(db,run){
 const lines=employerRetirementJournalLines(run)
 const count=(run.calculation_snapshot?.employees||[]).reduce((n,e)=>n+(e.employerRetirementPlans?.length||0),0)
 const retained=(await db.query('SELECT count(*)::int n FROM payroll_retirement_employer_run_ledger WHERE facility_id=$1 AND run_id=$2',[run.facility_id,run.id])).rows[0]?.n
 if(retained!==count)throw fail('Employer retirement snapshot omits or duplicates retained contribution ledger evidence.')
 for(const employee of run.calculation_snapshot?.employees||[])for(const {planId,calculation} of employee.employerRetirementPlans||[]){
  const row=(await db.query('SELECT calculation=$5::jsonb same,matching_cents,nonelective_cents FROM payroll_retirement_employer_run_ledger WHERE facility_id=$1 AND run_id=$2 AND employee_id=$3 AND plan_id=$4',[run.facility_id,run.id,employee.employeeId,planId,calculation])).rows
  if(row.length!==1||!row[0].same||Number(row[0].matching_cents)!==calculation.contribution.proposed.matchingCents||Number(row[0].nonelective_cents)!==calculation.contribution.proposed.nonelectiveCents)throw fail('Employer retirement accounting requires exact retained contribution ledger evidence.')
 }
 return lines
}
