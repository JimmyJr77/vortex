import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {hashPayrollToken} from '../employeeAuth.js'
test('employees read only their own acknowledgment copies across cycles with complete pagination',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,employee=false,method=body===undefined?'GET':'POST')=>{const r=await fetch(`${h.url}/api/${employee?'payroll/employee':'admin/payroll'}${path}`,{method,headers:{Authorization:`Bearer ${employee?'ack-history-session':'payroll-test-admin'}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:'ACK-HISTORY',legalFirstName:'History',legalLastName:'Signer',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[e.id,hashPayrollToken('ack-history-session')])
 const policy={handbookText:'Original signed handbook',benefitsText:'Original benefits'}
 await api('/settings',policy,200,false,'PATCH')
 const packet=await api('/onboarding',undefined,200,true),task=packet.tasks.find(t=>t.task_key==='HANDBOOK')
 const path=`/onboarding/${task.id}/acknowledgments`
 assert.deepEqual((await api(path,undefined,200,true)).items,[])
 await api(`/onboarding/${task.id}`,{signature:'History Signer',acknowledged:true,displayedHandbookTerms:policy},200,true)
 await api(`/employees/${e.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Synthetic internal admin-only review note'})
 const original=(await api(path,undefined,200,true)).items[0]
 assert.equal(original.terms,policy.handbookText);assert.equal(original.benefitsTerms,policy.benefitsText)
 assert.equal(JSON.stringify(original).includes('admin-only'),false)
 assert.deepEqual(Object.keys(original).sort(),['benefitsTerms','cycle','id','kind','recordedAt','signature','source','submittedAt','terms','title'].sort())
 await h.pool.query("UPDATE payroll_onboarding_task SET onboarding_cycle=2,status='OPEN',response='{}',submitted_at=NULL,completed_at=NULL,review_note=NULL,reviewed_by=NULL WHERE id=$1",[task.id])
 await api('/settings',{...policy,handbookText:'Current handbook'},200,false,'PATCH')
 for(let i=0;i<26;i++)await api(`/onboarding/${task.id}`,{signature:`History Signer ${i}`,acknowledged:true,onboardingCycle:2,displayedHandbookTerms:{...policy,handbookText:'Current handbook'}},200,true)
 const first=await api(path,undefined,200,true),second=await api(`${path}?beforeId=${first.nextBeforeId}`,undefined,200,true)
 assert.equal(first.items.length,25);assert.equal(second.items.length,2);assert.equal(second.nextBeforeId,null)
 assert.equal(new Set([...first.items,...second.items].map(i=>i.id)).size,27)
 assert.deepEqual(second.items.at(-1),original)
 await h.pool.query(`INSERT INTO payroll_onboarding_revision(facility_id,employee_id,task_id,onboarding_cycle,event,snapshot)
  SELECT facility_id,employee_id,id,onboarding_cycle,'INITIAL_CAPTURE',to_jsonb(t)||jsonb_build_object('status','COMPLETE','submitted_at',NULL,'title','Historical retained handbook title') FROM payroll_onboarding_task t WHERE id=$1`,[task.id])
 const legacy=(await api(path,undefined,200,true)).items[0]
 assert.equal(legacy.source,'RETAINED_RECORD');assert.equal(legacy.submittedAt,null);assert.equal(legacy.title,'Historical retained handbook title')
 await api(`${path}?beforeId=bad`,undefined,400,true)
 await api(`${path}?beforeId=1&beforeId=2`,undefined,400,true)
 const other=await api('/employees',{employeeNumber:'ACK-OTHER',legalFirstName:'Other',legalLastName:'Employee',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 const foreign=(await api(`/employees/${other.id}/onboarding`)).tasks.find(t=>t.task_key==='HANDBOOK')
 await api(`/onboarding/${foreign.id}/acknowledgments`,undefined,404,true)
 await api(`/onboarding/${packet.tasks.find(t=>t.task_key==='PROFILE').id}/acknowledgments`,undefined,404,true)
 const unauth=await fetch(`${h.url}/api/payroll/employee${path}`);assert.equal(unauth.status,401)
})
