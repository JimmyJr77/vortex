import {statementLines} from '../payStatement.js'
import {unpaidExpenseCount} from '../offCycleReimbursement.js'
import {journalPayload} from '../quickbooks.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
test('former employee reimbursement uses a separate run without wages, accrual or locking regular time',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,method='POST',facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 await api('/settings',{legalBusinessName:'Expense Fixture',businessAddress:'123 Test Street',businessPhone:'5550100000'},200,'PATCH')
 const e=await api('/employees',{employeeNumber:'OFFCYCLE',legalFirstName:'Former',legalLastName:'Employee',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-08' WHERE id=$1",[e.id])
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,$1::date,$1::date+6,$1::date+10,'WEEKLY') RETURNING id",[today])).rows[0]
 const request=(await h.pool.query("INSERT INTO payroll_employee_request(facility_id,employee_id,kind,payload) VALUES(1,$1,'EXPENSE',$2) RETURNING id",[e.id,{reason:'Synthetic supplies expense',amountCents:12345,receiptReference:'SYNTHETIC-RECEIPT'}])).rows[0]
 await api(`/requests/${request.id}/review`,{status:'APPROVED',note:'Synthetic receipt and accountable plan verified',taxTreatmentVerified:true})
 const a=(await h.pool.query('SELECT id FROM payroll_recurring_adjustment WHERE source_request_id=$1',[request.id])).rows[0]
 assert.equal(await unpaidExpenseCount(h.pool,1,e.id),1)
 const args={adjustmentId:a.id,paymentDate:today},preview=await api('/off-cycle/reimbursements/preview',args)
 assert.equal(preview.preview.employees[0].grossPayCents,0);assert.equal(preview.preview.netPayCents,12345)
 await api('/off-cycle/reimbursements/preview',args,409,'POST',2)
 const legacy=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(1,$1,'FINALIZED') RETURNING id",[period.id])).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,reimbursement_cents) VALUES($1,$2,12345)',[legacy.id,e.id])
 await api('/off-cycle/reimbursements/preview',args,409)
 // One identifiable line must not hide the unexplained remainder of a legacy payment.
 for(const payItems of [
  [{kind:'REIMBURSEMENT',name:'Expense request 999999',amountCents:100}],
  [{kind:'REIMBURSEMENT',name:'Expense request 999999',amountCents:100},{kind:'REIMBURSEMENT',name:'Legacy expense',amountCents:12245}],
  [{kind:'REIMBURSEMENT',sourceRequestId:999999,amountCents:100},{kind:'REIMBURSEMENT',sourceRequestId:999999,amountCents:12245}],
  [{kind:'REIMBURSEMENT',sourceRequestId:999999,amountCents:'invalid'}],
 ]){
  await h.pool.query('UPDATE payroll_run SET calculation_snapshot=$1 WHERE id=$2',[{employees:[{employeeId:e.id,payItems}]},legacy.id])
  await api('/off-cycle/reimbursements/preview',args,409)
 }
 await h.pool.query('UPDATE payroll_run SET calculation_snapshot=$1 WHERE id=$2',[{employees:[{employeeId:e.id,payItems:[{kind:'REIMBURSEMENT',sourceRequestId:999999,amountCents:12345}]},{employeeId:e.id,payItems:[]}]},legacy.id])
 await api('/off-cycle/reimbursements/preview',args,409)
 // Fully reconciled, separately identified expenses are not this request.
 await h.pool.query('UPDATE payroll_run SET calculation_snapshot=$1 WHERE id=$2',[{employees:[{employeeId:e.id,payItems:[{kind:'REIMBURSEMENT',sourceRequestId:999999,amountCents:12345}]}]},legacy.id])
 await api('/off-cycle/reimbursements/preview',args)
 await h.pool.query("UPDATE payroll_run SET status='VOID' WHERE id=$1",[legacy.id])
 const body={payPeriodId:period.id,paymentDate:today,offCycleReimbursementId:a.id}
 let run=await api('/runs',body,201);
 await api(`/runs/${run.id}/status`,{status:'VOID'},200,'PATCH')
 run=await api('/runs',body,201);assert.equal(run.run_kind,'OFF_CYCLE_REIMBURSEMENT')
 await api('/runs',body,409)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},200,'PATCH')
 const original=(await h.pool.query('SELECT authorization_reference FROM payroll_recurring_adjustment WHERE id=$1',[a.id])).rows[0].authorization_reference
 await h.pool.query("UPDATE payroll_recurring_adjustment SET authorization_reference='Changed review evidence' WHERE id=$1",[a.id])
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},409,'PATCH')
 await h.pool.query('UPDATE payroll_recurring_adjustment SET authorization_reference=$1 WHERE id=$2',[original,a.id])
 await api(`/runs/${run.id}/employees/${e.id}/withholding`,{federalIncomeTaxCents:1,stateIncomeTaxCents:0,sourceNote:'Synthetic incorrect withholding',professionalConfirmed:true},409,'PATCH')
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},200,'PATCH')
 // An expense-only run must not freeze another employee's regular timesheet.
 const active=await api('/employees',{employeeNumber:'STILL-WORKING',legalFirstName:'Active',legalLastName:'Worker',hireDate:'2026-01-01',hourlyRateCents:2500},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[active.id])
 await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2::date+interval '12 hours',$2::date+interval '20 hours','ADMIN','APPROVED')",[active.id,today])
 const regular=(await api('/runs/preview',{payPeriodId:period.id})).preview
 assert.equal(regular.reimbursementCents,0)
 const regularRun=await api('/runs',{payPeriodId:period.id},201);assert.equal(regularRun.run_kind,'REGULAR')
 await api(`/runs/${run.id}/finalize`,{paymentDate:today,paymentConfirmationReference:'SYNTHETIC-EXPENSE-PAYMENT'})
 assert.equal((await h.pool.query('SELECT status FROM payroll_pay_period WHERE id=$1',[period.id])).rows[0].status,'OPEN')
 const row=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
 assert.equal(Number(row.regular_pay_cents),0);assert.equal(Number(row.sick_leave_accrual_minutes),0);assert.equal(Number(row.net_pay_cents),12345)
 assert.equal(await unpaidExpenseCount(h.pool,1,e.id),0)
 const finalized=(await h.pool.query('SELECT *,payment_date AS pay_date FROM payroll_run WHERE id=$1',[run.id])).rows[0]
 const journal=journalPayload(finalized,{reimbursements:'123',clearing:'456'})
 assert.deepEqual(journal.Line.map(l=>[l.Amount,l.JournalEntryLineDetail.PostingType]),[[123.45,'Debit'],[123.45,'Credit']])
 assert.equal(statementLines(row).lines.length,1)
 assert.equal(statementLines(row).lines[0][2],12345)
 assert.equal(row.statement_snapshot.payItems[0].sourceRequestId,Number(request.id))
 assert.equal(row.statement_snapshot.ficaWageBasis.socialSecurityTaxableCents,0)
 assert.equal(row.statement_snapshot.ficaWageBasis.medicareTaxableCents,0)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_leave_transaction WHERE employee_id=$1',[e.id])).rows[0].n,0)
 await api(`/runs/${run.id}/finalize`,{paymentDate:today,paymentConfirmationReference:'SYNTHETIC-EXPENSE-PAYMENT'},409)
 assert.equal((await api('/off-cycle/reimbursements',undefined,200,'GET')).length,0)
})
