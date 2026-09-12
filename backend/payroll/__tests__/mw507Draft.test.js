import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {hashPayrollToken} from '../employeeAuth.js'
import {mw507DraftInput} from '../mw507Draft.js'
const draft=()=>({fullName:'Łukasz',ssn:'123-4',additionalWithholdingCents:'12.',priorYearNoTax:false,currentYearNoTax:false,noMarylandAbode:false,certifiedEligible:false,useWorksheet:false})
test('MW507 draft permits partial entries but never signatures, invalid choices or arbitrary nested data',()=>{
 assert.equal(mw507DraftInput(draft()).additionalWithholdingCents,'12.')
 for(const patch of [{signature:'Name'},{claim:{}},{ssn:'letters'},{exemptions:'1.5'},{state:'Maryland'},{claimKind:'UNKNOWN'},{useWorksheet:'true'}])assert.throws(()=>mw507DraftInput({...draft(),...patch}),{status:400})
})
test('MW507 encrypted draft resumes across sessions, prevents stale writes and isolates employee scope',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const oldKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='81'.repeat(32)
 t.after(()=>{if(oldKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=oldKey})
 const h=await createHarness();t.after(()=>h.close());const {api,employee}=await monthlyBenefitsFixture(h)
 const task=(await api('/onboarding',undefined,'GET',200,true)).tasks.find(t=>t.task_key==='STATE_WITHHOLDING'),path=`/onboarding/${task.id}/mw507/draft`
 const body={draft:draft(),expectedRevision:0,baseSubmissionId:null,onboardingCycle:1,requestKey:randomUUID()}
 const saved=await api(path,body,'POST',200,true)
 assert.equal(saved.revision,1);assert.deepEqual(await api(path,{...body,requestKey:body.requestKey.toUpperCase()},'POST',200,true),saved)
 await api(path,{...body,requestKey:randomUUID()},'POST',409,true)
 await api(path,{...body,draft:{...body.draft,fullName:'Changed'}},'POST',409,true)
 const row=(await h.pool.query('SELECT * FROM payroll_mw507_draft WHERE task_id=$1',[task.id])).rows[0]
 assert.equal(row.encrypted_draft.includes(Buffer.from('123-4')),false)
 const request=async(token,method='GET',payload)=>fetch(`${h.url}/api/payroll/employee${path}${method==='GET'?'?onboardingCycle=1':''}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})})
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,clock_timestamp()+interval '1 day')",[employee.id,hashPayrollToken('mw507-second-session')])
 const resumed=await request('mw507-second-session');assert.equal(resumed.status,200);assert.equal(resumed.headers.get('cache-control'),'no-store');assert.equal((await resumed.json()).data.draft.ssn,'123-4')
 const other=await api('/employees',{employeeNumber:'OTHER-MW-DRAFT',legalFirstName:'Other',legalLastName:'Employee',hireDate:'2026-09-01',hourlyRateCents:2500},'POST',201)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,clock_timestamp()+interval '1 day')",[other.id,hashPayrollToken('mw507-other-session')])
 assert.equal((await request('mw507-other-session')).status,404);assert.equal((await request('mw507-other-session','POST',body)).status,404)
 const concurrent={...body,expectedRevision:1,requestKey:randomUUID(),draft:{...body.draft,fullName:'Updated'}}
 const [a,b]=await Promise.all([api(path,concurrent,'POST',200,true),api(path,concurrent,'POST',200,true)]);assert.deepEqual(a,b);assert.equal(a.revision,2)
 await api(path,{...concurrent,onboardingCycle:2},'POST',409,true)
 assert.equal(JSON.stringify((await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='MW507_DRAFT_SAVED'")).rows).includes('123-4'),false)
 delete process.env.PAYROLL_DOCUMENT_KEY;await api(path+'?onboardingCycle=1',undefined,'GET',503,true)
})
