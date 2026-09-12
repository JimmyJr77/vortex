import test from 'node:test'
import assert from 'node:assert/strict'
import {validateBenefitPlans,benefitsTerms,selectedBenefits} from '../benefitCatalog.js'
import {benefitsElectionInput,benefitsElectionMatches} from '../benefitsElection.js'
import {createHarness} from '../testing/harness.js'
const plans=[{id:'medical',name:'Medical',description:'Synthetic reviewed medical eligibility and coverage.',options:[{id:'medical-self',label:'Employee only',employeeCostCents:12500,employerCostCents:45000,taxTreatment:'POSTTAX'}]},{id:'dental',name:'Dental',description:'Synthetic reviewed dental eligibility and coverage.',options:[{id:'dental-self',label:'Employee only',employeeCostCents:0,employerCostCents:2500,taxTreatment:'EMPLOYER_PAID'}]}]
test('benefit catalog validates rates and freezes each selected coverage option',()=>{
 const catalog=validateBenefitPlans(plans),policy={benefitsText:'Reviewed offering',benefitCatalog:JSON.stringify(catalog)},terms=benefitsTerms(policy)
 assert.match(terms,/employee \$125.00\/month/)
 const body={choice:'ENROLL',signature:'Plan Signer',confirmed:true,displayedTerms:terms,requestKey:'benefit-plan-selection',selections:[{planId:'medical',optionId:'medical-self',employeeCostCents:1},{planId:'dental',optionId:'WAIVE'}]}
 const election=benefitsElectionInput(body,terms,catalog)
 assert.equal(election.version,2);assert.equal(election.selections[0].employeeCostCents,12500);assert.equal(election.selections[1].optionId,'WAIVE')
 assert.equal(benefitsElectionMatches(JSON.parse(JSON.stringify(election)),terms,catalog),true)
 assert.equal(benefitsElectionMatches(election,terms,validateBenefitPlans([{...plans[0],id:'replacement'},plans[1]])),false)
 assert.equal(benefitsElectionMatches(election,terms,[]),false)
 const tampered=structuredClone(election);tampered.selections[0].employeeCostCents=1;assert.equal(benefitsElectionMatches(tampered,terms,catalog),false)
 for(const selections of [[],[{planId:'medical',optionId:'medical-self'}],[{planId:'medical',optionId:'medical-self'},{planId:'medical',optionId:'medical-self'}],[{planId:'medical',optionId:'missing'},{planId:'dental',optionId:'WAIVE'}]])assert.throws(()=>selectedBenefits({...body,selections},catalog))
 for(const invalid of [null,[null],[{...plans[0],options:[]}],[{...plans[0],options:[{...plans[0].options[0],employeeCostCents:-1}]}],[{...plans[0],options:[{...plans[0].options[0],taxTreatment:'EMPLOYER_PAID'}]}],[plans[0],plans[0]]])assert.throws(()=>validateBenefitPlans(invalid))
})
test('catalog publication rejects stale admin edits and audits previous terms',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const save=async(body,status=200)=>{const r=await fetch(`${h.url}/api/admin/payroll/settings`,{method:'PATCH',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const body={benefitPlans:plans,expectedBenefitCatalog:'',benefitsCatalogConfirmed:true,benefitsCatalogEvidence:'Synthetic plan booklet and monthly rate sheet'}
 await save({...body,benefitsCatalogConfirmed:false},400)
 const saved=await save(body);assert.equal(JSON.parse(saved.benefitCatalog).length,2)
 await save(body,409)
 const revised=await save({...body,expectedBenefitCatalog:saved.benefitCatalog,benefitPlans:[plans[1]]})
 const audit=(await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='BENEFIT_CATALOG_UPDATED' ORDER BY id DESC LIMIT 1")).rows[0].after_data
 assert.equal(audit.priorCatalog,saved.benefitCatalog);assert.equal(audit.catalog,revised.benefitCatalog)
})
