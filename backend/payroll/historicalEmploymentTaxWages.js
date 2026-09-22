import {historicalAnnualPaymentDetail} from './historicalAnnualPaymentDetail.js'
import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'

export const historicalEmploymentWageKeys=['socialSecurityWagesCents','medicareWagesCents','futaWagesCents','marylandUnemploymentWagesCents']
const fail=message=>Object.assign(new Error(message),{status:409})
const hash=value=>createHash('sha256').update(JSON.stringify(compensationEvidence(value))).digest('hex')
const id=value=>{
 if(typeof value==='number'&&!Number.isSafeInteger(value))throw fail('Use an exact retained payroll identity.')
 const text=String(value)
 if(!/^[1-9]\d*$/.test(text)||BigInt(text)>9223372036854775807n)throw fail('Use a valid retained payroll identity.')
 return text
}
const day=value=>{
 const text=value instanceof Date?value.toISOString().slice(0,10):value
 if(typeof text!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(text)||!Number.isFinite(Date.parse(text))||new Date(text).toISOString().slice(0,10)!==text)throw fail('Use valid payment and work-period dates.')
 return text
}
const money=value=>{
 if(!((typeof value==='number'&&Number.isSafeInteger(value))||(typeof value==='string'&&/^(0|[1-9]\d*)$/.test(value))))throw fail('Retain exact whole-cent payment amounts.')
 const amount=BigInt(value)
 if(amount<0n||amount>BigInt(Number.MAX_SAFE_INTEGER))throw fail('Payment amounts exceed supported precision.')
 return Number(amount)
}

// This source is a review proposal, not proof of taxable wages. The eventual
// database reader must load a current, scoped, immutable administrator review.
export function historicalEmploymentWageSource(rows,{facilityId,employeeId,paymentDate}){
 const facility=id(facilityId),employee=id(employeeId),through=day(paymentDate),seen=new Set()
 if(!through.startsWith('2026-'))throw fail('Use a supported 2026 payroll payment date.')
 const payments=rows.map(row=>{
  if(id(row.facility_id)!==facility||id(row.employee_id)!==employee)throw fail('Imported payroll belongs to another employee or workplace.')
  const paymentId=id(row.id);if(seen.has(paymentId))throw fail('Imported payroll evidence contains duplicate payments.');seen.add(paymentId)
  const periodStart=day(row.period_start),periodEnd=day(row.period_end),paidOn=day(row.payment_date)
  if(!paidOn.startsWith('2026-')||periodStart>periodEnd||periodEnd>paidOn||paidOn>through)throw fail('Imported payroll falls outside the reviewed payment order.')
  const grossCents=money(row.gross_amount_cents),taxCents=money(row.employee_tax_withheld_cents),netCents=money(row.net_amount_cents)
  if(grossCents===0||BigInt(taxCents)+BigInt(netCents)!==BigInt(grossCents))throw fail('Reconcile the imported gross, withheld taxes and net paid before reviewing taxable wages.')
  if(!['CHECK','ACH','CASH','WIRE'].includes(row.method))throw fail('Retain the imported payment method.')
  return {paymentId,periodStart,periodEnd,paymentDate:paidOn,grossCents,taxCents,netCents,method:row.method,reference:row.reference??null,evidence:row.evidence_note??null,source:row.source??null}
 }).sort((a,b)=>a.paymentDate.localeCompare(b.paymentDate)||(BigInt(a.paymentId)<BigInt(b.paymentId)?-1:1))
 const source={version:1,facilityId:facility,employeeId:employee,year:2026,payments}
 return {...source,fingerprint:hash(source)}
}

export function historicalEmploymentWageReview(source,input){
 if(input?.sourceFingerprint!==source.fingerprint)throw fail('Imported payments changed. Refresh the taxable-wage review.')
 if(!['REVIEWED','UNRESOLVED'].includes(input.disposition)||input.confirmed!==true)throw fail('Confirm the imported taxable-wage review or mark it unresolved.')
 if(typeof input.reference!=='string'||input.reference.trim().length<20||input.reference.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.reference))throw fail('Retain a clear source reference for this review.')
 if(input.disposition==='UNRESOLVED')return {version:1,sourceFingerprint:source.fingerprint,disposition:'UNRESOLVED',reference:input.reference.trim(),confirmed:true}
 if(input.sameEmployerConfirmed!==true||input.uncappedWagesConfirmed!==true||input.completeHistoryConfirmed!==true)throw fail('Confirm the same employer, complete payment history and uncapped taxable wages.')
 if(!Array.isArray(input.payments)||input.payments.length!==source.payments.length||source.payments.length===0)throw fail('Review each imported payment exactly once.')
 const seen=new Set(),payments=input.payments.map(item=>{
  const paymentId=id(item?.paymentId),retained=source.payments.find(row=>row.paymentId===paymentId)
  if(!retained||seen.has(paymentId))throw fail('Review each imported payment exactly once.');seen.add(paymentId)
  const wages={}
  for(const key of historicalEmploymentWageKeys){
   const value=item?.wages?.[key]
   if(!Number.isSafeInteger(value)||value<0||value>retained.grossCents)throw fail('Enter each uncapped taxable-wage basis in whole cents within the retained gross wages.')
   wages[key]=value
  }
  return {paymentId,paymentDate:retained.paymentDate,wages,...(item.annualDetail!==undefined?{annualDetail:historicalAnnualPaymentDetail(retained,wages,item.annualDetail)}:{})}
 }).sort((a,b)=>a.paymentDate.localeCompare(b.paymentDate)||(BigInt(a.paymentId)<BigInt(b.paymentId)?-1:1))
 for(const key of historicalEmploymentWageKeys)if(payments.reduce((sum,p)=>sum+BigInt(p.wages[key]),0n)>BigInt(Number.MAX_SAFE_INTEGER))throw fail('Imported taxable-wage totals exceed supported precision.')
 return {version:1,sourceFingerprint:source.fingerprint,disposition:'REVIEWED',reference:input.reference.trim(),confirmed:true,sameEmployerConfirmed:true,uncappedWagesConfirmed:true,completeHistoryConfirmed:true,payments}
}
