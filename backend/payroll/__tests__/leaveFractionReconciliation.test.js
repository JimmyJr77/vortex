import test from 'node:test'
import assert from 'node:assert/strict'
import {fractionRecovery} from '../leaveFractionReconciliation.js'
import {loadLeaveRemainder} from '../leaveRemainder.js'
import {createHarness} from '../testing/harness.js'
const row=(id,worked,accrued)=>({id,regular_minutes:worked,overtime_minutes:0,sick_leave_accrual_minutes:accrued})
test('historical fraction recovery combines old rounding losses without crediting already tracked runs',()=>{
 const rows=[row(1,1561,52),row(2,1589,52)]
 assert.deepEqual(fractionRecovery(rows),{items:[{runId:'1',workedMinutes:1561,accruedMinutes:52,recoveredThirtieths:1},{runId:'2',workedMinutes:1589,accruedMinutes:52,recoveredThirtieths:29}],creditMinutes:1,remainder:0,throughRunId:'2'})
 assert.throws(()=>fractionRecovery(rows,{through_run_id:2,remainder:0}),/No untracked/)
 assert.throws(()=>fractionRecovery([row(1,1561,53)]),/No untracked/)
 assert.throws(()=>fractionRecovery([row(1,1561,10)]),/No untracked/)
 assert.throws(()=>fractionRecovery([{...row(1,1561,52),statement_snapshot:{sickLeaveYearAccruedBeforeMinutes:2348}}]),/No untracked/)
 assert.equal(fractionRecovery([...rows,{...row(3,1560,52),statement_snapshot:{sickLeaveFraction:{version:1,remainderAfter:10}}},row(4,1565,52)]).remainder,15)
})
test('admin reconciliation credits a restoration once and unblocks future fractional carry',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200)=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data}
 const employee=await api('/employees',{employeeNumber:'RECOVER',legalFirstName:'Fraction',legalLastName:'Recovery',hireDate:'2026-01-01',hourlyRateCents:2500},201)
 const runs=[]
 for(const [month,minutes] of [[7,1561],[8,1589]]){
  const p=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,make_date(2026,$1,1),make_date(2026,$1,15),make_date(2026,$1,20),'SEMIMONTHLY') RETURNING id",[month])).rows[0]
  const r=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(1,$1,'FINALIZED') RETURNING id",[p.id])).rows[0];runs.push(r.id)
  await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,regular_minutes,sick_leave_accrual_minutes) VALUES($1,$2,$3,52)',[r.id,employee.id,minutes])
 }
 const plan=await api(`/employees/${employee.id}/leave-fractions/preview`,{})
 assert.equal(plan.creditMinutes,1);assert.equal(plan.remainder,0)
 const body={confirmed:true,source:'Verified historical payroll rounding review',previewToken:plan.previewToken}
 await api(`/employees/${employee.id}/leave-fractions/apply`,{...body,previewToken:'stale'},409)
 await api(`/employees/${employee.id}/leave-fractions/apply`,body)
 await api(`/employees/${employee.id}/leave-fractions/apply`,body,409)
 const ledger=(await h.pool.query('SELECT minutes,transaction_kind FROM payroll_leave_transaction WHERE employee_id=$1',[employee.id])).rows
 assert.deepEqual(ledger,[{minutes:1,transaction_kind:'RESTORATION'}])
 assert.deepEqual(await loadLeaveRemainder(h.pool,1,employee.id,-1,plan.effectiveOn),{remainder:0,sourceRunId:String(runs[1]),source:'RECONCILED_FRACTION'})
 assert.equal((await h.pool.query('SELECT SUM(sick_leave_accrual_minutes)::int AS n FROM payroll_run_employee WHERE employee_id=$1',[employee.id])).rows[0].n,104)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM payroll_audit_log WHERE action='LEAVE_FRACTIONS_RECONCILED'")).rows[0].n,1)
})
