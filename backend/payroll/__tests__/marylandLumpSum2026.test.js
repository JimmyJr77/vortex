import test from 'node:test'
import assert from 'node:assert/strict'
import {marylandLumpSum2026} from '../marylandLumpSum2026.js'
const input=()=>({year:2026,workState:'MD',residenceState:'MD',taxableWagesCents:9500,wageBasisVerified:true,lumpSumVerified:true,election:{verified:true,localRate:3.2,filingStatus:'SINGLE',exemptions:0,exempt:false,extraWithholdingCents:0}})
test('Maryland lump-sum calculation uses the published 9.70 percent rate with exact cent rounding',()=>{
 for(const [taxableWagesCents,expected] of [[0,0],[1,0],[5,0],[6,1],[50,5],[500,49],[9500,922],[10000,970],[100000000,9700000]])assert.equal(marylandLumpSum2026({...input(),taxableWagesCents}).stateIncomeTaxCents,expected)
 const maximum=marylandLumpSum2026({...input(),taxableWagesCents:Number.MAX_SAFE_INTEGER})
 assert.ok(Number.isSafeInteger(maximum.stateIncomeTaxCents));assert.equal(BigInt(maximum.stateIncomeTaxCents),(BigInt(Number.MAX_SAFE_INTEGER)*970n+5000n)/10000n)
 assert.equal(maximum.rateBasisPoints,970);assert.equal(maximum.method,'MD_LUMP_SUM');assert.match(maximum.sources.table,/2026\/pm320\.pdf$/)
 const joint=input();joint.election.filingStatus='JOINT';joint.election.exemptions=3
 assert.equal(marylandLumpSum2026(joint).stateIncomeTaxCents,922)
})
test('Maryland lump-sum calculation rejects unsupported or unverified treatment instead of guessing a rate',()=>{
 for(const patch of [{year:2025},{workState:'VA'},{residenceState:'VA'},{lumpSumVerified:false},{wageBasisVerified:false},{taxableWagesCents:-1},{taxableWagesCents:1.5},{taxableWagesCents:'9500'},{taxableWagesCents:Infinity},{taxableWagesCents:Number.MAX_SAFE_INTEGER+1}])assert.throws(()=>marylandLumpSum2026({...input(),...patch}),{status:409})
 for(const patch of [{verified:false},{localRate:3.21},{localRate:'3.2'},{filingStatus:'UNKNOWN'},{exemptions:-1},{exemptions:1.5},{exemptions:100},{exempt:true},{exempt:undefined},{extraWithholdingCents:100},{extraWithholdingCents:undefined}])assert.throws(()=>marylandLumpSum2026({...input(),election:{...input().election,...patch}}),{status:409})
 assert.throws(()=>marylandLumpSum2026({...input(),election:null}),{status:409})
})

test('Maryland local rates use the exact published jurisdiction table mapping and lump-sum rates',()=>{
 const cases=[[2.25,2.25,875],[2.4,2.4,890],[2.65,2.65,915],[2.7,2.75,925],[2.74,2.75,925],[2.75,2.75,925],[2.94,3,950],[2.95,3,950],[2.96,3,950],[3.03,3.05,955],[3.06,3.1,960],[3.2,3.2,970],[3.3,3.3,980]]
 for(const [localRate,tableRate,expected] of cases){
  const result=marylandLumpSum2026({...input(),taxableWagesCents:10000,election:{...input().election,localRate}})
  assert.equal(result.localRate,localRate);assert.equal(result.withholdingTableRate,tableRate);assert.equal(result.stateIncomeTaxCents,expected);assert.equal(result.rateBasisPoints,expected)
  assert.ok(result.sources.table.endsWith(`/pm${Math.round(tableRate*100)}.pdf`))
 }
 // No automatic nearest-rate substitution for an unreviewed value.
 for(const localRate of [2.26,2.8,2.93,3.04,3.19,3.31,null,'2.95'])assert.throws(()=>marylandLumpSum2026({...input(),election:{...input().election,localRate}}),{status:409})
})
