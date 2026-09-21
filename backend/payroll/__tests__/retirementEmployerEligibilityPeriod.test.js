import test from 'node:test'
import assert from 'node:assert/strict'
import {employerEligibilityPeriod} from '../retirementEmployerEligibilityPeriod.js'
const source={fingerprint:'a'.repeat(64),employerFormula:{},employerContributions:'MATCH_AND_NONELECTIVE',hireDate:'2026-09-01',planEffectiveOn:'2026-01-01'}
const row=()=>({id:'review-1',source_fingerprint:source.fingerprint,review:{assessedFrom:'2026-09-01',assessedThrough:'2026-09-30',reference:'Reviewed actual service and eligibility for the assessed period.',matching:{status:'ELIGIBLE',eligibleOn:'2026-09-01',vestedBps:0},nonelective:{status:'ELIGIBLE',eligibleOn:'2026-09-01',vestedBps:10000}}})
test('dated eligibility preserves independent findings and binds review, period and vesting evidence',()=>{
 const r=row(),result=employerEligibilityPeriod(source,r,'2026-09-01','2026-09-15')
 assert.equal(result.components.matching.eligible,true);assert.equal(result.components.matching.vestedBps,0)
 assert.equal(result.components.nonelective.eligible,true)
 assert.equal(employerEligibilityPeriod(source,r,'2026-09-01','2026-09-15').fingerprint,result.fingerprint)
 assert.notEqual(employerEligibilityPeriod(source,r,'2026-09-01','2026-09-16').fingerprint,result.fingerprint)
 assert.notEqual(employerEligibilityPeriod(source,{...r,id:'review-2'},'2026-09-01','2026-09-15').fingerprint,result.fingerprint)
 r.review.matching={status:'NOT_ELIGIBLE',eligibleOn:null,vestedBps:null}
 const changed=employerEligibilityPeriod(source,r,'2026-09-01','2026-09-15')
 assert.equal(changed.components.matching.eligible,false);assert.equal(changed.components.nonelective.eligible,true)
})
test('assessment scope cannot be extended or assumed for old reviews without start dates',()=>{
 for(const dates of [['2026-08-31','2026-09-15'],['2026-09-01','2026-10-01'],['2026-09-15','2026-09-01'],['2027-01-01','2027-01-15'],['2026-02-30','2026-03-01']])assert.throws(()=>employerEligibilityPeriod(source,row(),...dates),{status:409})
 const legacy=row();delete legacy.review.assessedFrom
 assert.throws(()=>employerEligibilityPeriod(source,legacy,'2026-09-01','2026-09-15'),/explicit current assessment/)
 assert.throws(()=>employerEligibilityPeriod(source,{...row(),source_fingerprint:'b'.repeat(64)},'2026-09-01','2026-09-15'),/current employer eligibility/)
 assert.throws(()=>employerEligibilityPeriod(source,null,'2026-09-01','2026-09-15'),/current employer eligibility/)
})
test('entry inside a payroll period requires dated wages, while periods wholly before and after entry are explicit',()=>{
 const r=row();r.review.matching.eligibleOn='2026-09-10'
 assert.throws(()=>employerEligibilityPeriod(source,r,'2026-09-01','2026-09-15'),/dated compensation/)
 assert.equal(employerEligibilityPeriod(source,r,'2026-09-01','2026-09-09').components.matching.eligible,false)
 assert.equal(employerEligibilityPeriod(source,r,'2026-09-10','2026-09-15').components.matching.eligible,true)
 r.review.nonelective={status:'REVIEW_REQUIRED',eligibleOn:null,vestedBps:null}
 assert.throws(()=>employerEligibilityPeriod(source,r,'2026-09-10','2026-09-15'),/Resolve each/)
})
