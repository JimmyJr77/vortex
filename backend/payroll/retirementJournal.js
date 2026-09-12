const fail=message=>Object.assign(new Error(message),{status:409})
const add=(a,b)=>{if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<0||!Number.isSafeInteger(a+b))throw fail('Retirement accounting requires exact nonnegative cents.');return a+b}
export function retirementJournalLines(run){
 const employees=run.calculation_snapshot?.employees||[]
 const participating=employees.filter(e=>e.retirementPlans?.length||e.retirement401k||e.payItems?.some(i=>i.kind?.startsWith('RETIREMENT_')))
 if(!participating.length)return []
 if(new Set(employees.map(e=>String(e.employeeId))).size!==employees.length)throw fail('Reconcile duplicate employee retirement evidence.')
 if(employees.reduce((sum,e)=>add(sum,e.totalDeductionCents),0)!==Number(run.deduction_cents))throw fail('Retirement deductions do not reconcile to finalized payroll.')
 const grouped=new Map()
 for(const employee of participating){
  if(!employee.retirementPlans?.length)throw fail('Retirement deductions require retained plan calculations.')
  const seen=new Set();let pretax=0,roth=0
  for(const entry of employee.retirementPlans){
   const c=entry.calculation
   if(!entry.planId||seen.has(entry.planId)||c?.requiresPayrollIntegration!==false)throw fail('Retirement accounting requires integrated, unique plan evidence.')
   seen.add(entry.planId)
   const p=add(c.ordinary?.pretax,c.catchUp?.pretax),r=add(c.ordinary?.roth,c.catchUp?.roth)
   if(p!==c.pretaxCents||r!==c.rothCents||add(p,r)!==c.totalCents)throw fail('Retirement contribution components do not reconcile.')
   pretax=add(pretax,p);roth=add(roth,r)
   for(const [category,treatment,amount] of [['ordinary','pretax',c.ordinary.pretax],['ordinary','Roth',c.ordinary.roth],['catch-up','pretax',c.catchUp.pretax],['catch-up','Roth',c.catchUp.roth]]){
    const description=`401(k) ${entry.planId}: ${category} ${treatment} employee deferrals`
    grouped.set(description,add(grouped.get(description)||0,amount))
   }
  }
  add(0,employee.pretaxDeductionCents);add(0,employee.posttaxDeductionCents)
  const items=employee.payItems||[]
  const itemTotal=kind=>items.filter(i=>i.kind===kind).reduce((sum,i)=>add(sum,i.amountCents),0)
  if(items.some(i=>i.kind?.startsWith('RETIREMENT_')&&!['RETIREMENT_401K_PRETAX','RETIREMENT_401K_ROTH'].includes(i.kind))||itemTotal('RETIREMENT_401K_PRETAX')!==pretax||itemTotal('RETIREMENT_401K_ROTH')!==roth||employee.retirement401k?.pretaxCents!==pretax||employee.retirement401k?.rothCents!==roth||pretax>employee.pretaxDeductionCents||roth>employee.posttaxDeductionCents||add(pretax,roth)>employee.totalDeductionCents)throw fail('Retirement statement and deduction evidence do not reconcile.')
 }
 return [...grouped.entries()].filter(([,amount])=>amount>0).sort(([a],[b])=>a.localeCompare(b)).map(([description,amount])=>['retirement',amount,'Credit',description])
}
export async function verifyRetirementPosting(db,run){
 const lines=retirementJournalLines(run)
 if(!run.calculation_snapshot?.employees?.some(e=>e.retirementPlans?.length))return
 for(const employee of run.calculation_snapshot.employees.filter(e=>e.retirementPlans?.length)){
  const posted=(await db.query('SELECT pretax_deduction_cents,posttax_deduction_cents FROM payroll_run_employee WHERE payroll_run_id=$1 AND employee_id=$2',[run.id,employee.employeeId])).rows
  if(posted.length!==1||Number(posted[0].pretax_deduction_cents)!==employee.pretaxDeductionCents||Number(posted[0].posttax_deduction_cents)!==employee.posttaxDeductionCents)throw fail('Posted retirement deductions differ from finalized employee evidence.')
  for(const entry of employee.retirementPlans){
   const row=(await db.query('SELECT calculation=$5::jsonb AS same FROM payroll_retirement_run_ledger WHERE facility_id=$1 AND run_id=$2 AND employee_id=$3 AND plan_id=$4',[run.facility_id,run.id,employee.employeeId,entry.planId,entry.calculation])).rows
   if(row.length!==1||!row[0].same)throw fail('Retirement accounting requires exact retained payroll ledger evidence.')
  }
 }
 return lines
}
