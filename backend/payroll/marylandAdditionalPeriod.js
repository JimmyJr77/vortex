import {createHash} from 'node:crypto'
const fail=message=>Object.assign(new Error(message),{status:409})
const cents=n=>Number.isSafeInteger(n)&&n>=0
const hash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s)
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s
const id=s=>typeof s==='string'&&/^[1-9]\d*$/.test(s)

// Pure allocation only. A loader must retain the signed agreement, select its
// payment-date period, and load scoped approved/finalized evidence while holding
// the employer lock before using this result to reserve any deduction.
export function marylandAdditionalPeriod({employeeId,agreement,period,paymentDate,history,excludeRunId=null}){
 if(!id(employeeId)||!agreement||agreement.verified!==true||agreement.employeeId!==employeeId||agreement.periodBasis!=='PAYMENT_DATE'||!cents(agreement.amountCents)||!hash(agreement.fingerprint)||!hash(agreement.electionFingerprint))throw fail('Verify the employee agreement, amount and payment-date period basis for additional Maryland withholding.')
 if(!period||!id(period.id)||!date(period.start)||!date(period.end)||!date(paymentDate)||paymentDate<period.start||paymentDate>period.end||agreement.payFrequency!==period.payFrequency)throw fail('Select the complete agreed period containing this payment date.')
 const days=(Date.parse(period.end)-Date.parse(period.start))/86400000+1
 const monthEnd=new Date(Date.UTC(Number(period.start.slice(0,4)),Number(period.start.slice(5,7)),0)).toISOString().slice(0,10)
 const complete=period.payFrequency==='WEEKLY'?days===7:period.payFrequency==='BIWEEKLY'?days===14:period.payFrequency==='MONTHLY'?period.start.endsWith('-01')&&period.end===monthEnd:period.payFrequency==='SEMIMONTHLY'?(period.start.endsWith('-01')&&period.end===period.start.slice(0,8)+'15'||period.start.endsWith('-16')&&period.end===monthEnd):false
 if(!complete||history?.reconciled!==true||!Array.isArray(history.evidence)||excludeRunId!==null&&!id(excludeRunId))throw fail('Reconcile the complete agreed period and all approved or paid additional withholding.')
 const applications=[],seen=new Set()
 let applied=0n
 for(const row of history.evidence){
  if(!row||!id(row.runId)||row.employeeId!==employeeId||!date(row.paymentDate)||row.paymentDate<period.start||row.paymentDate>period.end||!['APPROVED','FINALIZED','VOID'].includes(row.status))throw fail('Additional-withholding history has an invalid employee, period, payment date or payroll status.')
  if(seen.has(row.runId))throw fail('Duplicate payroll evidence cannot authorize additional withholding.')
  seen.add(row.runId)
  if(row.status==='VOID'||row.runId===excludeRunId)continue
  if(row.paymentDate>paymentDate)throw fail('Resolve the later committed payment before allocating earlier additional withholding.')
  const detail=row.additionalWithholding
  if(row.reconciled!==true||!hash(row.sourceFingerprint)||detail?.status!=='VERIFIED'||!cents(detail.requestedAdditionalCents)||!cents(detail.appliedAdditionalCents)||detail.appliedAdditionalCents>detail.requestedAdditionalCents||detail.payFrequency!==period.payFrequency||detail.electionFingerprint!==agreement.electionFingerprint||detail.requestedAdditionalCents!==agreement.amountCents)throw fail('Reconcile each prior additional deduction with the current signed agreement and election.')
  applied+=BigInt(detail.appliedAdditionalCents)
  applications.push({runId:row.runId,status:row.status,paymentDate:row.paymentDate,appliedAdditionalCents:detail.appliedAdditionalCents,sourceFingerprint:row.sourceFingerprint})
 }
 if(applied>BigInt(agreement.amountCents))throw fail('Committed additional withholding exceeds the agreed period amount; reconcile the excess before another payment.')
 applications.sort((a,b)=>a.paymentDate.localeCompare(b.paymentDate)||a.runId.localeCompare(b.runId))
 const result={version:1,employeeId,agreementFingerprint:agreement.fingerprint,electionFingerprint:agreement.electionFingerprint,period:{id:period.id,start:period.start,end:period.end,payFrequency:period.payFrequency},paymentDate,requestedAdditionalCents:agreement.amountCents,committedAdditionalCents:Number(applied),remainingAdditionalCents:agreement.amountCents-Number(applied),applications}
 return {...result,fingerprint:createHash('sha256').update(JSON.stringify(result)).digest('hex')}
}
