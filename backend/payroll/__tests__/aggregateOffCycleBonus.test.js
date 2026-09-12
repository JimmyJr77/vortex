import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
test('aggregate annual bonuses calculate without qualifying flat withholding and subtract repeated payment tax once',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,method='POST')=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 await api('/settings',{legalBusinessName:'Standalone PTO Fixture',businessAddress:'123 Test Street',businessPhone:'5550100000'},200,'PATCH')
 await api('/employer-taxes',{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Synthetic employer notice',confirmed:true},200,'PATCH')
 const e=await api('/employees',{employeeNumber:'PTO-OFF-CYCLE',legalFirstName:'Former',legalLastName:'Vacation',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-09-05',w4_status='COMPLETE',state_withholding_status='COMPLETE' WHERE id=$1",[e.id])
 await api(`/employees/${e.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed tax elections',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},200,'PATCH')
 const p=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency,status) VALUES(1,'2026-08-31','2026-09-06','2026-09-08','WEEKLY','PAID') RETURNING id")).rows[0]
 const original=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status,payment_date,payment_confirmation_reference,calculation_snapshot) VALUES(1,$1,'FINALIZED','2026-09-08','SYNTHETIC-REGULAR-PAY',$2) RETURNING id",[p.id,{employees:[{employeeId:e.id,grossPayCents:10000,payItems:[]}]}])).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,regular_pay_cents,federal_income_tax_cents,withholding_verified_at) VALUES($1,$2,$3,$4,now())',[original.id,e.id,10000,0])
 await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-09-07','2026-09-13','2026-09-18','WEEKLY')")
 const date='2026-09-09'
 const bonus={employeeId:e.id,amountCents:10000,classification:'DISCRETIONARY',paymentType:'ANNUAL_LUMP_SUM',confirmed:true,source:'Synthetic discretionary annual bonus without a prior promise',amountDiscretionVerified:true,paymentDiscretionVerified:true,noPriorPromiseVerified:true,historyCompleteVerified:true,stateBonusRateVerified:true,historySource:'Synthetic complete employer payment history reconciliation',federalMethod:'AGGREGATE'}
 await api('/runs/preview',{payPeriodId:p.id})
 await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE facility_id=1")
 for(const [index,federal] of [0,0,904,1000].entries()){
  const body={payPeriodId:p.id,paymentDate:date,offCycleBonus:{...bonus,requestKey:`aggregate-bonus-request-${index}`}}
  const preview=(await api('/runs/preview',body)).preview
  assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings))
  const employee=preview.employees[0]
  assert.equal(employee.federalIncomeTaxCents,federal);assert.equal(employee.stateIncomeTaxCents,970)
  assert.equal(employee.supplementalTax.aggregateBasis.regularRunId,Number(original.id))
  assert.equal(employee.supplementalTax.aggregateBasis.previousSupplementalCents,index*10000)
  if(index===0){
   const flat=(await api('/runs/preview',{...body,offCycleBonus:{...body.offCycleBonus,federalMethod:'FLAT_22'}})).preview
   assert.ok(flat.warnings.some(w=>w.message.includes('Flat 22%')))
   await api('/runs/preview',{...body,offCycleBonus:{...body.offCycleBonus,federalMethod:'UNKNOWN'}},409)
  }
  const run=await api('/runs',body,201)
  assert.equal((await api('/runs',body)).id,run.id)
  await api('/runs',{...body,offCycleBonus:{...body.offCycleBonus,federalMethod:'FLAT_22'}},409)
  await api(`/runs/${run.id}/status`,{status:'REVIEW'},200,'PATCH')
  await api(`/runs/${run.id}/status`,{status:'APPROVED'},200,'PATCH')
  await api(`/runs/${run.id}/finalize`,{paymentDate:date,paymentConfirmationReference:`SYNTHETIC-AGGREGATE-BONUS-${index}`})
  const paid=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
  assert.equal(Number(paid.net_pay_cents),8265-federal)
  assert.equal(paid.statement_snapshot.supplementalTax.method,'AGGREGATE')
  assert.equal(Number(paid.regular_minutes)+Number(paid.overtime_minutes)+Number(paid.sick_leave_accrual_minutes),0)
 }
})
