const fail=message=>{throw Object.assign(new Error(message),{code:'CORRECTION_LEAVE_CONTEXT_REQUIRED'})}
const safe=n=>Number.isSafeInteger(n)&&n>=0
export function correctionLeaveContext({plan,calculationId,fingerprint,paymentDate,balanceMinutes,yearAccruedMinutes,remainder,eligibility}){
 if(plan?.version!==1||plan.status!=='LEAVE_DIFFERENCE_CALCULATED'||!Array.isArray(plan.items)||!plan.items.length)fail('A complete correction leave replay is required for the target payroll.')
 const last=plan.items.at(-1)
 if(String(remainder.sourceRunId)!==String(plan.throughRunId)||String(last.runId)!==String(plan.throughRunId)||remainder.remainder!==last.remainderBefore)fail('The target payroll no longer uses the reviewed final leave fraction source.')
 if(plan.items.some(i=>!i.paymentDate||i.paymentDate.slice(0,4)!==paymentDate.slice(0,4)||i.paymentDate>paymentDate))fail('Reconcile leave-year carryover or payment chronology before applying this correction to the target payroll.')
 if(!Number.isSafeInteger(plan.creditDifferenceMinutes)||plan.items.reduce((n,i)=>n+i.deltaMinutes,0)!==plan.creditDifferenceMinutes||!safe(plan.finalRemainder)||plan.finalRemainder>=30||last.remainderAfter!==plan.finalRemainder)fail('The correction leave totals or ending fraction do not reconcile.')
 const balance=balanceMinutes+plan.creditDifferenceMinutes,year=yearAccruedMinutes+plan.creditDifferenceMinutes
 if(!safe(balanceMinutes)||!safe(yearAccruedMinutes)||!safe(balance)||!safe(year))fail('The correction would leave insufficient balance or invalid annual accrual in the target payroll.')
 let correctedEligibility=eligibility
 const prior=plan.items.find(i=>String(i.runId)===String(eligibility?.priorRunId))
 if(prior){if(eligibility.priorWorkedMinutes!==prior.workedMinutesBefore)fail('The target payroll has different preceding-period hours from the correction evidence.');correctedEligibility={...eligibility,priorWorkedMinutes:prior.workedMinutesAfter}}
 return {balanceMinutes:balance,yearAccruedMinutes:year,eligibility:correctedEligibility,remainder:{...remainder,remainder:plan.finalRemainder,source:'CORRECTION_PREVIEW'},evidence:{version:1,calculationId,fingerprint,throughRunId:plan.throughRunId,creditDifferenceMinutes:plan.creditDifferenceMinutes,originalBalanceMinutes:balanceMinutes,originalYearAccruedMinutes:yearAccruedMinutes,originalRemainder:remainder.remainder}}
}
