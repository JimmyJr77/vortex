import test from 'node:test'
import assert from 'node:assert/strict'
import {assertEmploymentPaymentDate} from '../employmentPeriods.js'
import {createHarness} from '../testing/harness.js'
test('supplemental dates and annual leave openings retain historical employment across rehires',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200)=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data}
 const create=async(number,end,policy)=>{
  const employee=await api('/employees',{employeeNumber:number,legalFirstName:number,legalLastName:'Returning',hireDate:'2025-01-01',hourlyRateCents:2500},201)
  await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date=$2,sick_leave_policy=$3 WHERE id=$1",[employee.id,end,policy])
  await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',hire_date='2026-08-03',termination_date=NULL WHERE id=$1",[employee.id])
  await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,transaction_date,minutes,reason) VALUES(1,$1,'2025-12-01',3000,'Synthetic historical balance')",[employee.id])
  return employee
 }
 const employed=await create('EMPLOYED-AT-OPENING','2026-03-31','ACCRUAL')
 const gap=await create('SEPARATED-AT-OPENING','2025-12-31','FRONTLOAD')
 const future=await api('/employees',{employeeNumber:'LATER-FIRST-HIRE',legalFirstName:'Future',legalLastName:'Employee',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await assertEmploymentPaymentDate(h.pool,1,gap.id,'2026-02-01')
 await assertEmploymentPaymentDate(h.pool,1,gap.id,'2025-01-01')
 await assert.rejects(()=>assertEmploymentPaymentDate(h.pool,1,gap.id,'2024-12-31'),/first recorded employment/)
 await assert.rejects(()=>assertEmploymentPaymentDate(h.pool,2,gap.id,'2026-02-01'),/employment history/)
 await assert.rejects(()=>assertEmploymentPaymentDate(h.pool,1,gap.id,'2026-02-30'),/valid payment date/)
 const body={year:2026,carryCapMinutes:2400,frontloadMinutes:2400,confirmed:true,source:'Synthetic reviewed historical calendar-year leave policy'}
 const plan=await api('/leave-year/preview',body)
 const employedRow=plan.employees.find(e=>Number(e.id)===employed.id),gapRow=plan.employees.find(e=>Number(e.id)===gap.id)
 assert.equal(employedRow.employed_at_opening,true);assert.equal(employedRow.openingBalance,2400);assert.equal(employedRow.rolloverDelta,-600)
 assert.equal(gapRow.employed_at_opening,false);assert.equal(gapRow.openingBalance,3000);assert.equal(gapRow.grantMinutes,0);assert.equal(gapRow.rolloverDelta,0)
 assert.equal(plan.employees.some(e=>Number(e.id)===future.id),false)
 await api('/leave-year/apply',{...body,previewToken:plan.previewToken})
 const balances=(await h.pool.query('SELECT employee_id,SUM(minutes)::int n FROM payroll_leave_transaction GROUP BY employee_id')).rows
 assert.equal(balances.find(r=>Number(r.employee_id)===employed.id).n,2400)
 assert.equal(balances.find(r=>Number(r.employee_id)===gap.id).n,3000)
})
