import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {hashPayrollToken} from '../employeeAuth.js'
import {onboardingDraft} from '../onboarding.js'
test('drafts retain only partial task answers and never acknowledgments or supplied terms',()=>{
 assert.deepEqual(onboardingDraft('HANDBOOK',{signature:' Test Person ',acknowledged:true,terms:'forged'}),{signature:'Test Person'})
 assert.deepEqual(onboardingDraft('PROFILE',{legalFirstName:'Partial',ssn:'not stored'}),{legalFirstName:'Partial'})
 assert.throws(()=>onboardingDraft('PROFILE',{address:{value:'invalid'}}),/must be text/)
 assert.throws(()=>onboardingDraft('PAYMENT',{method:'CRYPTO'}),/Choose/)
 assert.throws(()=>onboardingDraft('AVAILABILITY',{note:'x'.repeat(4001)}),/exceeds/)
})
test('employee resumes partial onboarding without submitting or changing reviewed identity',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,employee=false)=>{const r=await fetch(`${h.url}/api/${employee?'payroll/employee':'admin/payroll'}${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${employee?'draft-session':'payroll-test-admin'}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:'DRAFT-RESUME',legalFirstName:'Original',legalLastName:'Identity',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[e.id,hashPayrollToken('draft-session')])
 const task=(await api('/onboarding',undefined,200,true)).tasks.find(t=>t.task_key==='PROFILE')
 const draft={legalFirstName:'Draft',emergencyName:'Contact',onboardingCycle:1}
 await api(`/onboarding/${task.id}/draft`,draft,200,true)
 const saved=(await api('/onboarding',undefined,200,true)).tasks.find(t=>t.id===task.id)
 assert.equal(saved.status,'OPEN');assert.equal(saved.submitted_at,null);assert.equal(saved.response.emergencyName,'Contact')
 assert.equal((await h.pool.query('SELECT legal_first_name FROM payroll_employee WHERE id=$1',[e.id])).rows[0].legal_first_name,'Original')
 await api(`/employees/${e.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Cannot approve an incomplete draft'},409)
 await api(`/onboarding/${task.id}`,draft,400,true)
 const other=await api('/employees',{employeeNumber:'DRAFT-OTHER',legalFirstName:'Other',legalLastName:'Person',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 const foreign=(await api(`/employees/${other.id}/onboarding`)).tasks[0]
 await api(`/onboarding/${foreign.id}/draft`,draft,404,true)
 const admin=(await api('/onboarding',undefined,200,true)).tasks.find(t=>t.owner==='ADMIN')
 await api(`/onboarding/${admin.id}/draft`,draft,404,true)
 await h.pool.query("UPDATE payroll_onboarding_task SET status='SUBMITTED' WHERE id=$1",[task.id])
 await api(`/onboarding/${task.id}/draft`,draft,409,true)
 await h.pool.query("UPDATE payroll_onboarding_task SET status='CHANGES_REQUESTED' WHERE id=$1",[task.id])
 await api(`/onboarding/${task.id}/draft`,draft,200,true)
 await h.pool.query("UPDATE payroll_onboarding_task SET onboarding_cycle=2,status='OPEN',response='{}' WHERE id=$1",[task.id])
 await api(`/onboarding/${task.id}/draft`,draft,409,true)
 assert.deepEqual((await api('/onboarding',undefined,200,true)).tasks.find(t=>t.id===task.id).response,{})
})
