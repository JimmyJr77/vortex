import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
for(const [salary,priorGross,expectedNet,expectedSocial,expectedAdditional] of [[false,100000,6065,620,0],[true,18449000,6623,62,0],[false,19999000,6604,0,81]])test(`standalone annual bonus preserves regular payroll: salary=${salary}, prior wages=${priorGross}`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,method='POST')=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 await api('/settings',{legalBusinessName:'Standalone Bonus Fixture',businessAddress:'123 Test Street',businessPhone:'5550100000'},200,'PATCH')
 await api('/employer-taxes',{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Synthetic verified employer tax notice',confirmed:true},200,'PATCH')
 const e=await api('/employees',{employeeNumber:'OFFCYCLE-BONUS',legalFirstName:'Former',legalLastName:'Worker',hireDate:'2026-08-03',...(salary?{payType:'SALARY',annualSalaryCents:7800000,jobTitle:'Coordinator'}:{hourlyRateCents:2500})},201)
 if(salary)await api(`/employees/${e.id}/salary-review`,{classification:'NONEXEMPT',fixed40Verified:true,minimumWageVerified:true,minimumWageCents:1500,source:'Synthetic fixed forty hour salary agreement',confirmed:true})
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-08',w4_status='COMPLETE',state_withholding_status='COMPLETE' WHERE id=$1",[e.id])
 await api(`/employees/${e.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed tax elections',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},200,'PATCH')
 const p=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency,status) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY','PAID') RETURNING id")).rows[0]
 const original=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status,payment_date,payment_confirmation_reference,calculation_snapshot) VALUES(1,$1,'FINALIZED','2026-08-14','SYNTHETIC-REGULAR-PAY',$2) RETURNING id",[p.id,{employees:[{employeeId:e.id,grossPayCents:priorGross,payItems:[]}]}])).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,regular_pay_cents,federal_income_tax_cents,withholding_verified_at) VALUES($1,$2,$3,10000,now())',[original.id,e.id,priorGross])
 let processing=p
 if(salary){
  await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',hire_date='2026-10-01',termination_date=NULL WHERE id=$1",[e.id])
  processing=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-10-05','2026-10-11','2026-10-16','WEEKLY') RETURNING id")).rows[0]
 }
 const body={payPeriodId:processing.id,paymentDate:'2026-09-09',offCycleBonus:{employeeId:e.id,amountCents:10000,classification:'DISCRETIONARY',paymentType:'ANNUAL_LUMP_SUM',confirmed:true,source:'Synthetic discretionary bonus decision with no prior promise',amountDiscretionVerified:true,paymentDiscretionVerified:true,noPriorPromiseVerified:true,historyCompleteVerified:true,stateBonusRateVerified:true,historySource:'Synthetic complete employer and related employer records',requestKey:'synthetic-standalone-bonus-1'}}
 const unreviewed=(await api('/runs/preview',body)).preview
 assert.ok(unreviewed.warnings.some(w=>w.code.startsWith('COMPLIANCE_')&&w.blocking))
 await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE facility_id=1")
 const preview=(await api('/runs/preview',body)).preview,w=preview.employees[0]
 assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings));assert.equal(w.regularPayCents,0);assert.equal(w.grossPayCents,10000)
 assert.equal(w.federalIncomeTaxCents,2200);assert.equal(w.stateIncomeTaxCents,970);assert.equal(w.netPayCents,expectedNet);assert.equal(w.socialSecurityTaxCents,expectedSocial);assert.equal(w.additionalMedicareTaxCents,expectedAdditional);assert.equal(w.sickLeaveAccrualMinutes,0)
 if(priorGross===100000){
  await h.pool.query("CREATE FUNCTION reject_bonus_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='OFF_CYCLE_BONUS_REVIEWED' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$")
  await h.pool.query('CREATE TRIGGER reject_bonus_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_bonus_audit()')
  await api('/runs',body,500)
  assert.equal((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_run WHERE run_kind='OFF_CYCLE_BONUS'")).rows[0].n,0)
  await h.pool.query('DROP TRIGGER reject_bonus_audit ON payroll_audit_log')
 }
 const run=await api('/runs',body,201);assert.equal(run.run_kind,'OFF_CYCLE_BONUS')
 assert.equal((await api('/runs',body)).id,run.id)
 if(!salary)assert.ok((await api(`/employees/${e.id}/final-pay`,undefined,200,'GET')).issues.some(i=>i.includes('standalone bonus payments')))

 await api('/runs',{...body,offCycleBonus:{...body.offCycleBonus,amountCents:20000}},409)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},200,'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},200,'PATCH')
 await api(`/runs/${run.id}/finalize`,{paymentDate:body.paymentDate,paymentConfirmationReference:'SYNTHETIC-STANDALONE-BONUS'})
 const row=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
 if(!salary)assert.ok(!(await api(`/employees/${e.id}/final-pay`,undefined,200,'GET')).issues.some(i=>i.includes('standalone bonus payments')))
 assert.equal(Number(row.net_pay_cents),expectedNet);assert.equal(row.statement_snapshot.supplementalTax.federalIncomeTaxCents,2200)
 assert.equal(row.statement_snapshot.runKind,'OFF_CYCLE_BONUS');assert.doesNotMatch(JSON.stringify(row.statement_snapshot),/Synthetic complete employer/)
 assert.equal((await h.pool.query('SELECT status FROM payroll_pay_period WHERE id=$1',[p.id])).rows[0].status,'PAID')
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_leave_transaction WHERE employee_id=$1',[e.id])).rows[0].n,0)
 if(salary){
  const regular=(await api('/runs/preview',{payPeriodId:processing.id,paymentDate:'2026-10-16'})).preview.employees[0]
  assert.equal(regular.regularPayCents,150000)
  assert.equal(regular.socialSecurityTaxCents,0,'Same-period paid bonus must consume the remaining Social Security wage base')
  assert.equal((await h.pool.query('SELECT status FROM payroll_pay_period WHERE id=$1',[processing.id])).rows[0].status,'OPEN')
 }
 // The next separate payment sees the first bonus in supplemental and FICA history.
 const second=(await api('/runs/preview',{...body,offCycleBonus:{...body.offCycleBonus,requestKey:'synthetic-standalone-bonus-2'}})).preview.employees[0]
 assert.equal(second.supplementalTax.ytdSupplementalCents,10000);assert.equal(second.supplementalTax.ytdWagesCents,priorGross+10000)
})
