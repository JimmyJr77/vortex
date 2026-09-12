const fail=()=>{throw new Error('Reconcile retained standard 401(k) annual contribution reporting.')}
const decimal=value=>typeof value==='string'&&/^\d+\.\d{2}$/.test(value)
export function retirementW2Codes(report){
 if(report?.year!==2026||report.status!=='RECONCILED'||report.hasEmployeeDeferrals!==true||!Array.isArray(report.records)||!report.records.length||!decimal(report.pretaxDeferrals)||!decimal(report.rothDeferrals))fail()
 let pretax=0n,roth=0n;const seen=new Set()
 for(const r of report.records){
  const key=`${r.runId}:${r.planId}`
  if(typeof r.runId!=='string'||!/^\d+$/.test(r.runId)||typeof r.planId!=='string'||!r.planId||seen.has(key)||typeof r.paymentDate!=='string'||!/^2026-\d{2}-\d{2}$/.test(r.paymentDate)||!Number.isFinite(Date.parse(r.paymentDate))||new Date(r.paymentDate).toISOString().slice(0,10)!==r.paymentDate)fail()
  seen.add(key)
  for(const k of ['ordinaryPretaxCents','ordinaryRothCents','catchUpPretaxCents','catchUpRothCents'])if(!Number.isSafeInteger(r[k])||r[k]<0)fail()
  pretax+=BigInt(r.ordinaryPretaxCents)+BigInt(r.catchUpPretaxCents);roth+=BigInt(r.ordinaryRothCents)+BigInt(r.catchUpRothCents)
 }
 if(pretax+roth===0n||pretax!==BigInt(report.pretaxDeferrals.replace('.',''))||roth!==BigInt(report.rothDeferrals.replace('.','')))fail()
 return [...(pretax>0n?[{code:'D',amount:report.pretaxDeferrals}]:[]),...(roth>0n?[{code:'AA',amount:report.rothDeferrals}]:[])]
}
