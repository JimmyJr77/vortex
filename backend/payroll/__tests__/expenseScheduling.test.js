import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
test('expense approval skips locked, void and approved periods and retains the selected payroll dates',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200)=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:JSON.stringify(body)});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data}
 const employee=await api('/employees',{employeeNumber:'EXPENSE-SCHEDULE',legalFirstName:'Expense',legalLastName:'Fixture',hireDate:'2026-01-01',hourlyRateCents:2500},201)
 const periods=[]
 for(const [month,status] of [[1,'LOCKED'],[2,'VOID'],[3,'OPEN'],[4,'OPEN']])periods.push((await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency,status) VALUES(2,make_date(2099,$1,1),make_date(2099,$1,15),make_date(2099,$1,20),'SEMIMONTHLY',$2) RETURNING *",[month,status])).rows[0])
 await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(2,$1,'APPROVED')",[periods[2].id])
 const request=async()=>(await h.pool.query("INSERT INTO payroll_employee_request(facility_id,employee_id,kind,payload) VALUES(2,$1,'EXPENSE',$2) RETURNING id",[employee.id,{reason:'Synthetic supplies',amountCents:1234,receiptReference:'TEST-RECEIPT'}])).rows[0]
 const first=await request(),approval={status:'APPROVED',note:'Receipt verified',taxTreatmentVerified:true}
 await api(`/requests/${first.id}/review`,approval)
 const adjustment=(await h.pool.query('SELECT active_from::text,active_to::text FROM payroll_recurring_adjustment WHERE source_request_id=$1',[first.id])).rows[0]
 assert.deepEqual(adjustment,{active_from:'2099-04-01',active_to:'2099-04-15'})
 const saved=(await h.pool.query('SELECT payload FROM payroll_employee_request WHERE id=$1',[first.id])).rows[0].payload
 assert.equal(saved.reimbursementPeriod.payDate,'2099-04-20')
 assert.equal(saved.reimbursementPeriod.id,periods[3].id)
 await h.pool.query("UPDATE payroll_pay_period SET status='LOCKED' WHERE id=$1",[periods[3].id])
 const second=await request();await api(`/requests/${second.id}/review`,approval,409)
 assert.equal((await h.pool.query('SELECT status FROM payroll_employee_request WHERE id=$1',[second.id])).rows[0].status,'PENDING')
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_recurring_adjustment WHERE source_request_id=$1',[second.id])).rows[0].n,0)
})


test('future hire expenses wait for a payroll period that reaches employment, including a mid-period start',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200)=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:JSON.stringify(body)});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data}
 const employee=await api('/employees',{employeeNumber:'FUTURE-EXPENSE',legalFirstName:'Future',legalLastName:'Fixture',hireDate:'2099-04-10',hourlyRateCents:2500},201)
 await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency,status) VALUES(2,'2099-03-16','2099-03-31','2099-04-05','SEMIMONTHLY','OPEN')")
 const request=(await h.pool.query("INSERT INTO payroll_employee_request(facility_id,employee_id,kind,payload) VALUES(2,$1,'EXPENSE',$2) RETURNING id",[employee.id,{reason:'Synthetic pre-start supplies',amountCents:1234,receiptReference:'TEST-FUTURE-RECEIPT'}])).rows[0]
 const approval={status:'APPROVED',note:'Receipt verified before the start date',taxTreatmentVerified:true}
 await api(`/requests/${request.id}/review`,approval,409)
 assert.equal((await h.pool.query('SELECT status FROM payroll_employee_request WHERE id=$1',[request.id])).rows[0].status,'PENDING')
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_recurring_adjustment WHERE source_request_id=$1',[request.id])).rows[0].n,0)
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency,status) VALUES(2,'2099-04-01','2099-04-15','2099-04-20','SEMIMONTHLY','OPEN') RETURNING id")).rows[0]
 await api(`/requests/${request.id}/review`,approval)
 const saved=(await h.pool.query('SELECT payload FROM payroll_employee_request WHERE id=$1',[request.id])).rows[0].payload
 assert.equal(saved.reimbursementPeriod.id,period.id)
 assert.equal(saved.reimbursementPeriod.start,'2099-04-01')
 assert.equal(saved.reimbursementPeriod.payDate,'2099-04-20')
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[employee.id])
 const preview=(await api('/runs/preview',{payPeriodId:period.id,paymentDate:'2099-04-20'})).preview
 const paidEmployee=preview.employees.find(row=>row.employeeId===employee.id)
 assert.equal(paidEmployee.reimbursementCents,1234)
 assert.ok(paidEmployee.payItems.some(item=>item.kind==='REIMBURSEMENT'&&item.sourceRequestId===Number(request.id)&&item.amountCents===1234))
 await api(`/requests/${request.id}/review`,approval,409)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_recurring_adjustment WHERE source_request_id=$1',[request.id])).rows[0].n,1)
})
