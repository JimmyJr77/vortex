import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {hashPayrollToken} from '../employeeAuth.js'
test('onboarding revisions preserve signed documents and isolate a new cycle from old submissions',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const priorKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='a'.repeat(64)
 const h=await createHarness();t.after(async()=>{await h.close();if(priorKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=priorKey})
 const api=async(path,body,status=200,employee=false,facility=1)=>{const r=await fetch(`${h.url}/api/${employee?'payroll/employee':'admin/payroll'}${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${employee?'history-session':'payroll-test-admin'}`,'Content-Type':'application/json','x-test-facility':String(facility)},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:'ONBOARDING-HISTORY',legalFirstName:'Returning',legalLastName:'Signer',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[e.id,hashPayrollToken('history-session')])
 const task=(await api(`/employees/${e.id}/onboarding`)).tasks.find(t=>t.task_key==='W4')
 const bytes=Buffer.from('%PDF-1.4\nSynthetic prior signed form')
 const old=await api(`/onboarding/${task.id}/documents`,{filename:'prior-signed-w4.pdf',contentBase64:bytes.toString('base64')},200,true)
 await api(`/onboarding/${task.id}`,{},200,true)
 await api(`/employees/${e.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Synthetic review of prior signed form'})
 const history=await api(`/employees/${e.id}/onboarding/${task.id}/history`)
 const completed=history.find(r=>r.snapshot.status==='COMPLETE')
 assert.equal(completed.onboarding_cycle,1);assert.equal(Number(completed.documents[0].id),Number(old.id))
 await assert.rejects(()=>h.pool.query("UPDATE payroll_onboarding_revision SET event='REWRITTEN' WHERE id=$1",[completed.id]),/immutable/)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_onboarding_revision WHERE id=$1',[completed.id]),/immutable/)
 // A later rehire workflow will perform this reset transactionally with the
 // employment/compensation changes; exercise cycle isolation directly here.
 await h.pool.query("UPDATE payroll_onboarding_task SET onboarding_cycle=2,status='OPEN',response='{}',review_note=NULL,completed_at=NULL,submitted_at=NULL,reviewed_by=NULL WHERE id=$1",[task.id])
 assert.equal((await api('/onboarding',undefined,200,true)).documents.length,0)
 await api(`/onboarding/${task.id}`,{onboardingCycle:1},409,true)
 await api(`/onboarding/${task.id}/documents`,{onboardingCycle:1,filename:'stale.pdf',contentBase64:bytes.toString('base64')},409,true)
 await api(`/onboarding/${task.id}`,{onboardingCycle:2},400,true)
 await assert.rejects(()=>h.pool.query('UPDATE payroll_onboarding_task SET onboarding_cycle=1 WHERE id=$1',[task.id]),/advance once/)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_private_document WHERE id=$1',[old.id]),/retained unchanged/)
 const download=await fetch(`${h.url}/api/payroll/employee/documents/${old.id}`,{headers:{Authorization:'Bearer history-session'}})
 assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes)
 const fresh=await api(`/onboarding/${task.id}/documents`,{onboardingCycle:2,filename:'current-signed-w4.pdf',contentBase64:Buffer.from('%PDF-1.4\nSynthetic current signed form').toString('base64')},200,true)
 await api(`/onboarding/${task.id}`,{onboardingCycle:2},200,true)
 const revisions=await api(`/employees/${e.id}/onboarding/${task.id}/history`)
 assert.equal(revisions[0].onboarding_cycle,2);assert.deepEqual(revisions[0].documents.map(d=>Number(d.id)),[Number(fresh.id)])
 assert.deepEqual(revisions.find(r=>r.id===completed.id),completed)
 await api(`/employees/${e.id}/onboarding/${task.id}/history`,undefined,404,false,2)
 const other=await api('/employees',{employeeNumber:'OTHER-HISTORY',legalFirstName:'Other',legalLastName:'Person',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await api(`/employees/${other.id}/onboarding/${task.id}/history`,undefined,404)
})
