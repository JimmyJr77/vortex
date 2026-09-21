import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
import {retirementProcessingPolicies} from '../retirementProcessingReview.js'
import {retirementEmployerProcessingIssue} from '../retirementEmployerProcessing.js'

test('only explicit no-employer-funding terms pass the current execution boundary',()=>{
 assert.equal(retirementEmployerProcessingIssue({employerContributions:'NONE'}),null)
 for(const employerContributions of [undefined,null,'MATCH','NONELECTIVE','MATCH_AND_NONELECTIVE','UNRESOLVED','none'])assert.match(retirementEmployerProcessingIssue({employerContributions}),/Employer retirement contributions/)
})

test('retained employer-funded plans disclose execution issues and reject processing approval while allowing suspension',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async()=>{
 const h=await createHarness()
 const api=async(path,body,status=200)=>{
  const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined})
  const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return result
 }
 try{
  for(const employerContributions of ['MATCH','NONELECTIVE','MATCH_AND_NONELECTIVE','UNRESOLVED']){
   const planId=employerContributions.toLowerCase().replaceAll('_','-')
   await api('/retirement-plans',{plan:{...retirementPlanFixture(),planId,employerContributions,employerContributionTerms:'Synthetic retained employer funding formula.'},expectedRevision:0,requestKey:randomUUID()})
   const path=`/retirement-plans/${planId}/processing-review`,current=(await api(path)).data
   assert.equal(current.executionIssues.length,1);assert.match(current.executionIssues[0],/Employer retirement contributions/)
   const request={planRevisionId:current.planRevisionId,expectedRevision:0,requestKey:randomUUID(),review:{confirmed:true,disposition:'REVIEWED',catchUpAuthorized:false,reference:'Synthetic employer contribution processing review.',policies:retirementProcessingPolicies}}
   assert.match((await api(path,request,409)).message,/Employer retirement contributions/)
   assert.equal((await api(path)).data.history.length,0)
   await api(path,{...request,requestKey:randomUUID(),review:{...request.review,disposition:'SUSPENDED'}})
   const suspended=(await api(path)).data
   assert.equal(suspended.status,'SUSPENDED');assert.equal(suspended.history.length,1);assert.equal(suspended.executionIssues.length,1)
  }
  await api('/retirement-plans',{plan:retirementPlanFixture(),expectedRevision:0,requestKey:randomUUID()})
  const path='/retirement-plans/standard/processing-review',current=(await api(path)).data
  assert.deepEqual(current.executionIssues,[])
  await api(path,{planRevisionId:current.planRevisionId,expectedRevision:0,requestKey:randomUUID(),review:{confirmed:true,disposition:'REVIEWED',catchUpAuthorized:false,reference:'Synthetic no-employer-funding processing review.',policies:retirementProcessingPolicies}})
  assert.equal((await api(path)).data.status,'REVIEWED')
 }finally{await h.close()}
})
