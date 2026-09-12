import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {hashPayrollToken} from '../employeeAuth.js'
test('Maryland signing isolates employee records and rejects revoked sessions after waiting for the employer lock',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {api,employee}=await monthlyBenefitsFixture(h)
 await api(`/employees/${employee.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed Maryland election',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1,extraWithholdingCents:500}},'PATCH')
 const path=`/employees/${employee.id}/maryland-agreement-proposals`,preview=await api(`${path}/preview?effectiveOn=2026-09-16`)
 const proposal=await api(path,{sourceFingerprint:preview.sourceFingerprint,expectedRevision:0,requestKey:randomUUID(),confirmed:true,effectiveOn:'2026-09-16',amountCents:500,electionFingerprint:preview.terms.agreement.electionFingerprint,periodBasis:'PAYMENT_DATE'},'POST',201)
 const current=(await api('/maryland-agreement-proposals',undefined,'GET',200,true)).history[0]
 const body={requestKey:randomUUID(),decision:'ACCEPT',signature:'Monthly Benefits',confirmed:true,proposalFingerprint:current.fingerprint,displayedTerms:current.terms.employeeTerms}
 const other=await api('/employees',{employeeNumber:'SIGNING-OTHER',legalFirstName:'Other',legalLastName:'Employee',hireDate:'2026-09-01',hourlyRateCents:2500},'POST',201)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,clock_timestamp()+interval '1 day')",[other.id,hashPayrollToken('signing-other-session')])
 const request=(token,respond=true)=>fetch(`${h.url}/api/payroll/employee/maryland-agreement-proposals${respond?`/${proposal.id}/respond`:''}`,{method:respond?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:respond?JSON.stringify(body):undefined})
 const otherHistory=await request('signing-other-session',false);assert.deepEqual((await otherHistory.json()).data.history,[])
 assert.equal((await request('signing-other-session')).status,409)
 assert.equal((await request('invalid-session')).status,401)
 const db=await h.pool.connect();let pending
 try{
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=1 FOR UPDATE')
  const pid=(await db.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
  pending=request('monthly-benefits-session')
  let waiting=false
  for(let i=0;i<100&&!waiting;i++){waiting=(await h.pool.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))) AS waiting',[pid])).rows[0].waiting;if(!waiting)await new Promise(resolve=>setTimeout(resolve,10))}
  assert.equal(waiting,true,'Signing request reached the employer lock')
  await db.query('UPDATE payroll_employee_session SET revoked_at=clock_timestamp() WHERE token_hash=$1',[hashPayrollToken('monthly-benefits-session')])
  await db.query('COMMIT')
  assert.equal((await pending).status,401)
 }finally{await db.query('ROLLBACK').catch(()=>{});db.release();if(pending)await pending}
 const revoked=(await h.pool.query('SELECT id FROM payroll_employee_session WHERE token_hash=$1',[hashPayrollToken('monthly-benefits-session')])).rows[0]
 await assert.rejects(()=>h.pool.query('INSERT INTO payroll_maryland_agreement_signature(id,facility_id,employee_id,proposal_id,decision,signature,employee_session_id,request_key,request_hash) VALUES($1,1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),employee.id,proposal.id,'DECLINE','Monthly Benefits',revoked.id,randomUUID(),'b'.repeat(64)]),/session or signature/)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_maryland_agreement_signature')).rows[0].n,0)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_maryland_additional_agreement')).rows[0].n,0)
 for(const patch of [{version:'1'},{agreement:{...current.terms.agreement,amountCents:'500'}},{agreement:{...current.terms.agreement,employeeId:String(other.id)}},{agreement:{...current.terms.agreement,amountCents:9007199254740992}},{expectedAgreementRevision:-1},{effectiveOn:'2026-02-31'},{employeeTerms:'bad'}]){
  await assert.rejects(()=>h.pool.query('INSERT INTO payroll_maryland_agreement_proposal(id,facility_id,employee_id,revision,terms,fingerprint,created_by,request_key,request_hash) SELECT $1,facility_id,employee_id,2,$2,fingerprint,created_by,$3,request_hash FROM payroll_maryland_agreement_proposal WHERE id=$4',[randomUUID(),{...current.terms,...patch},randomUUID(),current.id]))
 }
})
