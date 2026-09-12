import test from 'node:test'
import assert from 'node:assert/strict'
import {calculateFederalDeposits,nextFederalTaxBusinessDay} from '../federalTaxCalendar.js'
const row=(date,amount)=>({payment_date:date,federal_income:amount,social_security:0,medicare:0,additional_medicare:0})
const calculate=(rows,schedule='MONTHLY',deposits=[])=>calculateFederalDeposits(rows,{schedule},deposits,'2026-12-31')
test('federal deposit calendar uses DC holidays and three business days for semiweekly deposits',()=>{
 assert.equal(nextFederalTaxBusinessDay('2026-07-02'),'2026-07-06')
 assert.equal(nextFederalTaxBusinessDay('2026-04-15'),'2026-04-17')
 assert.equal(calculate([row('2026-05-29',100)] ,'SEMIWEEKLY').obligations[0].dueOn,'2026-06-03')
 assert.equal(calculate([row('2026-09-04',100)] ,'SEMIWEEKLY').obligations[0].dueOn,'2026-09-10')
 assert.equal(calculate([row('2026-04-14',100)] ,'SEMIWEEKLY').obligations[0].dueOn,'2026-04-20')
 assert.equal(calculate([row('2026-01-09',100)]).obligations[0].dueOn,'2026-02-17')
 assert.equal(calculate([row('2026-12-30',100)]).obligations[0].dueOn,'2027-01-15')
})
test('100000 threshold combines same-day payroll and changes the subsequent deposit schedule',()=>{
 const result=calculate([row('2026-05-06',4000000),row('2026-05-08',3000000),row('2026-05-08',3000000),row('2026-05-11',3000000)])
 assert.equal(result.nextYearSemiweeklyRequired,true);assert.equal(result.effectiveSchedule,'SEMIWEEKLY')
 assert.deepEqual(result.obligations.map(o=>[o.dueOn,o.liabilityCents,o.rule]),[['2026-05-11',10000000,'NEXT_DAY_100K'],['2026-05-15',3000000,'SEMIWEEKLY']])
 const boundary=calculate([row('2026-05-12',9500000),row('2026-05-13',1000000)],'SEMIWEEKLY')
 assert.equal(boundary.nextYearSemiweeklyRequired,false)
 assert.deepEqual(boundary.obligations.map(o=>o.dueOn),['2026-05-15','2026-05-20'])
 const prior=calculateFederalDeposits([row('2026-05-06',100)],{schedule:'MONTHLY',priorYearNextDay:true},[],'2026-05-06')
 assert.equal(prior.obligations[0].dueOn,'2026-05-13')
})
test('quarter-boundary deposits remain separate and receipts allocate within the quarter only',()=>{
 const rows=[row('2026-09-30',10000),row('2026-10-02',20000),row('2026-10-06',10000)]
 const deposits=[{id:1,agency:'IRS_941',status:'RECORDED',tax_quarter:3,paid_on:'2026-10-07',amount_cents:15000},{id:2,agency:'IRS_941',status:'RECORDED',tax_quarter:4,paid_on:'2026-10-08',amount_cents:22000},{id:3,agency:'IRS_941',status:'VOID',tax_quarter:4,paid_on:'2026-10-06',amount_cents:100000}]
 const result=calculate(rows,'SEMIWEEKLY',deposits)
 assert.deepEqual(result.obligations.map(o=>[o.quarter,o.dueOn,o.balanceCents,o.status]),[[3,'2026-10-07',0,'COVERED'],[4,'2026-10-07',0,'COVERED_LATE'],[4,'2026-10-09',8000,'OVERDUE']])
 assert.equal(result.obligations[1].lateCoveredCents,20000)
})

test('verified schedules, receipts and deadline alerts use scoped finalized PostgreSQL records',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const {createHarness}=await import('../testing/harness.js'),{runWorkforceAutomation}=await import('../workforceAutomation.js')
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,{status=200,facility=1,method}={})=>{
  const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:method||(body?'POST':'GET'),headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined})
  const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data
 }
 const employee=await api('/employees',{employeeNumber:'CALENDAR-1',legalFirstName:'Calendar',legalLastName:'Fixture',hireDate:'2026-01-01',hourlyRateCents:2500},{status:201})
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-05-01','2026-05-07','2026-05-08','SEMIMONTHLY') RETURNING id")).rows[0]
 const run=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,payment_date,status) VALUES(1,$1,'2026-05-08','APPROVED') RETURNING id",[period.id])).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,federal_income_tax_cents,futa_tax_cents,state_income_tax_cents) VALUES($1,$2,10000000,60000,0)',[run.id,employee.id])
 assert.equal((await api('/federal-deposit-calendar?year=2026')).reliable,false)
 const config={year:2026,schedule:'MONTHLY',priorYearNextDay:false,source:'Synthetic verified IRS lookback review and complete payroll',confirmed:true}
 await api('/federal-deposit-schedule',{...config,confirmed:false},{status:400})
 await api('/federal-deposit-schedule',config)
 await api('/employer-taxes',{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Synthetic employer credit and assigned rate verification',confirmed:true},{method:'PATCH'})
 assert.equal((await api('/federal-deposit-calendar?year=2026')).obligations.length,0)
 assert.equal((await api('/federal-deposit-calendar?year=2026',undefined,{facility:2})).config,null)
 await h.pool.query("UPDATE payroll_run SET status='FINALIZED' WHERE id=$1",[run.id])
 let calendar=await api('/federal-deposit-calendar?year=2026')
 assert.equal(calendar.reliable,true);assert.equal(calendar.obligations[0].dueOn,'2026-05-11');assert.equal(calendar.nextYearSemiweeklyRequired,true)
 assert.equal(calendar.futa.reliable,true);assert.equal(calendar.futa.obligations[0].dueOn,'2026-07-31')
 await runWorkforceAutomation(h.pool,1,{sync:false})
 const alert=async()=> (await h.pool.query("SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key='federal-deposit-deadlines-2026'")).rows[0]?.status
 assert.equal(await alert(),'OPEN')
 assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key='futa-deposit-deadlines-2026'")).rows[0].status,'OPEN')
 await api('/tax-deposits',{agency:'IRS_941',year:2026,quarter:2,paidOn:'2026-05-11',amountCents:10000000,reference:'SYNTHETIC-CALENDAR-RECEIPT',confirmed:true},{status:201})
 calendar=await api('/federal-deposit-calendar?year=2026');assert.equal(calendar.obligations[0].status,'COVERED')
 await api('/tax-deposits',{agency:'IRS_FUTA',year:2026,quarter:2,paidOn:'2026-07-31',amountCents:60000,reference:'SYNTHETIC-FUTA-RECEIPT',confirmed:true},{status:201})
 calendar=await api('/federal-deposit-calendar?year=2026');assert.equal(calendar.futa.obligations[0].status,'COVERED')
 await runWorkforceAutomation(h.pool,1,{sync:false});assert.equal(await alert(),'DISMISSED')
 assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key='futa-deposit-deadlines-2026'")).rows[0].status,'DISMISSED')
 assert.equal((await api('/federal-deposit-calendar?year=2027')).reliable,false)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM payroll_audit_log WHERE action='FEDERAL_DEPOSIT_SCHEDULE_VERIFIED'")).rows[0].n,1)
})
