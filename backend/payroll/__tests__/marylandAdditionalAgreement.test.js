import test from 'node:test'
import assert from 'node:assert/strict'
import {loadMarylandAdditionalAgreement} from '../marylandAdditionalAgreement.js'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
test('Maryland agreements retain scoped immutable revisions, concurrent retry identity and changed-election review',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {api,employee}=await monthlyBenefitsFixture(h)
 const elections={confirmed:true,sourceNote:'Synthetic signed employee Maryland form',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1,extraWithholdingCents:500}}
 await api(`/employees/${employee.id}/tax-elections`,elections,'PATCH')
 const path=`/employees/${employee.id}/maryland-additional-agreements`,initial=await api(path)
 assert.equal(initial.latest,null);assert.equal(initial.requestedAdditionalCents,500)
 const body={status:'ACTIVE',expectedRevision:0,requestKey:randomUUID(),confirmed:true,sourceReference:'Synthetic signed employer and employee per-period agreement',effectiveOn:'2026-09-16',amountCents:500,periodBasis:'PAYMENT_DATE',electionFingerprint:initial.currentElectionFingerprint}
 await api(path,{...body,electionFingerprint:'a'.repeat(64)},'POST',409)
 await api(path,{...body,amountCents:501},'POST',409)
 const submit=async()=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,json:await response.json()}}
 const replies=await Promise.all([submit(),submit()]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,201]);assert.equal(replies[0].json.data.id,replies[1].json.data.id)
 assert.equal((await api(path)).history.length,1)
 const select=paymentDate=>loadMarylandAdditionalAgreement(h.pool,{facility:1,employeeId:employee.id,paymentDate})
 await assert.rejects(()=>select('2026-09-15'),{status:409});assert.equal((await select('2026-09-16')).revision,1)
 await assert.rejects(()=>loadMarylandAdditionalAgreement(h.pool,{facility:999,employeeId:employee.id,paymentDate:'2026-09-16'}),{status:404})
 await api(path,{...body,sourceReference:'Different signed agreement reference with same request key'},'POST',409)
 await api(path,{...body,requestKey:randomUUID()},'POST',409)
 await api(`/employees/${employee.id}/tax-elections`,{...elections,maryland:{...elections.maryland,extraWithholdingCents:501}},'PATCH')
 assert.equal((await api(path)).electionMatches,false)
 await assert.rejects(()=>select('2026-09-16'),{status:409})
 assert.equal((await api(path,body)).reused,true)
 const suspension=await api(path,{...body,status:'SUSPENDED',expectedRevision:1,requestKey:randomUUID(),sourceReference:'Suspend the prior agreement after revised employee election'},'POST',201)
 assert.equal(suspension.revision,2);assert.equal(suspension.status,'SUSPENDED')
 const current=await api(path)
 const active=await api(path,{...body,expectedRevision:2,requestKey:randomUUID(),amountCents:501,electionFingerprint:current.currentElectionFingerprint},'POST',201)
 assert.equal(active.revision,3);assert.equal(active.agreement.amountCents,501);assert.equal((await api(path)).history.length,3)
 await assert.rejects(()=>h.pool.query('UPDATE payroll_maryland_additional_agreement SET source_reference=$1 WHERE id=$2',['Changed retained source reference',active.id]),/immutable/)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_maryland_additional_agreement WHERE id=$1',[active.id]),/immutable/)
 await assert.rejects(()=>h.pool.query("INSERT INTO payroll_maryland_additional_agreement(facility_id,employee_id,revision,status,agreement,effective_on,fingerprint,source_reference,request_key,request_hash,verified_by) SELECT 999,employee_id,4,status,agreement,effective_on,fingerprint,source_reference,$2,request_hash,verified_by FROM payroll_maryland_additional_agreement WHERE id=$1",[active.id,randomUUID()]),/scope mismatch/)
 await api('/employees/999999/maryland-additional-agreements',undefined,'GET',404)
 assert.equal((await h.pool.query("SELECT count(*)::int n FROM payroll_audit_log WHERE action='MARYLAND_ADDITIONAL_AGREEMENT_RECORDED'")).rows[0].n,3)
 await h.pool.query("CREATE FUNCTION reject_maryland_agreement_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='MARYLAND_ADDITIONAL_AGREEMENT_RECORDED' THEN RAISE EXCEPTION 'synthetic agreement audit failure'; END IF; RETURN NEW; END $$")
 await h.pool.query('CREATE TRIGGER reject_maryland_agreement_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_maryland_agreement_audit()')
 const finalSuspension={...body,effectiveOn:'2026-10-01',status:'SUSPENDED',expectedRevision:3,requestKey:randomUUID(),sourceReference:'Synthetic agreed suspension with atomic retained audit'}
 await api(path,finalSuspension,'POST',500)
 assert.equal((await api(path)).history.length,3)
 await h.pool.query('DROP TRIGGER reject_maryland_agreement_audit ON payroll_audit_log')
 assert.equal((await api(path,finalSuspension,'POST',201)).revision,4)
 assert.equal((await select('2026-09-30')).revision,3)
 await assert.rejects(()=>select('2026-10-01'),{status:409})
 for(const paymentDate of ['2026-02-30','2027-01-01','invalid'])await assert.rejects(()=>select(paymentDate),{status:409})
 await h.pool.query("UPDATE payroll_employee SET state_withholding_status='REQUESTED' WHERE id=$1",[employee.id])
 await assert.rejects(()=>select('2026-09-30'),{status:409})
 await h.pool.query("UPDATE payroll_employee SET state_withholding_status='COMPLETE' WHERE id=$1",[employee.id])
 for(const patch of [{verified:'true'},{version:'1'},{periodBasis:'EARNED_DATE'},{payFrequency:'DAILY'},{electionFingerprint:'bad'},{amountCents:'501'},{amountCents:-1},{amountCents:1.5},{amountCents:9007199254740992}]){
  await assert.rejects(()=>h.pool.query("INSERT INTO payroll_maryland_additional_agreement(facility_id,employee_id,revision,status,agreement,effective_on,fingerprint,source_reference,request_key,request_hash,verified_by) SELECT facility_id,employee_id,5,'ACTIVE',agreement || $3::jsonb,'2026-10-01',fingerprint,source_reference,$2,request_hash,verified_by FROM payroll_maryland_additional_agreement WHERE id=$1",[active.id,randomUUID(),patch]),/payload|amount/)
 }

})
