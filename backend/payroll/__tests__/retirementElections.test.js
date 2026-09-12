import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
import {hashPayrollToken} from '../employeeAuth.js'
test('employee retirement elections retain signed terms, future dates and scoped idempotent history',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 let now=new Date('2026-09-11T12:00:00Z');const h=await createHarness({retirementNow:()=>now});t.after(()=>h.close())
 const api=async(path,body,status=200,token='payroll-test-admin')=>{const r=await fetch(`${h.url}/api/${token==='payroll-test-admin'?'admin/payroll':'payroll/employee'}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const json=await r.json();assert.equal(r.status,status,JSON.stringify(json));return json.data}
 const e=await api('/employees',{employeeNumber:'ELECTION',legalFirstName:'Synthetic',legalLastName:'Employee',hireDate:'2026-09-01',hourlyRateCents:2500},201)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[e.id,hashPayrollToken('election-session')])
 const employee=(path='/retirement',body,status=200)=>api(path,body,status,'election-session')
 assert.deepEqual((await employee()).plans,[])
 const plan=retirementPlanFixture();await api('/retirement-plans',{plan,expectedRevision:0,requestKey:randomUUID()})
 const path=`/employees/${e.id}/retirement-eligibility/standard`,source=(await api(path)).source
 const review={sourceFingerprint:source.fingerprint,expectedRevision:0,requestKey:randomUUID(),confirmed:true,disposition:'ELIGIBLE',eligibleOn:'2026-09-01',methods:['PERCENTAGE','FIXED_PER_REGULAR_PAY'],reference:'PRIVATE administrator service review.',employeeExplanation:'You are eligible under the reviewed service rules.'}
 await api(path,review)
 const data=await employee('/retirement?employeeId=999&facilityId=2'),proposal=data.plans[0].proposal
 assert.equal(proposal.employeeId,e.id);assert.equal(proposal.earliestEffectiveOn,'2026-09-12');assert.equal(JSON.stringify(data).includes('PRIVATE'),false);assert.equal(JSON.stringify(data).includes(plan.planReference),false)
 const body={expectedRevision:0,requestKey:randomUUID(),action:'ELECT',method:'PERCENTAGE',pretax:500,roth:200,effectiveOn:'2026-09-12',signature:'Synthetic Employee',confirmed:true,proposalFingerprint:proposal.fingerprint}
 const submit=b=>employee('/retirement/standard/elections',b)
 const [a,b]=await Promise.all([submit(body),submit(body)]);assert.equal(a.id,b.id)
 assert.equal((await employee()).plans[0].history.length,1)
 const adminHistory=await api(`/employees/${e.id}/retirement-elections`);assert.equal(adminHistory.plans[0].history[0].id,a.id)
 const other=await api('/employees',{employeeNumber:'OTHER-ELECTION',legalFirstName:'Other',legalLastName:'Employee',hireDate:'2026-09-01',hourlyRateCents:2500},201)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[other.id,hashPayrollToken('other-election')])
 assert.deepEqual((await api(`/retirement?employeeId=${e.id}`,undefined,200,'other-election')).plans,[])
 await api('/retirement/standard/elections',{...body,employeeId:e.id},409,'other-election')
 const foreign=await fetch(`${h.url}/api/admin/payroll/employees/${e.id}/retirement-elections`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(foreign.status,404)
 await assert.rejects(h.pool.query('UPDATE payroll_retirement_election SET employee_id=$1',[other.id]),/append-only/)

 await employee('/retirement/standard/elections',{...body,pretax:600},409)
 await employee('/retirement/standard/elections',{...body,requestKey:randomUUID()},409)
 await employee('/retirement/standard/elections',{...body,expectedRevision:1,requestKey:randomUUID(),effectiveOn:'2026-09-11'},400)
 await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_election'),/append-only/)
 await api(path,{...review,expectedRevision:1,requestKey:randomUUID()})
 assert.notEqual((await employee()).plans[0].proposal.fingerprint,proposal.fingerprint)
 await employee('/retirement/standard/elections',{...body,expectedRevision:1,requestKey:randomUUID()},400)
 assert.equal((await submit(body)).id,a.id)
 let current=(await employee()).plans[0]
 await submit({...body,expectedRevision:1,requestKey:randomUUID(),proposalFingerprint:current.proposal.fingerprint,action:'DECLINE',pretax:0,roth:0})
 assert.equal((await employee()).plans[0].history[0].election.action,'DECLINE')
 now=new Date('2026-09-12T02:00:00Z');assert.equal((await employee()).plans[0].proposal.earliestEffectiveOn,'2026-09-12')
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-09-01','2026-09-15','2026-09-20','SEMIMONTHLY') RETURNING id")).rows[0]
 const run=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(1,$1,'APPROVED') RETURNING id",[period.id])).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id) VALUES($1,$2)',[run.id,e.id])
 current=(await employee()).plans[0];assert.equal(current.proposal.earliestEffectiveOn,'2026-09-21')
 await employee('/retirement/standard/elections',{...body,expectedRevision:2,requestKey:randomUUID(),proposalFingerprint:current.proposal.fingerprint,effectiveOn:'2026-09-20'},400)
 now=new Date('2027-01-01T12:00:00Z');current=(await employee()).plans[0];assert.equal(current.status,'YEAR_REVIEW_REQUIRED');assert.equal(current.proposal,null)
 await h.pool.query('UPDATE payroll_employee_session SET revoked_at=now() WHERE employee_id=$1',[e.id]);await employee('/retirement',undefined,401);await employee('/retirement/standard/elections',body,401)
})
