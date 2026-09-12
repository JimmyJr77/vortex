import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {loadSupplementalPaymentHistory} from '../supplementalPaymentHistory.js'
for(const aggregate of [false,true])test(`standalone PTO settles reserved vacation: federal ${aggregate?'aggregate':'flat'}`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,method='POST')=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 await api('/settings',{legalBusinessName:'Standalone PTO Fixture',businessAddress:'123 Test Street',businessPhone:'5550100000'},200,'PATCH')
 await api('/employer-taxes',{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Synthetic employer notice',confirmed:true},200,'PATCH')
 const e=await api('/employees',{employeeNumber:'PTO-OFF-CYCLE',legalFirstName:'Former',legalLastName:'Vacation',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-09-05',w4_status='COMPLETE',state_withholding_status='COMPLETE' WHERE id=$1",[e.id])
 await api(`/employees/${e.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed tax elections',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},200,'PATCH')
 const p=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency,status) VALUES(1,'2026-08-31','2026-09-06','2026-09-08','WEEKLY','PAID') RETURNING id")).rows[0]
 const original=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status,payment_date,payment_confirmation_reference,calculation_snapshot) VALUES(1,$1,'FINALIZED','2026-09-08','SYNTHETIC-REGULAR-PAY',$2) RETURNING id",[p.id,{employees:[{employeeId:e.id,grossPayCents:aggregate?10000:100000,payItems:[]}]}])).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,regular_pay_cents,federal_income_tax_cents,withholding_verified_at) VALUES($1,$2,$3,$4,now())',[original.id,e.id,aggregate?10000:100000,aggregate?0:10000])
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-08-08',480,'Synthetic accrued vacation')",[e.id])
 await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-09-07','2026-09-13','2026-09-18','WEEKLY')")
 const policy={leaveType:'PTO',minutes:240,hourlyRateCents:2500,policyVerified:true,unusedVacationVerified:true,policyReference:'Synthetic communicated unused vacation policy'}
 const preview=await api(`/employees/${e.id}/leave-payout/preview`,policy)
 const reservation={...policy,payPeriodId:p.id,fingerprint:preview.fingerprint,requestKey:'standalone-pto-reservation-1',paymentMode:'STANDALONE'}
 await api(`/employees/${e.id}/leave-payouts`,{...reservation,paymentMode:'REGULAR'},409)
 const payout=await api(`/employees/${e.id}/leave-payouts`,reservation,201)
 assert.equal(payout.payment_mode,'STANDALONE')
 assert.equal((await api(`/employees/${e.id}/leave-payouts`,reservation)).id,payout.id)
 const regular=(await api('/runs/preview',{payPeriodId:p.id})).preview
 assert.ok(regular.employees.every(e=>!e.payItems.some(p=>p.kind==='LEAVE_PAYOUT')))
 if(aggregate)await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',hire_date='2099-09-07',termination_date=NULL WHERE id=$1",[e.id])
 const body={payPeriodId:p.id,paymentDate:preview.asOfDate,offCyclePto:{...(aggregate?{federalMethod:'AGGREGATE'}:{}),payoutId:payout.id,historyCompleteVerified:true,historySource:'Synthetic complete employer payment reconciliation'}}
 if(aggregate){const flat=(await api('/runs/preview',{...body,offCyclePto:{...body.offCyclePto,federalMethod:'FLAT_22'}})).preview;assert.equal(flat.employees[0].federalIncomeTaxCents,null);assert.ok(flat.warnings.some(w=>w.message.includes('Flat 22%')))}
 const w=(await api('/runs/preview',body)).preview.employees[0]
 assert.equal(w.grossPayCents,10000);assert.equal(w.federalIncomeTaxCents,aggregate?0:2200);assert.equal(w.stateIncomeTaxCents,null)
 let run=await api('/runs',body,201)
 assert.equal((await api('/runs',body)).id,run.id)
 await api('/runs',{...body,offCyclePto:{...body.offCyclePto,historySource:'Synthetic changed reconciliation evidence'}},409)
 const voidId=run.id
 await api(`/runs/${voidId}/status`,{status:'VOID'},200,'PATCH')
 run=await api('/runs',body,201)
 assert.notEqual(run.id,voidId)
 assert.equal((await h.pool.query('SELECT offcycle_run_id FROM payroll_leave_payout WHERE id=$1',[payout.id])).rows[0].offcycle_run_id,run.id)
 await assert.rejects(()=>h.pool.query("UPDATE payroll_leave_payout SET payment_mode='REGULAR' WHERE id=$1",[payout.id]),/reviewed terms/)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},200,'PATCH')
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},409,'PATCH')
 await api(`/runs/${run.id}/employees/${e.id}/withholding`,{federalIncomeTaxCents:aggregate?0:2200,stateIncomeTaxCents:800,sourceNote:'Synthetic professional vacation withholding worksheet',professionalConfirmed:true},200,'PATCH')
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},409,'PATCH')
 await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE facility_id=1")
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},200,'PATCH')
 await api(`/employees/${e.id}/leave-payouts/${payout.id}/cancel`,{reason:'Synthetic cancellation after approval'},409)
 await h.pool.query("CREATE FUNCTION reject_pto_payment_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PTO_PAYOUT_PAID' THEN RAISE EXCEPTION 'synthetic settlement audit failure'; END IF; RETURN NEW; END $$")
 await h.pool.query('CREATE TRIGGER reject_pto_payment_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_pto_payment_audit()')
 await api(`/runs/${run.id}/finalize`,{paymentDate:preview.asOfDate,paymentConfirmationReference:'SYNTHETIC-PTO-SETTLEMENT'},500)
 assert.equal((await h.pool.query('SELECT status FROM payroll_leave_payout WHERE id=$1',[payout.id])).rows[0].status,'RESERVED')
 assert.equal((await h.pool.query("SELECT SUM(minutes)::int n FROM payroll_leave_transaction WHERE employee_id=$1 AND leave_type='PTO'",[e.id])).rows[0].n,480)
 await h.pool.query('DROP TRIGGER reject_pto_payment_audit ON payroll_audit_log')
 await api(`/runs/${run.id}/finalize`,{paymentDate:preview.asOfDate,paymentConfirmationReference:'SYNTHETIC-PTO-SETTLEMENT'})
 const paid=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
 assert.equal(Number(paid.net_pay_cents),aggregate?8435:6235)
 assert.equal(Number(paid.regular_minutes)+Number(paid.overtime_minutes)+Number(paid.sick_leave_accrual_minutes),0)
 if(aggregate){assert.equal(paid.statement_snapshot.supplementalTax.method,'AGGREGATE');assert.equal(paid.statement_snapshot.supplementalTax.aggregateBasis.regularRunId,Number(original.id))}
 assert.equal(paid.statement_snapshot.runKind,'OFF_CYCLE_PTO')
 assert.equal(paid.statement_snapshot.payItems[0].leavePayout.id,Number(payout.id))
 assert.equal((await h.pool.query('SELECT status FROM payroll_leave_payout WHERE id=$1',[payout.id])).rows[0].status,'PAID')
 assert.equal((await h.pool.query("SELECT SUM(minutes)::int n FROM payroll_leave_transaction WHERE employee_id=$1 AND leave_type='PTO'",[e.id])).rows[0].n,240)
 assert.equal((await loadSupplementalPaymentHistory(h.pool,1,e.id,preview.asOfDate)).ytdSupplementalCents,10000)
 await api(`/runs/${run.id}/finalize`,{paymentDate:preview.asOfDate,paymentConfirmationReference:'SYNTHETIC-PTO-SETTLEMENT'},409)
 if(aggregate){
  await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-09-08',720,'Synthetic additional earned vacation')",[e.id])
  // $100 regular weekly wages plus successive $100 vacation payments. At
  // $400 combined, annual taxable wages are $4,700 and weekly federal tax
  // is $9.04; at $500 it is $19.04, less $9.04 already withheld = $10.00.
  for(const [index,federal] of [0,904,1000].entries()){
   const fresh=await api(`/employees/${e.id}/leave-payout/preview`,policy)
   const next=await api(`/employees/${e.id}/leave-payouts`,{...reservation,fingerprint:fresh.fingerprint,requestKey:`aggregate-repeat-pto-${index}`},201)
   const request={...body,offCyclePto:{...body.offCyclePto,payoutId:next.id}}
   const calculation=(await api('/runs/preview',request)).preview.employees[0]
   assert.equal(calculation.federalIncomeTaxCents,federal)
   assert.equal(calculation.supplementalTax.aggregateBasis.previousSupplementalCents,(index+1)*10000)
   const extra=await api('/runs',request,201)
   await api(`/runs/${extra.id}/status`,{status:'REVIEW'},200,'PATCH')
   await api(`/runs/${extra.id}/employees/${e.id}/withholding`,{federalIncomeTaxCents:federal,stateIncomeTaxCents:800,sourceNote:'Synthetic professional state vacation worksheet',professionalConfirmed:true},200,'PATCH')
   await api(`/runs/${extra.id}/status`,{status:'APPROVED'},200,'PATCH')
   await api(`/runs/${extra.id}/finalize`,{paymentDate:preview.asOfDate,paymentConfirmationReference:`SYNTHETIC-AGGREGATE-REPEAT-${index}`})
  }
 }

})
