import test from 'node:test'
import assert from 'node:assert/strict'
import {retirement401kLimits} from '../retirement401kLimits.js'
const input={taxYear:2026,planType:'STANDARD_401K',ageAtYearEnd:50,allowsCatchUp:true,allowsHigherCatchUp:true,allowsRoth:true,priorYearSponsorFicaWagesCents:0}
test('2026 standard 401(k) ceilings distinguish each age and plan-permission boundary',()=>{
 for(const [age,catchup] of [[49,0],[50,800000],[59,800000],[60,1125000],[61,1125000],[62,1125000],[63,1125000],[64,800000]]){
  const result=retirement401kLimits({...input,ageAtYearEnd:age});assert.equal(result.statutoryOrdinaryLimitCents,2450000);assert.equal(result.statutoryCatchUpLimitCents,catchup);assert.equal(result.statutoryCombinedLimitCents,2450000+catchup)
 }
 assert.equal(retirement401kLimits({...input,ageAtYearEnd:60,allowsHigherCatchUp:false}).statutoryCatchUpLimitCents,800000)
 assert.equal(retirement401kLimits({...input,allowsCatchUp:false,allowsHigherCatchUp:false,priorYearSponsorFicaWagesCents:null}).statutoryCatchUpLimitCents,0)
})
test('Roth catch-up uses the strict prior-year sponsor wage threshold and requires explicit evidence',()=>{
 assert.equal(retirement401kLimits({...input,priorYearSponsorFicaWagesCents:15000000}).rothCatchUpRequired,false)
 const above=retirement401kLimits({...input,priorYearSponsorFicaWagesCents:15000001});assert.equal(above.rothCatchUpRequired,true);assert.equal(above.catchUpTreatmentReady,true)
 const blocked=retirement401kLimits({...input,priorYearSponsorFicaWagesCents:15000001,allowsRoth:false});assert.equal(blocked.catchUpTreatmentReady,false);assert.equal(blocked.issues.length,1)
 assert.equal(retirement401kLimits({...input,ageAtYearEnd:49,priorYearSponsorFicaWagesCents:15000001,allowsRoth:false}).rothCatchUpRequired,false)
 for(const value of [null,undefined])assert.throws(()=>retirement401kLimits({...input,priorYearSponsorFicaWagesCents:value}),/unknown is not zero/)
})
test('retirement ceilings reject unsupported years, plan types and ambiguous numeric or feature inputs',()=>{
 for(const patch of [{taxYear:2027},{planType:'SIMPLE_401K'},{planType:'403B'},{ageAtYearEnd:'60'},{ageAtYearEnd:60.5},{ageAtYearEnd:-1},{ageAtYearEnd:121},{allowsCatchUp:null},{allowsRoth:undefined},{allowsHigherCatchUp:'true'},{allowsCatchUp:false},{priorYearSponsorFicaWagesCents:-1},{priorYearSponsorFicaWagesCents:NaN},{priorYearSponsorFicaWagesCents:Number.MAX_SAFE_INTEGER+1},{priorYearSponsorFicaWagesCents:'15000000'}])assert.throws(()=>retirement401kLimits({...input,...patch}),{status:400})
})
