import test from 'node:test'
import assert from 'node:assert/strict'
import {retirementAnnualInput} from '../retirementAnnualInput.js'
import {retirementAnnualFixture} from '../testing/retirementAnnualFixture.js'
const employerFunding=()=>({compensationCents:1000000,matchingCents:30000,nonelectiveCents:20000,reference:'Retained external employer funding and compensation records.'})
const input=()=>({...retirementAnnualFixture(),externalOrdinaryDeferralsCents:10000,externalPlanOrdinaryDeferralsCents:10000,externalAnnualAdditionsCents:60000})
test('external employer sources are canonical and distinct from employee compensation, preserving legacy fingerprints',()=>{
 const original=retirementAnnualInput(input()),funding=employerFunding(),saved=retirementAnnualInput({...input(),employerFunding:funding})
 assert.equal(original.employerFunding,undefined);assert.deepEqual(saved.employerFunding,funding)
 assert.equal(saved.externalPlanCompensationCents,0);assert.equal(saved.employerFunding.compensationCents,1000000)
 assert.notEqual(original.fingerprint,saved.fingerprint)
 assert.equal(retirementAnnualInput({...saved,confirmed:true}).fingerprint,saved.fingerprint)
 assert.equal(retirementAnnualInput({...input(),employerFunding:Object.fromEntries(Object.entries(funding).reverse())}).fingerprint,saved.fingerprint)
 assert.equal(retirementAnnualInput({...input(),employerFunding:undefined}).fingerprint,original.fingerprint)
 for(const patch of [{compensationCents:1000001},{matchingCents:29999},{nonelectiveCents:19999},{reference:'Changed external employer source evidence reference.'}])assert.notEqual(retirementAnnualInput({...input(),employerFunding:{...funding,...patch}}).fingerprint,saved.fingerprint)
})
test('annual additions include employer components and ordinary deferrals without including employee catch-up',()=>{
 const base={...input(),externalCatchUpDeferralsCents:999999,externalPlanCatchUpDeferralsCents:999999,employerFunding:employerFunding()}
 assert.equal(retirementAnnualInput(base).externalAnnualAdditionsCents,60000)
 assert.throws(()=>retirementAnnualInput({...base,externalAnnualAdditionsCents:59999}),/annual additions must include/)
 assert.equal(retirementAnnualInput({...retirementAnnualFixture(),employerFunding:{compensationCents:0,matchingCents:0,nonelectiveCents:0,reference:'Reviewed explicit zero external employer balances.'}}).employerFunding.matchingCents,0)
 assert.throws(()=>retirementAnnualInput({...base,externalAnnualAdditionsCents:Number.MAX_SAFE_INTEGER,employerFunding:{...base.employerFunding,matchingCents:Number.MAX_SAFE_INTEGER}}),/annual additions must include/)
})
test('missing balances and malformed employer source evidence cannot become verified zero amounts',()=>{
 for(const bad of [null,[],{}, {...employerFunding(),matchingCents:undefined},{...employerFunding(),matchingCents:-1},{...employerFunding(),nonelectiveCents:'20000'},{...employerFunding(),compensationCents:0.1},{...employerFunding(),compensationCents:Number.MAX_SAFE_INTEGER+1},{...employerFunding(),reference:'short'},{...employerFunding(),reference:'Invalid\u0000 employer reference'},{...employerFunding(),enabled:true}])assert.throws(()=>retirementAnnualInput({...input(),employerFunding:bad}),{status:400})
})
