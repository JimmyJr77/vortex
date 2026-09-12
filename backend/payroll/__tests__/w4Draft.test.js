import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {hashPayrollToken} from '../employeeAuth.js'
test('encrypted incomplete W-4 drafts resume in a new session and reject stale or changed retry saves',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const key=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='ab'.repeat(32);t.after(()=>{if(key===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=key})
 const h=await createHarness();t.after(()=>h.close());const {api,employee}=await monthlyBenefitsFixture(h)
 const task=(await api('/onboarding',undefined,'GET',200,true)).tasks.find(t=>t.task_key==='W4'),path=`/onboarding/${task.id}/w4/draft`
 const initial=await api(path+'?onboardingCycle=1',undefined,'GET',200,true);assert.equal(initial.draft,null)
 const draft={firstNameMiddleInitial:'Partial Name',ssn:'123-4',extraWithholdingCents:'12.',twoJobs:false,exempt:false}
 const body={draft,expectedRevision:0,baseSubmissionId:null,onboardingCycle:1,requestKey:randomUUID()}
 const saved=await api(path,body,'POST',200,true),retry=await api(path,{...body,requestKey:body.requestKey.toUpperCase()},'POST',200,true);assert.deepEqual(saved,retry)
 await api(path,{...body,draft:{...draft,ssn:'999'}},'POST',409,true)
 await api(path,{...body,requestKey:randomUUID()},'POST',409,true)
 const encrypted=(await h.pool.query('SELECT encrypted_draft FROM payroll_w4_draft WHERE task_id=$1',[task.id])).rows[0].encrypted_draft
 assert.equal(encrypted.includes(Buffer.from('Partial Name')),false);assert.equal(encrypted.includes(Buffer.from('123-4')),false)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,clock_timestamp()+interval '1 day')",[employee.id,hashPayrollToken('resumed-w4-session')])
 const response=await fetch(`${h.url}/api/payroll/employee${path}?onboardingCycle=1`,{headers:{Authorization:'Bearer resumed-w4-session'}})
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store')
 const resumed=(await response.json()).data;assert.equal(resumed.draft.ssn,'123-4');assert.equal(resumed.draft.extraWithholdingCents,'12.');assert.equal(resumed.revision,1)
 await api(path,{...body,expectedRevision:1,requestKey:randomUUID(),draft:{...draft,signature:'Not allowed'}},'POST',400,true)
 const concurrent={...body,expectedRevision:1,requestKey:randomUUID(),draft:{...draft,lastName:'Saved once'}}
 const [a,b]=await Promise.all([api(path,concurrent,'POST',200,true),api(path,concurrent,'POST',200,true)])
 assert.equal(a.revision,2);assert.deepEqual(a,b)
 assert.equal(JSON.stringify((await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='W4_DRAFT_SAVED'")).rows).includes('123-4'),false)
 await api(path+'?onboardingCycle=2',undefined,'GET',409,true)
 const other=await api('/employees',{employeeNumber:'OTHER-DRAFT',legalFirstName:'Other',legalLastName:'Draft',hireDate:'2026-09-01',hourlyRateCents:2500},'POST',201)
 const otherTask=(await h.pool.query("SELECT id FROM payroll_onboarding_task WHERE employee_id=$1 AND task_key='W4'",[other.id])).rows[0]
 await api(`/onboarding/${otherTask.id}/w4/draft?onboardingCycle=1`,undefined,'GET',404,true)
 await api(`/onboarding/${otherTask.id}/w4/draft`,body,'POST',404,true)
 await assert.rejects(h.pool.query('UPDATE payroll_w4_draft SET facility_id=2,revision=revision+1 WHERE task_id=$1',[task.id]),/scope and revision/)
 delete process.env.PAYROLL_DOCUMENT_KEY
 await api(path+'?onboardingCycle=1',undefined,'GET',503,true)
 process.env.PAYROLL_DOCUMENT_KEY='ab'.repeat(32)
})
