import {createHash} from 'node:crypto'
const day=v=>v instanceof Date?v.toISOString().slice(0,10):String(v||'').slice(0,10)
const valid=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&day(new Date(v))===v
const add=(v,n)=>day(new Date(Date.parse(v)+n*86400000))
const fail=message=>Object.assign(new Error(message),{status:409})
const sum=(values,label)=>{const n=values.reduce((a,b)=>a+b,0);if(values.some(v=>!Number.isSafeInteger(v)||v<0)||!Number.isSafeInteger(n))throw fail(`Reconcile ${label} before aggregate withholding.`);return n}
// IRS Publication 15 section 7: use paid current/preceding regular wages and
// subtract actual regular and earlier supplemental withholding once.
export function reconcileAggregateBasis(history,currentPeriod,paymentDate){
 if(history.reconciled!==true||!valid(paymentDate))throw fail('Reconcile payment history before aggregate withholding.')
 const start=day(currentPeriod?.period_start),end=day(currentPeriod?.period_end),frequency=currentPeriod?.frequency
 if(!valid(start)||!valid(end)||paymentDate<start||paymentDate>end)throw fail('Generate the payroll period containing this payment date before aggregate withholding.')
 const weekly=frequency==='WEEKLY'?7:frequency==='BIWEEKLY'?14:0
 const monthEnd=valid(start)?day(new Date(Date.UTC(Number(start.slice(0,4)),Number(start.slice(5,7)),0))):''
 const normal=weekly?end===add(start,weekly-1):frequency==='MONTHLY'?start.endsWith('-01')&&end===monthEnd:frequency==='SEMIMONTHLY'?(start.endsWith('-01')&&end===start.slice(0,8)+'15'||start.endsWith('-16')&&end===monthEnd):false
 if(!normal)throw fail('Aggregate withholding requires a complete supported payroll period.')
 const previousEnd=add(start,-1)
 const previousStart=weekly?add(start,-weekly):frequency==='MONTHLY'?previousEnd.slice(0,8)+'01':start.endsWith('-16')?start.slice(0,8)+'01':previousEnd.slice(0,8)+'16'
 const all=history.evidence.filter(e=>e.paymentDate<=paymentDate)
 const candidates=all.filter(e=>e.runKind==='REGULAR'&&e.payFrequency===frequency&&((e.periodStart===start&&e.periodEnd===end)||(e.periodStart===previousStart&&e.periodEnd===previousEnd)))
 if(!candidates.length)throw fail('Finalize a current or immediately preceding regular payroll before aggregate withholding.')
 candidates.sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd)||b.paymentDate.localeCompare(a.paymentDate))
 const basis=candidates[0]
 if(candidates.filter(e=>e.periodStart===basis.periodStart).length!==1)throw fail('The selected regular payroll has duplicate finalized wage evidence.')
 if(basis.supplementalCents!==0)throw fail('Separate regular and supplemental withholding in the source payroll before aggregate withholding.')
 if(basis.paymentDate.slice(0,4)!==paymentDate.slice(0,4))throw fail('Cross-year aggregate payroll requires a separately reviewed calculation.')
 const inPeriod=all.filter(e=>e.paymentDate>=start&&e.runId!==basis.runId)
 if(inPeriod.some(e=>e.runKind==='REGULAR'&&e.grossCents>0))throw fail('Multiple regular wage payments require a reviewed aggregate basis.')
 if(inPeriod.some(e=>(e.incomeTaxGrossCents??e.grossCents)!==e.supplementalCents))throw fail('Reconcile ordinary wages in earlier payments before aggregate withholding.')
 const previousSupplementalCents=sum(inPeriod.map(e=>e.supplementalCents),'earlier supplemental wages')
 const previousFederalWithheldCents=sum(inPeriod.map(e=>e.federalIncomeTaxCents),'earlier supplemental withholding')
 const result={version:1,regularRunId:basis.runId,currentPeriodId:Number(currentPeriod.id),periodStart:start,periodEnd:end,payFrequency:frequency,regularWagesCents:sum([basis.incomeTaxGrossCents??basis.grossCents],'regular wages'),regularFederalWithheldCents:sum([basis.federalIncomeTaxCents],'regular withholding'),previousSupplementalCents,previousFederalWithheldCents,previousRunIds:inPeriod.map(e=>e.runId).sort((a,b)=>a-b),historyFingerprint:history.fingerprint}
 return {...result,fingerprint:createHash('sha256').update(JSON.stringify(result)).digest('hex')}
}
export async function loadAggregatePaymentBasis(db,facility,history,paymentDate){
 const periods=(await db.query("SELECT * FROM payroll_pay_period WHERE facility_id=$1 AND status<>'VOID' AND $2::date BETWEEN period_start AND period_end",[facility,paymentDate])).rows
 if(periods.length!==1)throw fail('Generate one unambiguous payroll period containing this payment date before aggregate withholding.')
 return reconcileAggregateBasis(history,periods[0],paymentDate)
}
