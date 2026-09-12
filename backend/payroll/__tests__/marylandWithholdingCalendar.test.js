import test from 'node:test'
import assert from 'node:assert/strict'
import {calculateMarylandWithholdingCalendar as calculate} from '../marylandWithholdingCalendar.js'
const taxes=()=>({year:2026,deposits:[],filings:[]})
const row=(payment_date,maryland)=>({run_id:1,employee_id:1,payment_date,maryland,gross:10000,federal_income:0,social_security:0,medicare:0,additional_medicare:0,futa:0,md_ui:0})
test('Maryland withholding uses state holidays, January 31 annual date, and zero returns',()=>{
 const result=calculate([],taxes(),{schedule:'MONTHLY',months:[1,2,3,7,10,12]},'2027-03-01')
 assert.deepEqual(result.periods.map(p=>p.dueOn),['2026-02-17','2026-03-16','2026-04-15','2026-08-17','2026-11-16','2027-01-15'])
 assert.ok(result.periods.every(p=>p.paymentStatus==='NO_TAX_DUE'&&p.filingStatus==='OVERDUE'))
 assert.equal(result.annual.dueOn,'2027-02-01')
 assert.equal(calculate([],taxes(),{schedule:'ANNUAL',months:[1]},'2026-09-09').periods[0].dueOn,'2027-02-01')
 assert.equal(calculate([],{...taxes(),year:2027},{schedule:'MONTHLY',months:[1]},'2027-09-09').periods.length,0)
})
test('Maryland withholding keeps quarter allocations and separates paid tax from missing, late and changed filings',()=>{
 const data=taxes(),rows=[row('2026-01-20',1000),row('2026-02-20',2000),row('2026-04-20',3000)]
 data.deposits=[{id:1,agency:'MD_WITHHOLDING',tax_quarter:1,status:'RECORDED',paid_on:'2026-03-01',amount_cents:4000},{id:2,agency:'MD_WITHHOLDING',tax_quarter:2,status:'VOID',paid_on:'2026-05-01',amount_cents:3000},{id:3,agency:'MD_WITHHOLDING',tax_quarter:2,status:'RECORDED',paid_on:'2027-01-01',amount_cents:3000}]
 data.filings=[{form_type:'MD_MW506',period_start:'2026-01-01',period_end:'2026-01-31',filed_on:'2026-03-01',reference:'LATE',status:'MATCHED'}]
 let result=calculate(rows,data,{schedule:'MONTHLY',months:[1,2,4]},'2026-09-09')
 assert.equal(result.periods[0].paymentStatus,'COVERED_LATE');assert.equal(result.periods[0].filingStatus,'RECORDED_LATE')
 assert.equal(result.periods[1].paymentStatus,'COVERED');assert.equal(result.periods[1].filingStatus,'OVERDUE')
 assert.equal(result.periods[2].balanceCents,3000);assert.equal(result.unappliedCents,1000)
 data.filings[0].status='PAYROLL_CHANGED';result=calculate(rows,data,{schedule:'MONTHLY',months:[1,2,4]},'2026-09-09');assert.equal(result.periods[0].filingStatus,'REVIEW_REQUIRED')
 result=calculate(rows,data,{schedule:'ANNUAL',months:[1]},'2026-09-09');assert.equal(result.periods[0].balanceCents,2000)
})
test('Maryland withholding configuration is scoped and audited; accepted zero returns clear reminders',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const {createHarness}=await import('../testing/harness.js'),{runWorkforceAutomation}=await import('../workforceAutomation.js')
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,{status=200,facility=1}={})=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data}
 const config={year:2026,schedule:'QUARTERLY',months:[4],source:'Synthetic Maryland Tax Connect account schedule',confirmed:true,standardScheduleConfirmed:true}
 await api('/maryland-withholding-schedule',{...config,months:[2]},{status:400})
 await api('/maryland-withholding-schedule',{...config,confirmed:false},{status:400})
 await api('/maryland-withholding-schedule',config)
 assert.equal((await api('/maryland-withholding-calendar?year=2026')).reliable,true)
 assert.equal((await api('/maryland-withholding-calendar?year=2026',undefined,{facility:2})).config,null)
 await runWorkforceAutomation(h.pool,1,{sync:false})
 const alert=async()=>(await h.pool.query("SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key='md-withholding-deadlines-2026'")).rows[0]?.status
 assert.equal(await alert(),'OPEN')
 await api('/tax-filings',{formType:'MD_MW506',periodStart:'2026-04-01',periodEnd:'2026-06-30',filedOn:'2026-07-15',reportedWagesCents:0,reportedTaxCents:0,reference:'SYNTHETIC-ZERO-MW506',confirmed:true},{status:201})
 assert.equal((await api('/maryland-withholding-calendar?year=2026')).periods[0].filingStatus,'RECORDED')
 await runWorkforceAutomation(h.pool,1,{sync:false});assert.equal(await alert(),'DISMISSED')
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM payroll_audit_log WHERE action='MD_WITHHOLDING_SCHEDULE_VERIFIED'")).rows[0].n,1)
 await api('/maryland-withholding-schedule',{...config,schedule:'ACCELERATED'})
 assert.equal((await api('/maryland-withholding-calendar?year=2026')).reliable,true)
 await runWorkforceAutomation(h.pool,1,{sync:false});assert.equal(await alert(),'OPEN')
 await api('/tax-filings',{formType:'MD_MW506M',periodStart:'2026-04-01',periodEnd:'2026-04-30',filedOn:'2026-05-15',reportedWagesCents:0,reportedTaxCents:0,reference:'SYNTHETIC-ZERO-MW506M',confirmed:true},{status:201})
 await runWorkforceAutomation(h.pool,1,{sync:false});assert.equal(await alert(),'DISMISSED')
 await api('/tax-filings',{formType:'MD_MW506M',periodStart:'2026-04-01',periodEnd:'2026-04-15',filedOn:'2026-04-16',reportedWagesCents:0,reportedTaxCents:0,reference:'SYNTHETIC-EARLY-MW506M',confirmed:true},{status:201})
 const early=await api('/maryland-withholding-calendar?year=2026')
 assert.equal(early.reliable,false);assert.ok(early.issues.some(i=>i.includes('different interval')))
 await runWorkforceAutomation(h.pool,1,{sync:false});assert.equal(await alert(),'OPEN')
})


test('accelerated Maryland deadlines aggregate same-day wages, reset each threshold, and preserve monthly residuals',()=>{
 const rows=[row('2026-07-01',30000),row('2026-07-02',25000),row('2026-07-02',15000),row('2026-07-10',70000),row('2026-07-20',500)]
 const data=taxes()
 data.deposits=[{id:1,agency:'MD_WITHHOLDING',tax_quarter:3,status:'RECORDED',paid_on:'2026-07-08',amount_cents:50000},{id:2,agency:'MD_WITHHOLDING',tax_quarter:3,status:'RECORDED',paid_on:'2026-07-09',amount_cents:90000}]
 let result=calculate(rows,data,{schedule:'ACCELERATED',months:[7,8]},'2026-09-09')
 assert.deepEqual(result.periods.map(p=>[p.start,p.end,p.dueOn,p.liabilityCents]),[
  ['2026-07-01','2026-07-02','2026-07-08',70000],
  ['2026-07-03','2026-07-10','2026-07-15',70000],
  ['2026-07-11','2026-07-31','2026-08-17',500],
  ['2026-08-01','2026-08-31','2026-09-15',0],
 ])
 assert.equal(result.periods[0].lateCoveredCents,20000)
 assert.equal(result.periods[0].paymentStatus,'COVERED_LATE')
 assert.equal(result.periods[1].paymentStatus,'COVERED')
 assert.equal(result.periods[0].filingStatus,'OVERDUE')
 assert.equal(result.periods[2].balanceCents,500)
 assert.equal(result.periods[3].paymentStatus,'NO_TAX_DUE')
 data.filings=[{form_type:'MD_MW506M',period_start:'2026-07-01',period_end:'2026-07-02',filed_on:'2026-07-08',reference:'ACCELERATED-RECEIPT',status:'MATCHED'}]
 result=calculate(rows,data,{schedule:'ACCELERATED',months:[7]},'2026-09-09')
 assert.equal(result.periods[0].filingStatus,'RECORDED')
 assert.equal(result.periods[1].filingStatus,'OVERDUE')
 assert.equal(result.periods.reduce((n,p)=>n+p.liabilityCents,0),140500)
})
test('accelerated thresholds include exactly $700, keep unpaid prior debt due, and cross year-end holidays',()=>{
 let result=calculate([row('2026-12-31',70000)],taxes(),{schedule:'ACCELERATED',months:[12]},'2027-01-08')
 assert.equal(result.periods.length,1);assert.equal(result.periods[0].dueOn,'2027-01-06')
 assert.equal(result.periods[0].paymentStatus,'OVERDUE')
 result=calculate([row('2026-01-05',70000),row('2026-01-20',70000)],taxes(),{schedule:'ACCELERATED',months:[1]},'2026-02-01')
 assert.deepEqual(result.periods.map(p=>p.balanceCents),[70000,70000])
 assert.deepEqual(result.periods.map(p=>p.dueOn),['2026-01-08','2026-01-23'])
 result=calculate([row('2026-01-05',69999)],taxes(),{schedule:'ACCELERATED',months:[1]},'2026-02-01')
 assert.equal(result.periods[0].reason,'MONTH_END');assert.equal(result.periods[0].dueOn,'2026-02-17')
})
