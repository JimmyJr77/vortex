import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {hashPayrollToken} from '../employeeAuth.js'
import {validateResponse,wageNoticeTerms,wageAcknowledgmentCurrent} from '../onboarding.js'
test('hiring acknowledgment requires displayed terms and detects every changed term',()=>{
 const employee={job_title:'Coach',hourly_rate_cents:2500,pay_type:'HOURLY',overtime_classification:'NONEXEMPT',hire_date:'2026-08-03',primary_work_location:'Bowie'}
 const terms=wageNoticeTerms(employee,{}),body={signature:'Test Person',acknowledged:true,displayedWageTerms:terms}
 assert.throws(()=>validateResponse('WAGE_NOTICE',{signature:'Test Person',acknowledged:true},employee,{}),/Hiring terms changed/)
 const response=validateResponse('WAGE_NOTICE',body,employee,{})
 assert.equal(wageAcknowledgmentCurrent(response,employee,{}),true)
 for(const field of Object.keys(terms))assert.throws(()=>validateResponse('WAGE_NOTICE',{...body,displayedWageTerms:{...terms,[field]:'changed'}},employee,{}),/Hiring terms changed/)
 assert.equal(wageAcknowledgmentCurrent(response,{...employee,job_title:'Lead Coach'},{}),false)
})
test('stale hiring notice cannot be reviewed or used for activation',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,employee=false)=>{const r=await fetch(`${h.url}/api/${employee?'payroll/employee':'admin/payroll'}${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${employee?'wage-ack-session':'payroll-test-admin'}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:'CURRENT-WAGE-ACK',legalFirstName:'Current',legalLastName:'Hire',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[e.id,hashPayrollToken('wage-ack-session')])
 const packet=await api('/onboarding',undefined,200,true),task=packet.tasks.find(t=>t.task_key==='WAGE_NOTICE')
 await api(`/onboarding/${task.id}`,{signature:'Current Hire',acknowledged:true},400,true)
 await api(`/onboarding/${task.id}`,{signature:'Current Hire',acknowledged:true,displayedWageTerms:packet.wageTerms},200,true)
 await h.pool.query("UPDATE payroll_employee SET job_title='Revised role' WHERE id=$1",[e.id])
 await api(`/employees/${e.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Old signed terms cannot be reviewed'},409)
 const current=await api('/onboarding',undefined,200,true)
 await api(`/onboarding/${task.id}`,{signature:'Current Hire',acknowledged:true,displayedWageTerms:current.wageTerms},200,true)
 await api(`/employees/${e.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Reviewed the revised hiring notice'})
 await h.pool.query("UPDATE payroll_employee SET primary_work_location='New work location' WHERE id=$1",[e.id])
 const stale=await api(`/employees/${e.id}/onboarding`)
 assert.ok(stale.readiness.blockers.includes('Acknowledge the current hiring pay terms'))
 assert.equal(stale.readiness.complete,0)
 assert.ok(stale.reviewIssues.some(issue=>issue.taskId===Number(task.id)))
 await api(`/employees/${e.id}/activate`,{},409)
 const history=await api(`/employees/${e.id}/onboarding/${task.id}/history`)
 assert.ok(history.some(r=>r.snapshot.response.terms?.jobTitle===packet.wageTerms.jobTitle))
 assert.ok(history.some(r=>r.snapshot.status==='COMPLETE'&&r.snapshot.response.terms?.jobTitle==='Revised role'))
})
