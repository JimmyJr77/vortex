import {allocatedLeaveEarnings} from './allocatedLeaveEarnings.js'
import {allocationEntryCoverage} from './allocationEntryCoverage.js'
import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {calculateAllocatedEarningsWeek} from './regularRateWeek.js'
const fail=message=>Object.assign(new Error(message),{status:409})
export function previewWorkweekAllocation(review,salaryAllocations){
 if(!review||review.issues.length)throw fail('Resolve the workweek time and agreement issues before allocating earnings.')
 if(!Array.isArray(salaryAllocations)||salaryAllocations.some(a=>!a||typeof a.employmentStart!=='string'))throw fail('Provide the documented salary allocations for this workweek.')
 const paidLeave=review.paidLeave||[]
 if(paidLeave.some(l=>l.status!=='APPROVED'||!Number.isSafeInteger(l.minutes)||l.minutes<=0))throw fail('Review approved dated leave evidence before allocating earnings.')
 const salaries=review.agreements.filter(a=>a.payType==='SALARY')
 if(new Set(salaries.map(a=>a.employmentStart)).size!==salaries.length)throw fail('Reconcile salary changes within the workweek before allocating earnings.')
 if(salaries.some(a=>a.salaryReview?.classification!=='NONEXEMPT'||!a.salaryReview?.verifiedAt))throw fail('This allocation requires verified nonexempt salary agreements throughout the workweek.')
 if(salaryAllocations.length!==salaries.length||new Set(salaryAllocations.map(a=>a?.employmentStart)).size!==salaryAllocations.length)throw fail('Provide each salary hiring agreement exactly once.')
 let leaveEarnings
 try{leaveEarnings=allocatedLeaveEarnings(review)}catch(error){throw fail(error.message)}
 const supplied=new Map(salaryAllocations.map(a=>[a.employmentStart,a]))
 const inputs=[],allocations=[],used=new Set()
 for(const agreement of review.agreements){
  const time=review.time.filter(e=>e.workDate>=agreement.start&&e.workDate<=agreement.end)
  for(const entry of time){if(used.has(entry))throw fail('Workweek agreements overlap.');used.add(entry);if(entry.status!=='APPROVED'||!Number.isSafeInteger(entry.minutes)||entry.minutes<0)throw fail('Approve and complete every time entry in the workweek.')}
  const minutes=time.reduce((n,e)=>n+e.minutes,0)
  if(agreement.payType==='HOURLY'){
   if(!Number.isSafeInteger(agreement.hourlyRateCents)||agreement.hourlyRateCents<=0)throw fail('Retain a positive dated hourly rate for every worked portion.')
   allocations.push({minutes,earningsNumerator:(BigInt(minutes)*BigInt(agreement.hourlyRateCents)).toString(),earningsDenominator:60})
   inputs.push({employmentStart:agreement.employmentStart,start:agreement.start,end:agreement.end,payType:'HOURLY',minutes,hourlyRateCents:agreement.hourlyRateCents})
  }else{
   const allocation=supplied.get(agreement.employmentStart),source=String(allocation?.source||'').trim()
   const salaryLeaveCents=leaveEarnings.entries.filter(l=>l.includedInSalary&&l.employmentStart===agreement.employmentStart).reduce((n,l)=>n+l.amountCents,0)
   const workedEarningsCents=allocation?.earningsCents-salaryLeaveCents
   if(!allocation||!Number.isSafeInteger(allocation.earningsCents)||allocation.earningsCents<0||source.length<20||source.length>2000||workedEarningsCents<0||minutes===0&&workedEarningsCents!==0||minutes>0&&workedEarningsCents===0)throw fail('Document a valid straight-time salary allocation and its evidence for every hiring agreement.')
   if(minutes&&BigInt(workedEarningsCents)*60n<BigInt(agreement.salaryReview.minimumWageCents||1500)*BigInt(minutes))throw fail('Allocated salary earnings do not cover the reviewed minimum wage for worked hours.')
   allocations.push({minutes,earningsNumerator:String(workedEarningsCents),earningsDenominator:1})
   inputs.push({employmentStart:agreement.employmentStart,start:agreement.start,end:agreement.end,payType:'SALARY',minutes,earningsCents:workedEarningsCents,totalSalaryCents:allocation.earningsCents,salaryLeaveCents,source})
  }
 }
 if(used.size!==review.time.length)throw fail('Every worked segment must belong to a retained hiring agreement.')
 let calculation,coverage
 try{calculation=calculateAllocatedEarningsWeek(allocations);coverage=allocationEntryCoverage(review,inputs,calculation)}catch(error){throw fail(error.message)}
 // Allocation evidence describes earned wages. Payment history is reconciled
 // separately, so approving the current payroll cannot invalidate its own
 // allocation solely by adding an approved payment record to the review.
 const evidence={employeeId:review.employeeId,week:review.week,end:review.end,agreements:review.agreements,time:review.time,paidLeave,approvedMinutes:review.approvedMinutes,issues:review.issues}
 const fingerprint=createHash('sha256').update(JSON.stringify(compensationEvidence({version:5,evidence,inputs,leaveEarnings,coverageMethod:coverage.method}))).digest('hex')
 return {version:5,paidLeave,leaveEarnings,coverage,status:'DRAFT_ALLOCATION',employeeId:review.employeeId,week:review.week,inputs,calculation,fingerprint,
  paymentApplied:false,reviewRequired:'Verify salary allocation completeness, workweek closure and paid straight-time/premium history before authorizing settlement.'}
}
