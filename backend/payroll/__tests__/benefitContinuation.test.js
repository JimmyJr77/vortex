import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {benefitContinuationFixture} from '../testing/benefitContinuationFixture.js'
const options={skip:!process.env.PAYROLL_TEST_DATABASE_URL}
const approve=async(api,period)=>{const run=await api('/runs',{payPeriodId:period.id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');return api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')}

test('dated continuation review enables one signed monthly collection and preserves final payroll evidence',options,async t=>{
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const {api,employee,periods,path,state,coverageBody,reviewBody}=await benefitContinuationFixture(h)
 let current=await state();assert.equal(current.status,'NEEDS_REVIEW');assert.ok(current.source.issues.some(x=>x.includes('carrier coverage')))
 await api(path,reviewBody(current),'POST',409)
 await api('/benefit-coverage',coverageBody);current=await state();assert.deepEqual(current.source.issues,[])
 assert.equal((await api('/runs/preview',{payPeriodId:periods[0].id})).preview.canApprove,false)
 const body=reviewBody(current),saved=await api(path,body)
 assert.deepEqual(await api(path,body),{id:saved.id,reused:true})
 await api(path,{...body,reference:'Changed retained request content must not be accepted'},'POST',409)
 current=await state();assert.equal(current.status,'CURRENT')
 const preview=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview
 assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings));assert.equal(preview.employees[0].posttaxDeductionCents,12500)
 assert.equal(preview.employees[0].benefitCollection.continuation.reviewId,saved.id)
 const run=await approve(api,periods[0]);await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-CONTINUATION-FIRST'})
 await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2026-09-16T12:00:00Z','2026-09-16T20:00:00Z','ADMIN','APPROVED')",[employee.id])
 const second=(await api('/runs/preview',{payPeriodId:periods[1].id})).preview
 assert.equal(second.canApprove,true,JSON.stringify(second.warnings));assert.equal(second.employees[0].posttaxDeductionCents,0);assert.equal(second.employees[0].benefitCollection.status,'ALREADY_COLLECTED')
 const secondRun=await approve(api,periods[1]);await api(`/runs/${secondRun.id}/finalize`,{paymentDate:'2026-09-30',paymentConfirmationReference:'SYNTHETIC-CONTINUATION-SECOND'})
 assert.equal(Number((await h.pool.query('SELECT sum(posttax_deduction_cents) total FROM payroll_run_employee WHERE employee_id=$1',[employee.id])).rows[0].total),12500)
 await assert.rejects(h.pool.query('DELETE FROM payroll_benefit_continuation_review'),/append-only/)
 const other=await fetch(`${h.url}/api/admin/payroll${path}?paymentDate=2026-09-18`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(other.status,404)
})

test('changed coverage and suspended continuation invalidate approval until sources are reviewed again',options,async t=>{
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const {api,periods,path,state,coverageBody,reviewBody}=await benefitContinuationFixture(h)
 await api('/benefit-coverage',coverageBody);await api(path,reviewBody(await state()))
 const run=await approve(api,periods[0])
 await api('/benefit-coverage',{...coverageBody,expectedRevision:1,requestKey:randomUUID(),reference:'New carrier evidence changes the retained coverage review'})
 assert.equal((await state()).status,'STALE')
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'MUST-NOT-FINALIZE'},'POST',409)
 const current=await state();await api(path,{...reviewBody(current),disposition:'SUSPENDED'})
 assert.equal((await state()).status,'SUSPENDED')
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'MUST-NOT-FINALIZE-SUSPENDED'},'POST',409)
 assert.equal((await h.pool.query('SELECT status FROM payroll_run WHERE id=$1',[run.id])).rows[0].status,'APPROVED')
})

test('continuation review audit is atomic, dated and cannot replace a withdrawn authorization',options,async t=>{
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const {api,employee,path,state,coverageBody,reviewBody}=await benefitContinuationFixture(h)
 await api('/benefit-coverage',coverageBody)
 let current=await state();const body=reviewBody(current)
 await api(path,{...body,paymentDate:'2026-09-15'},'POST',409)
 await api(path,{...body,expectedRevision:1},'POST',409)
 await h.pool.query("CREATE FUNCTION reject_continuation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='BENEFIT_CONTINUATION_REVIEWED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_continuation_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_continuation_audit()")
 await api(path,body,'POST',500);assert.equal((await state()).history.length,0)
 await h.pool.query('DROP TRIGGER reject_continuation_audit ON payroll_audit_log')
 await api(path,body)
 await h.pool.query("UPDATE payroll_onboarding_task SET response=jsonb_set(response,'{benefitsDeductionWithdrawal}',jsonb_build_object('authorizationRequestKey',response->'benefitsDeductionAuthorization'->>'requestKey','recordedAt','2026-09-16T17:00:00Z')) WHERE employee_id=$1 AND task_key='PAY_REVIEW'",[employee.id])
 current=await state();assert.equal(current.status,'STALE');assert.ok(current.source.issues.some(x=>x.includes('employee-signed')))
 await api(path,reviewBody(current),'POST',409)
})

test('competing reviews serialize, database scope is enforced and malformed authorization stays reviewable',options,async t=>{
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const {api,employee,path,state,coverageBody,reviewBody}=await benefitContinuationFixture(h)
 await api('/benefit-coverage',coverageBody)
 const current=await state(),body=reviewBody(current)
 const results=await Promise.all([body,{...body,requestKey:randomUUID(),reference:'Second administrator reviewed the same signed monthly charge'}].map(async b=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(b)});return r.status}))
 assert.deepEqual(results.sort(),[200,409]);assert.equal((await state()).history.length,1)
 await assert.rejects(h.pool.query("INSERT INTO payroll_benefit_continuation_review(id,facility_id,employee_id,payment_date,revision,source_fingerprint,source,review,request_key,request_fingerprint,created_by) SELECT $1,2,employee_id,payment_date,1,source_fingerprint,source,review,$2,request_fingerprint,created_by FROM payroll_benefit_continuation_review",[randomUUID(),randomUUID()]),/another workplace/)
 await assert.rejects(h.pool.query("UPDATE payroll_benefit_continuation_review SET review='{}'"),/append-only/)
 await h.pool.query("UPDATE payroll_onboarding_task SET response=jsonb_set(response,'{benefitsDeductionAuthorization}','{}'::jsonb) WHERE employee_id=$1 AND task_key='PAY_REVIEW'",[employee.id])
 const malformed=await state();assert.equal(malformed.status,'STALE');assert.ok(malformed.source.issues.some(issue=>issue.includes('employee-signed')))
 await api(path,reviewBody(malformed),'POST',409)
})
