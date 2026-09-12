import test from 'node:test'
import assert from 'node:assert/strict'
import {employeeSummaryCsv} from '../employeeSummary.js'
import {createHarness} from '../testing/harness.js'
test('employee reconciliation uses actual payment dates, exact totals, inactive employees and scoped evidence',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,facility=1)=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined});return response}
 const create=await api('/employees',{employeeNumber:'=SUMMARY',legalFirstName:'Annual',legalLastName:'Fixture',hireDate:'2025-01-01',hourlyRateCents:2500})
 const employee=(await create.json()).data
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-01-01' WHERE id=$1",[employee.id])
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2025-12-16','2025-12-31','2026-01-05','SEMIMONTHLY') RETURNING id")).rows[0]
 for(const [status,payment,amount] of [['FINALIZED','2026-01-05',100000],['FINALIZED','2025-12-31',200000],['DRAFT','2026-01-06',900000]]){
  const run=(await h.pool.query('INSERT INTO payroll_run(facility_id,pay_period_id,payment_date,status) VALUES(1,$1,$2,$3) RETURNING id',[period.id,payment,status])).rows[0]
  await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,regular_pay_cents,overtime_pay_cents,federal_income_tax_cents,state_income_tax_cents,social_security_tax_cents,medicare_tax_cents,net_pay_cents,reimbursement_cents,futa_tax_cents,md_ui_tax_cents) VALUES($1,$2,$3,10000,5000,3000,6820,1595,95585,2000,660,2860)',[run.id,employee.id,amount])
 }
 let report=await employeeSummaryCsv(h.pool,1,'2026-01-01','2026-12-31'),row=Object.fromEntries(report[0].map((key,index)=>[key,report[1][index]]))
 assert.equal(row['Retained Social Security taxable wages'],'');assert.match(row['Wage-basis review'],/retained wage basis missing/);
 assert.equal(report.length,2);assert.equal(row['Regular pay'],'1000.00');assert.equal(row['Finalized gross'],'1100.00');assert.equal(row['Employer Social Security'],'68.20');assert.equal(row['Reimbursements'],'20.00');assert.equal(row['Current employment status'],'TERMINATED');assert.equal(String(row['Finalized run count']),'1')
 await h.pool.query("INSERT INTO payroll_historical_payment(facility_id,employee_id,period_start,period_end,payment_date,gross_amount_cents,employee_tax_withheld_cents,net_amount_cents,method,reference,reconciliation_status) VALUES(1,$1,'2026-01-16','2026-01-31','2026-02-01',50000,10000,40000,'CHECK','SYNTHETIC-IMPORTED','RECONCILED')",[employee.id])
 report=await employeeSummaryCsv(h.pool,1,'2026-01-01','2026-12-31');row=Object.fromEntries(report[0].map((key,index)=>[key,report[1][index]]))
 assert.equal(row['Retained Medicare taxable wages'],'');assert.match(row['Wage-basis review'],/Imported wage bases require reconciliation/);
 assert.equal(row['Imported gross'],'500.00');assert.equal(row['Finalized gross'],'1100.00');assert.equal(row['Review status'],'IMPORTED TAX DETAIL REQUIRES RECONCILIATION')
 assert.equal((await employeeSummaryCsv(h.pool,2,'2026-01-01','2026-12-31')).length,1)
 const viewed=await api('/reports/wage-bases?start=2026-01-01&end=2026-12-31');assert.equal(viewed.status,200);assert.equal(viewed.headers.get('cache-control'),'no-store')
 const wageView=(await viewed.json()).data.employees;assert.equal(wageView.length,1);assert.equal(wageView[0].socialSecurityWages,null);assert.match(wageView[0].review,/Imported wage bases/)
 assert.deepEqual((await (await api('/reports/wage-bases?start=2026-01-01&end=2026-12-31',undefined,2)).json()).data.employees,[])
 assert.equal((await api('/reports/wage-bases?start=2026-12-31&end=2026-01-01')).status,400)
 assert.equal((await fetch(`${h.url}/api/admin/payroll/reports/wage-bases?start=2026-01-01&end=2026-12-31`)).status,401)
 const response=await api('/reports/employee-summary.csv?start=2026-01-01&end=2026-12-31')
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.match(await response.text(),/'=SUMMARY/)
 assert.equal((await api('/reports/employee-summary.csv?start=2026-12-31&end=2026-01-01')).status,400)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM payroll_audit_log WHERE action='EXPORT' AND entity_type='employee_payroll_summary'")).rows[0].n,1)
})
