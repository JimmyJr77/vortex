import test from 'node:test'
import assert from 'node:assert/strict'
import {calculatePtoState,ptoStateMethodInput} from '../ptoStateCalculation.js'
import {marylandAdditionalPeriod} from '../marylandAdditionalPeriod.js'
import {marylandElectionFingerprint} from '../marylandElectionFingerprint.js'
import {ptoStateReviewBasis} from '../ptoStateWithholding.js'

function basis(patch={}){
 return ptoStateReviewBasis({year:2026,payFrequency:'SEMIMONTHLY',employeeId:'2',paymentDate:'2026-09-24',workState:'MD',residenceState:'MD',federalIncomeTaxCents:2090,grossWagesCents:10000,marylandWagesCents:9500,pretaxCents:500,taxElection:{verified:true,maryland:{localRate:3.2,filingStatus:'SINGLE',exemptions:0,exempt:false,extraWithholdingCents:0}},...patch})
}
function review(b){return {basisFingerprint:b.fingerprint,stateIncomeTaxCents:760,sourceReference:'Reviewed exact payout and withholding calculation',confirmed:true}}
function calculate(context={},b=basis(),patch={}){return calculatePtoState({context,basis:b,wageBasisVerified:true,lumpSumVerified:true,...patch})}

test('new PTO state calculation uses taxable wages after pretax deferrals and retains its exact basis',()=>{
 const b=basis(),result=calculate({},b)
 assert.equal(result.stateMethod,'MD_LUMP_SUM')
 assert.equal(result.stateIncomeTaxCents,922)
 assert.equal(result.calculation.taxableWagesCents,9500)
 assert.equal(result.calculation.basisFingerprint,b.fingerprint)
 assert.equal(result.calculation.rateBasisPoints,970)
 assert.match(result.calculation.sources.table,/pm320\.pdf$/)
 assert.equal(calculate({},basis({marylandWagesCents:10000,pretaxCents:0})).stateIncomeTaxCents,970)
 assert.equal(calculate({stateMethod:'MD_LUMP_SUM'},b).stateIncomeTaxCents,922)
})

test('retained reviewed PTO amounts remain reviewed and reject changed source evidence',()=>{
 const b=basis(),context={stateWithholdingReview:review(b)}
 const result=calculate(context,b)
 assert.equal(result.stateMethod,'REVIEWED')
 assert.equal(result.stateIncomeTaxCents,760)
 assert.equal(result.review.basisFingerprint,b.fingerprint)
 assert.equal(result.calculation,undefined)
 assert.equal(calculate({...context,stateMethod:'REVIEWED'},b).stateIncomeTaxCents,760)
 for(const patch of [{marylandWagesCents:9400},{federalIncomeTaxCents:2100},{historyFingerprint:'updated-history'},{taxElection:{...b.taxElection,maryland:{...b.taxElection.maryland,localRate:3.3}}}]){
  assert.throws(()=>calculate(context,basis(patch)),{status:409})
 }
})

test('PTO state method selection rejects conflicting amounts and never falls back on unsupported automatic treatment',()=>{
 const b=basis()
 assert.throws(()=>calculate({stateMethod:'MD_LUMP_SUM',stateWithholdingReview:review(b)},b),{status:409})
 assert.throws(()=>calculate({stateMethod:'REVIEWED'},b),{status:409})
 for(const stateMethod of [null,'',false,'FLAT_22','AUTO'])assert.throws(()=>ptoStateMethodInput({stateMethod}),{status:409})
 for(const patch of [{wageBasisVerified:false},{lumpSumVerified:false}])assert.throws(()=>calculate({},b,patch),{status:409})
 for(const patch of [{verified:false},{maryland:{...b.taxElection.maryland,exempt:true}},{maryland:{...b.taxElection.maryland,extraWithholdingCents:100}}])assert.throws(()=>calculate({},basis({taxElection:{...b.taxElection,...patch}})),{status:409})
})


test('native PTO applies only remaining agreed additional withholding and rejects altered allocation evidence',()=>{
 const election={...basis().taxElection.maryland,extraWithholdingCents:500},fingerprint=marylandElectionFingerprint(election)
 for(const committed of [0,200,500]){
  const allocation=marylandAdditionalPeriod({employeeId:'2',agreement:{verified:true,employeeId:'2',periodBasis:'PAYMENT_DATE',amountCents:500,payFrequency:'SEMIMONTHLY',fingerprint:'a'.repeat(64),electionFingerprint:fingerprint},period:{id:'10',start:'2026-09-16',end:'2026-09-30',payFrequency:'SEMIMONTHLY'},paymentDate:'2026-09-24',history:{reconciled:true,evidence:committed?[{runId:'1',employeeId:'2',status:'FINALIZED',paymentDate:'2026-09-22',reconciled:true,sourceFingerprint:'c'.repeat(64),additionalWithholding:{status:'VERIFIED',requestedAdditionalCents:500,appliedAdditionalCents:committed,payFrequency:'SEMIMONTHLY',electionFingerprint:fingerprint}}]:[]}})
  const b=basis({taxElection:{verified:true,maryland:election},marylandAdditionalAllocation:allocation}),result=calculate({},b)
  assert.equal(result.stateIncomeTaxCents,922+500-committed)
  assert.equal(result.calculation.baseIncomeTaxCents,922)
  assert.equal(result.stateTaxComponents.requestedAdditionalCents,500)
  assert.equal(result.stateTaxComponents.appliedAdditionalCents,500-committed)
  for(const patch of [{remainingAdditionalCents:501},{committedAdditionalCents:999},{employeeId:'3'},{paymentDate:'2026-09-25'},{fingerprint:'d'.repeat(64)},{applications:[]}]){
   if(patch.applications&&committed===0)continue
   assert.throws(()=>calculate({},basis({...b,marylandAdditionalAllocation:{...allocation,...patch}})),{status:409})
  }
 }
})
