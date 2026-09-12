import {runWorkforceAutomation} from '../workforceAutomation.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {hashPayrollToken} from '../employeeAuth.js'
import {validateResponse,handbookAcknowledgmentCurrent} from '../onboarding.js'
test('handbook acknowledgment captures exactly the displayed handbook and benefits',()=>{
 const policy={handbookText:'Current handbook',benefitsText:'Current benefits'}
 const input={signature:'Test Person',acknowledged:true,displayedHandbookTerms:policy}
 const response=validateResponse('HANDBOOK',input,{},policy)
 assert.equal(response.terms,policy.handbookText);assert.equal(response.benefitsTerms,policy.benefitsText)
 assert.equal(handbookAcknowledgmentCurrent(response,policy),true)
 for(const displayedHandbookTerms of [undefined,{...policy,handbookText:'Old'},{...policy,benefitsText:'Old'}])assert.throws(()=>validateResponse('HANDBOOK',{...input,displayedHandbookTerms},{},policy),/changed/)
 assert.equal(handbookAcknowledgmentCurrent({...response,benefitsTerms:undefined},policy),false)
})
test('changed handbook terms block stale signing, review and hiring activation while preserving history',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,employee=false,method=body===undefined?'GET':'POST')=>{const r=await fetch(`${h.url}/api/${employee?'payroll/employee':'admin/payroll'}${path}`,{method,headers:{Authorization:`Bearer ${employee?'handbook-session':'payroll-test-admin'}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:'HANDBOOK-CURRENT',legalFirstName:'Current',legalLastName:'Signer',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[e.id,hashPayrollToken('handbook-session')])
 const old={handbookText:'Original handbook policy',benefitsText:'Original benefits instructions'},current={...old,benefitsText:'Revised benefits instructions'}
 await api('/settings',old,200,false,'PATCH')
 const task=(await api('/onboarding',undefined,200,true)).tasks.find(t=>t.task_key==='HANDBOOK')
 const submit=policy=>api(`/onboarding/${task.id}`,{signature:'Current Signer',acknowledged:true,displayedHandbookTerms:policy},200,true)
 await submit(old)
 await api('/settings',current,200,false,'PATCH')
 await api(`/onboarding/${task.id}`,{signature:'Current Signer',acknowledged:true,displayedHandbookTerms:old},400,true)
 await api(`/employees/${e.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Stale policy cannot be reviewed'},409)
 assert.equal((await api('/onboarding',undefined,200,true)).tasks.find(t=>t.id===task.id).response.benefitsTerms,old.benefitsText)
 await submit(current)
 await api(`/employees/${e.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Reviewed current signed policy'})
 await api('/settings',{...current,handbookText:'Revised handbook policy'},200,false,'PATCH')
 const packet=await api(`/employees/${e.id}/onboarding`)
 assert.ok(packet.readiness.blockers.includes('Acknowledge the current handbook and benefits terms'))
 assert.equal(packet.readiness.complete,0)
 assert.ok(packet.reviewIssues.some(issue=>issue.taskId===Number(task.id)))
 await runWorkforceAutomation(h.pool,1,{sync:false,now:new Date('2026-08-03T12:00Z')})
 const alert=()=>h.pool.query('SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`acknowledgment-review-${e.id}`])
 assert.equal((await alert()).rows[0].status,'OPEN')
 await api(`/employees/${e.id}/activate`,{},409)
 await api(`/employees/${e.id}/onboarding/${task.id}/review`,{status:'CHANGES_REQUESTED',note:'Please acknowledge the revised policy'})
 await runWorkforceAutomation(h.pool,1,{sync:false,now:new Date('2026-08-03T12:00Z')})
 assert.equal((await alert()).rows[0].status,'OPEN')
 await submit({...current,handbookText:'Revised handbook policy'})
 await runWorkforceAutomation(h.pool,1,{sync:false,now:new Date('2026-08-03T12:00Z')})
 assert.equal((await alert()).rows[0].status,'DISMISSED')
 const history=await api(`/employees/${e.id}/onboarding/${task.id}/history`)
 assert.ok(history.some(r=>r.snapshot.response.benefitsTerms===old.benefitsText))
 assert.ok(history.some(r=>r.snapshot.status==='COMPLETE'&&r.snapshot.response.benefitsTerms===current.benefitsText))
})
