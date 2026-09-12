import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {loadMarylandAdditionalAgreement} from '../marylandAdditionalAgreement.js'
test('employee accepts exact employer terms once; changes, declines, immutable history and rollback remain safe',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {api,employee}=await monthlyBenefitsFixture(h)
 const elections={confirmed:true,sourceNote:'Synthetic signed Maryland election evidence',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1,extraWithholdingCents:500}}
 await api(`/employees/${employee.id}/tax-elections`,elections,'PATCH')
 const admin=`/employees/${employee.id}/maryland-agreement-proposals`,employeePath='/maryland-agreement-proposals'
 const propose=async()=>{
  const existing=await api(admin),election=await api(`/employees/${employee.id}/maryland-additional-agreements`)
  const preview=await api(`${admin}/preview?effectiveOn=2026-09-16`)
  const body={sourceFingerprint:preview.sourceFingerprint,expectedRevision:existing.history[0]?.revision??0,requestKey:randomUUID(),confirmed:true,effectiveOn:'2026-09-16',amountCents:election.requestedAdditionalCents,electionFingerprint:election.currentElectionFingerprint,periodBasis:'PAYMENT_DATE'}
  const p=await api(admin,body,'POST',201);assert.equal((await api(admin,body)).id,p.id)
  return (await api(employeePath,undefined,'GET',200,true)).history[0]
 }
 const response=p=>({requestKey:randomUUID(),decision:'ACCEPT',signature:'Monthly Benefits',confirmed:true,proposalFingerprint:p.fingerprint,displayedTerms:p.terms.employeeTerms})
 const first=await propose(),firstBody=response(first),firstPath=`${employeePath}/${first.id}/respond`
 assert.equal((await api(employeePath,undefined,'GET',200,true)).actionable,true)
 await api(firstPath,{...firstBody,displayedTerms:'Changed terms'},'POST',409,true)
 await api(`/employees/${employee.id}/tax-elections`,{...elections,maryland:{...elections.maryland,extraWithholdingCents:600}},'PATCH')
 assert.equal((await api(employeePath,undefined,'GET',200,true)).actionable,false)
 await api(firstPath,firstBody,'POST',409,true)
 const second=await propose(),body=response(second),path=`${employeePath}/${second.id}/respond`
 await api(firstPath,firstBody,'POST',409,true)
 await h.pool.query("CREATE FUNCTION reject_md_signature_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='MARYLAND_AGREEMENT_RESPONDED' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$")
 await h.pool.query('CREATE TRIGGER reject_md_signature_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_md_signature_audit()')
 await api(path,body,'POST',500,true)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_maryland_additional_agreement')).rows[0].n,0)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_maryland_agreement_signature')).rows[0].n,0)
 await h.pool.query('DROP TRIGGER reject_md_signature_audit ON payroll_audit_log')
 const responses=await Promise.all([api(path,body,'POST',200,true),api(path,body,'POST',200,true)])
 assert.equal(responses[0].id,responses[1].id);assert.equal(responses.filter(r=>r.reused).length,1)
 const active=await loadMarylandAdditionalAgreement(h.pool,{facility:1,employeeId:employee.id,paymentDate:'2026-09-16'})
 assert.equal(active.amountCents,600);assert.equal(active.revision,1)
 await api(path,{...body,signature:'Different signer'},'POST',409,true)
 for(const table of ['payroll_maryland_agreement_proposal','payroll_maryland_agreement_signature'])await assert.rejects(()=>h.pool.query(`DELETE FROM ${table}`),/immutable/)
 const third=await propose(),decline={...response(third),decision:'DECLINE'}
 // A same-employee signature cannot attach a different proposal's active agreement.
 const session=(await h.pool.query('SELECT id FROM payroll_employee_session WHERE employee_id=$1 ORDER BY id LIMIT 1',[employee.id])).rows[0]
 await assert.rejects(()=>h.pool.query('INSERT INTO payroll_maryland_agreement_signature(id,facility_id,employee_id,proposal_id,decision,signature,agreement_id,employee_session_id,request_key,request_hash) VALUES($1,1,$2,$3,$4,$5,$6,$7,$8,$9)',[randomUUID(),employee.id,third.id,'ACCEPT','Monthly Benefits',responses[0].agreementId,session.id,randomUUID(),'a'.repeat(64)]),/does not match/)

 await api(`${employeePath}/${third.id}/respond`,decline,'POST',200,true)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_maryland_additional_agreement')).rows[0].n,1)
 assert.equal((await api(employeePath,undefined,'GET',200,true)).history[0].decision,'DECLINE')
 // Replaying a committed acceptance remains idempotent after new history.
 assert.equal((await api(path,body,'POST',200,true)).id,responses[0].id)
})
