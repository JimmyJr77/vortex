import test from 'node:test'
import assert from 'node:assert/strict'
import {reconcileSupplementalPayments,loadSupplementalPaymentHistory} from '../supplementalPaymentHistory.js'
import {createHarness} from '../testing/harness.js'
const row=(id,date,items=[])=>({run_id:id,employee_id:1,payment_date:date,payment_confirmation_reference:'SYNTHETIC-PAID',withholding_verified_at:'2026-08-14T12:00:00Z',regular_pay_cents:100000,overtime_pay_cents:0,other_taxable_pay_cents:items.reduce((sum,i)=>sum+i.amountCents,0),federal_income_tax_cents:10000,calculation_snapshot:{employees:[{employeeId:1,grossPayCents:100000+items.reduce((sum,i)=>sum+i.amountCents,0),payItems:items}]}})
test('supplemental history distinguishes wage classes, calendar years and qualifying regular withholding',()=>{
 const rows=[row(1,'2025-12-31'),row(2,'2026-08-14',[{kind:'BONUS',amountCents:10000},{kind:'BONUS_OVERTIME',amountCents:1000}]),row(3,'2026-08-21',[{kind:'LEAVE_PAYOUT',amountCents:20000}]),row(4,'2026-10-01',[{kind:'BONUS',amountCents:99000}])]
 const r=reconcileSupplementalPayments(rows,'2026-09-09')
 assert.equal(r.reconciled,true);assert.equal(r.ytdSupplementalCents,30000);assert.equal(r.regularWithholdingVerified,true)
 assert.deepEqual(r.evidence.map(e=>e.runId),[1,2,3])
 assert.equal(reconcileSupplementalPayments(rows.slice(1),'2026-09-09').regularWithholdingVerified,false)
 assert.equal(reconcileSupplementalPayments([...rows].reverse(),'2026-09-09').fingerprint,r.fingerprint)
})
test('unreconciled earnings and payment evidence cannot authorize supplemental tax treatment',()=>{
 const valid=row(1,'2026-08-14',[{kind:'BONUS',amountCents:10000}])
 for(const override of [{other_taxable_pay_cents:1},{payment_confirmation_reference:null},{withholding_verified_at:null},{federal_income_tax_cents:''},{calculation_snapshot:{employees:[]}},{calculation_snapshot:{employees:[...valid.calculation_snapshot.employees,...valid.calculation_snapshot.employees]}},{calculation_snapshot:{employees:[{employeeId:1,grossPayCents:110000,payItems:[{kind:'UNKNOWN',amountCents:10000}]}]}}]){
  const r=reconcileSupplementalPayments([{...valid,...override}],'2026-09-09');assert.equal(r.reconciled,false);assert.equal(r.regularWithholdingVerified,false)
 }
 assert.throws(()=>reconcileSupplementalPayments([],'2026-02-30'),/valid payment date/)
})
test('supplemental history loader scopes records and requires allocation of imported totals',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const response=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'SUPPLEMENTAL-HISTORY',legalFirstName:'History',legalLastName:'Fixture',hireDate:'2026-01-01',hourlyRateCents:2500})})
 assert.equal(response.status,201);const e=(await response.json()).data
 const p=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
 const example=row(1,'2026-08-14',[{kind:'BONUS',amountCents:10000}]);example.calculation_snapshot.employees[0].employeeId=Number(e.id)
 const r=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status,calculation_snapshot,payment_confirmation_reference) VALUES(1,$1,'FINALIZED',$2,'SYNTHETIC-PAID') RETURNING id",[p.id,example.calculation_snapshot])).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,regular_pay_cents,other_taxable_pay_cents,federal_income_tax_cents,withholding_verified_at) VALUES($1,$2,100000,10000,10000,now())',[r.id,e.id])
 assert.equal((await loadSupplementalPaymentHistory(h.pool,1,e.id,'2026-09-09')).ytdSupplementalCents,10000)
 assert.equal((await loadSupplementalPaymentHistory(h.pool,2,e.id,'2026-09-09')).evidence.length,0)
 await h.pool.query("INSERT INTO payroll_historical_payment(facility_id,employee_id,period_start,period_end,payment_date,method,gross_amount_cents,net_amount_cents) VALUES(1,$1,'2026-01-01','2026-01-15','2026-01-20','CHECK',100000,90000)",[e.id])
 const imported=await loadSupplementalPaymentHistory(h.pool,1,e.id,'2026-09-09')
 assert.equal(imported.reconciled,false);assert.match(imported.issues[0].messages[0],/Imported payment totals/)
})
