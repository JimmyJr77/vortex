import {compensationEvidence} from './employmentCompensation.js'
const same=(a,b)=>JSON.stringify(compensationEvidence(a))===JSON.stringify(compensationEvidence(b))
const amounts=rows=>rows?.map(r=>({week:r.week,workedMinutes:r.workedMinutes,straightTimePayCents:r.straightTimePayCents,premiumCents:r.premiumCents})).sort((a,b)=>a.week.localeCompare(b.week))
const fail=()=>{throw new Error('Reconcile finalized correction wages and dated workweek coverage before allocation settlement.')}

export function allocationCorrectionPayment(payment){
 const result=structuredClone(payment),corrections=payment.correctionPayments||[]
 const items=(payment.payItems||[]).filter(i=>i.kind==='WAGE_CORRECTION')
 if(items.length!==corrections.length||new Set(corrections.map(c=>c.id)).size!==corrections.length||new Set(corrections.map(c=>`${c.authorizationId}:${c.requestId}`)).size!==corrections.length)fail()
 let excluded=0
 for(const c of corrections){
  const matches=items.filter(i=>i.correction?.authorizationId===c.authorizationId&&i.correction?.requestId===c.requestId&&i.amountCents===c.amountCents)
  if(matches.length!==1||!Number.isSafeInteger(c.id)||c.id<=0||!Number.isSafeInteger(c.amountCents)||c.amountCents<=0)fail()
  excluded+=c.amountCents
 }
 if(!Number.isSafeInteger(excluded)||excluded>payment.otherTaxablePayCents)fail()
 result.otherTaxablePayCents-=excluded
 result.correctionPaymentExclusions=structuredClone(corrections)
 const basis=payment.correctionCoverage
 if(!basis)return result
 const proofs=basis.workweekCorrections
 if(!Array.isArray(proofs)||!proofs.length||proofs.length!==basis.settlementIds.length||new Set(basis.settlementIds).size!==proofs.length||new Set(proofs.map(p=>p.settlementId)).size!==proofs.length)fail()
 let records=payment.workweekPayments
 for(const proof of proofs){
  if(proof.version!==1||proof.runId!==payment.runId||!Array.isArray(proof.original)||!Array.isArray(proof.corrected)||!basis.settlementIds.includes(proof.settlementId)||!same(amounts(records),amounts(proof.original)))fail()
  records=proof.corrected
 }
 if(records.reduce((n,r)=>n+r.workedMinutes,0)!==basis.regularMinutes+basis.overtimeMinutes||records.reduce((n,r)=>n+r.straightTimePayCents+r.premiumCents,0)!==basis.regularPayCents+basis.overtimePayCents)fail()
 for(const key of ['regularMinutes','overtimeMinutes','regularPayCents','overtimePayCents'])result[key]=basis[key]
 result.workweekPayments=structuredClone(records)
 result.frozenCalculation={...result.frozenCalculation,...Object.fromEntries(['regularMinutes','overtimeMinutes','regularPayCents','overtimePayCents','entries'].map(k=>[k,structuredClone(basis[k])]))}
 result.correctionSettlementIds=[...basis.settlementIds]
 return result
}
