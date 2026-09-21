import test from 'node:test'
import assert from 'node:assert/strict'
import {retirementEmployerFormula} from '../retirementEmployerFormula.js'
import {retirementPlanInput} from '../retirementPlanInput.js'
import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
import {retirementEmployerProcessingIssue} from '../retirementEmployerProcessing.js'
const formula=()=>({period:'PER_PAYROLL',matchCatchUp:true,matchTiers:[{upToBps:300,matchBps:10000},{upToBps:500,matchBps:5000}],nonelectiveBps:200,compensation:{REGULAR:true,OVERTIME:true,BONUS:false,PAID_LEAVE:true},eligibilityTerms:'Retained eligibility clause including entry dates and hours.',vestingTerms:'Retained vesting schedule and service-credit clause.'})
const plan=()=>({...retirementPlanFixture(),employerContributions:'MATCH_AND_NONELECTIVE',employerContributionTerms:'Retained signed matching and nonelective plan formula.'})
test('structured employer formula is canonical, retained in the plan fingerprint and does not activate funding',()=>{
 const legacy=retirementPlanInput(plan()),f=formula(),saved=retirementPlanInput({...plan(),employerFormula:f})
 assert.equal(legacy.employerFormula,undefined);assert.deepEqual(saved.employerFormula,f);assert.notEqual(saved.fingerprint,legacy.fingerprint)
 assert.equal(retirementPlanInput({...saved,confirmed:true}).fingerprint,saved.fingerprint)
 const reordered={...Object.fromEntries(Object.entries(f).reverse()),compensation:Object.fromEntries(Object.entries(f.compensation).reverse()),matchTiers:f.matchTiers.map(t=>Object.fromEntries(Object.entries(t).reverse()))}
 assert.equal(retirementPlanInput({...plan(),employerFormula:reordered}).fingerprint,saved.fingerprint)
 for(const patch of [{period:'ANNUAL_TRUE_UP'},{matchCatchUp:false},{nonelectiveBps:201},{matchTiers:[{upToBps:400,matchBps:10000}]},{compensation:{...f.compensation,BONUS:true}},{eligibilityTerms:'Changed eligibility evidence and plan reference.'},{vestingTerms:'Changed retained vesting evidence and plan reference.'}])assert.notEqual(retirementPlanInput({...plan(),employerFormula:{...f,...patch}}).fingerprint,saved.fingerprint)
 assert.match(retirementEmployerProcessingIssue(saved),/Employer retirement contributions/)
 assert.equal(retirementPlanInput({...plan(),employerFormula:undefined}).fingerprint,legacy.fingerprint)
})
test('matching and nonelective formulas require explicit compatible components',()=>{
 const f=formula()
 assert.equal(retirementEmployerFormula({...f,nonelectiveBps:0},'MATCH').matchTiers.length,2)
 assert.equal(retirementEmployerFormula({...f,matchTiers:[],matchCatchUp:false},'NONELECTIVE').nonelectiveBps,200)
 for(const scope of ['NONE','UNRESOLVED',undefined])assert.throws(()=>retirementEmployerFormula(f,scope),{status:400})
 for(const [scope,patch] of [['MATCH',{nonelectiveBps:200}],['MATCH',{nonelectiveBps:0,matchTiers:[]}],['NONELECTIVE',{matchTiers:[]}],['NONELECTIVE',{matchTiers:[],matchCatchUp:false,nonelectiveBps:0}],['NONELECTIVE',{matchCatchUp:false}]])assert.throws(()=>retirementEmployerFormula({...f,...patch},scope),{status:400})
})
test('formula rejects ambiguous, malformed and out-of-range amounts without silently changing a tier',()=>{
 const f=formula()
 for(const patch of [{period:'MONTHLY'},{matchCatchUp:null},{nonelectiveBps:'200'},{nonelectiveBps:0},{nonelectiveBps:10001},{nonelectiveBps:0.5},{compensation:{}},{compensation:{...f.compensation,OTHER:true}},{compensation:{REGULAR:false,OVERTIME:false,BONUS:false,PAID_LEAVE:false}},{eligibilityTerms:'missing'},{vestingTerms:'invalid\u0000 clause reference'},{enabled:true},{matchTiers:[]},{matchTiers:[{upToBps:0,matchBps:10000}]},{matchTiers:[{upToBps:300,matchBps:0}]},{matchTiers:[{upToBps:300,matchBps:100001}]},{matchTiers:[{upToBps:10001,matchBps:10000}]},{matchTiers:[{upToBps:300,matchBps:10000},{upToBps:300,matchBps:5000}]},{matchTiers:[{upToBps:500,matchBps:10000},{upToBps:300,matchBps:5000}]},{matchTiers:[{upToBps:300,matchBps:10000,cap:1}]}])assert.throws(()=>retirementEmployerFormula({...f,...patch},'MATCH_AND_NONELECTIVE'),{status:400})
 for(const invalid of [null,[],{},undefined])assert.throws(()=>retirementEmployerFormula(invalid,'MATCH'),{status:400})
})
