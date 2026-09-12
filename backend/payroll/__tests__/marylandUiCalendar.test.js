import test from 'node:test'
import assert from 'node:assert/strict'
import {calculateMarylandUiCalendar} from '../marylandUiCalendar.js'
const fixture=()=>({year:2026,quarters:[1,2,3,4].map(q=>({quarter:q,start:`2026-${String(q*3-2).padStart(2,'0')}-01`,end:new Date(Date.UTC(2026,q*3,0)).toISOString().slice(0,10),grossCents:0,agencies:[{agency:'MD_UI',liabilityCents:0}]})),deposits:[],filings:[]})
test('Maryland UI tracks required zero-wage reports separately from payments and adjusts 2026 weekends',()=>{
 const rows=calculateMarylandUiCalendar(fixture(),{first_quarter:1,last_quarter:4},'2027-03-01')
 assert.deepEqual(rows.map(q=>q.dueOn),['2026-04-30','2026-07-31','2026-11-02','2027-02-01'])
 assert.ok(rows.every(q=>q.paymentStatus==='NO_TAX_DUE'&&q.filingStatus==='OVERDUE'))
 assert.equal(calculateMarylandUiCalendar({...fixture(),year:2027},{first_quarter:1,last_quarter:4},'2027-03-01').length,0)
})
test('Maryland UI preserves quarter payment allocation, late filings and comparison review',()=>{
 const data=fixture();data.quarters[0].agencies[0].liabilityCents=1000;data.quarters[1].agencies[0].liabilityCents=2000
 data.deposits=[{id:1,agency:'MD_UI',tax_quarter:1,status:'RECORDED',paid_on:'2026-04-30',amount_cents:1500}]
 data.filings=[{form_type:'MD_UI',period_start:'2026-01-01',period_end:'2026-03-31',filed_on:'2026-04-30',status:'MATCHED',reference:'Q1'},{form_type:'MD_UI',period_start:'2026-04-01',period_end:'2026-06-30',filed_on:'2026-08-01',status:'MATCHED',reference:'Q2'}]
 let rows=calculateMarylandUiCalendar(data,{first_quarter:1,last_quarter:2},'2026-09-09')
 assert.equal(rows[0].paymentStatus,'COVERED');assert.equal(rows[0].filingStatus,'RECORDED')
 assert.equal(rows[1].balanceCents,2000);assert.equal(rows[1].filingStatus,'RECORDED_LATE')
 data.filings[0].status='PAYROLL_CHANGED';rows=calculateMarylandUiCalendar(data,{first_quarter:1,last_quarter:2},'2026-09-09');assert.equal(rows[0].filingStatus,'REVIEW_REQUIRED')
})
test('Maryland UI reporting setup is scoped, zero-wage reminders clear only on filing, and hidden payroll requires review',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const {createHarness}=await import('../testing/harness.js'),{runWorkforceAutomation}=await import('../workforceAutomation.js')
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,{method,status=200,facility=1}={})=>{
  const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:method||(body?'POST':'GET'),headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data
 }
 await h.pool.query("UPDATE payroll_settings SET md_ui_status='ACTIVE' WHERE facility_id=1")
 await api('/employer-taxes',{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Synthetic assigned unemployment rate notice',confirmed:true},{method:'PATCH'})
 assert.equal((await api('/maryland-ui-calendar?year=2026')).reliable,false)
 const config={year:2026,firstQuarter:2,lastQuarter:2,source:'Synthetic BEACON registration reporting quarter confirmation',confirmed:true,standardScheduleConfirmed:true}
 await api('/maryland-ui-reporting',{...config,firstQuarter:3},{status:400})
 await api('/maryland-ui-reporting',{...config,standardScheduleConfirmed:false},{status:400})
 await api('/maryland-ui-reporting',config)
 let calendar=await api('/maryland-ui-calendar?year=2026');assert.equal(calendar.reliable,true);assert.equal(calendar.quarters.length,1)
 assert.equal((await api('/maryland-ui-calendar?year=2026',undefined,{facility:2})).config,null)
 await runWorkforceAutomation(h.pool,1,{sync:false})
 const alert=async()=>(await h.pool.query("SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key='md-ui-deadlines-2026'")).rows[0]?.status
 assert.equal(await alert(),'OPEN')
 await api('/tax-filings',{formType:'MD_UI',periodStart:'2026-04-01',periodEnd:'2026-06-30',filedOn:'2026-07-31',reportedWagesCents:0,reportedTaxCents:0,reference:'SYNTHETIC-ZERO-WAGE-REPORT',confirmed:true},{status:201})
 calendar=await api('/maryland-ui-calendar?year=2026');assert.equal(calendar.quarters[0].filingStatus,'RECORDED');assert.equal(calendar.quarters[0].paymentStatus,'NO_TAX_DUE')
 await runWorkforceAutomation(h.pool,1,{sync:false});assert.equal(await alert(),'DISMISSED')
 const employee=await api('/employees',{employeeNumber:'MD-UI-TEST',legalFirstName:'Reporting',legalLastName:'Fixture',hireDate:'2026-01-01',hourlyRateCents:2500},{status:201})
 const p=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-01-01','2026-01-15','2026-01-20','SEMIMONTHLY') RETURNING id")).rows[0]
 const r=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,payment_date,status) VALUES(1,$1,'2026-01-20','FINALIZED') RETURNING id",[p.id])).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,regular_pay_cents,md_ui_tax_cents,federal_income_tax_cents,state_income_tax_cents) VALUES($1,$2,10000,260,0,0)',[r.id,employee.id])
 calendar=await api('/maryland-ui-calendar?year=2026');assert.equal(calendar.reliable,false);assert.ok(calendar.issues.some(i=>i.includes('outside')))
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM payroll_audit_log WHERE action='MD_UI_REPORTING_VERIFIED'")).rows[0].n,1)
})
