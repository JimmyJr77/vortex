import test from 'node:test'
import assert from 'node:assert/strict'
import {employerEligibilityPeriod,employerPayrollEligibilityCoverage} from '../retirementEmployerEligibilityPeriod.js'
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

test('mid-period hiring narrows review coverage only with one complete current employment cycle',()=>{
 const s={...source,employeeId:'7',hireDate:'2026-09-09',employmentPeriods:[{id:'3',started_on:'2026-09-09',ended_on:null}]}
 const segment={employeeId:7,employmentStart:s.hireDate,start:s.hireDate,end:'2026-09-15'}
 const preview={employmentCompensation:[segment],payItems:[]}
 assert.deepEqual(employerPayrollEligibilityCoverage(s,preview,'2026-09-01','2026-09-15'),{periodStart:'2026-09-09',periodEnd:'2026-09-15',payrollPeriodStart:'2026-09-01',payrollPeriodEnd:'2026-09-15',clippedForNewHire:true,employmentPeriodId:'3'})
 assert.equal(employerPayrollEligibilityCoverage(s,{...preview,employmentCompensation:[{...segment,end:'2026-09-11'},{...segment,start:'2026-09-12'}]},'2026-09-01','2026-09-15').clippedForNewHire,true)
 const old={id:'2',started_on:'2026-01-01',ended_on:'2026-08-15'}
 assert.doesNotThrow(()=>employerPayrollEligibilityCoverage({...s,employmentPeriods:[old,...s.employmentPeriods]},preview,'2026-09-01','2026-09-15'))
 assert.throws(()=>employerPayrollEligibilityCoverage({...s,employmentPeriods:[{...old,ended_on:'2026-09-03'},...s.employmentPeriods]},preview,'2026-09-01','2026-09-15'),/each employment cycle/)
 for(const patch of [{employmentCompensation:[]},{employmentCompensation:[{...segment,start:'2026-09-10'}]},{employmentCompensation:[{...segment,end:'2026-09-14'}]},{employmentCompensation:[segment,segment]},{employmentCompensation:[{...segment,employmentStart:'2026-01-01'}]},{employmentCompensation:[{...segment,employeeId:8}]},{payItems:[{kind:'BONUS',amountCents:100}]},{payItems:[{kind:'PAID_LEAVE',employmentStart:'2026-01-01'}]},{authorizedSettlement:{id:1}}])assert.throws(()=>employerPayrollEligibilityCoverage(s,{...preview,...patch},'2026-09-01','2026-09-15'),{status:409})
 assert.throws(()=>employerPayrollEligibilityCoverage({...s,hireDate:'2026-09-16'},preview,'2026-09-01','2026-09-15'),/employment cycle/)
 for(const hireDate of ['',null,'2026-02-30'])assert.throws(()=>employerPayrollEligibilityCoverage({...s,hireDate},preview,'2026-09-01','2026-09-15'),/employment cycle/)
 assert.equal(employerPayrollEligibilityCoverage({...s,hireDate:'2025-01-01'},preview,'2026-09-01','2026-09-15').clippedForNewHire,false)
})
