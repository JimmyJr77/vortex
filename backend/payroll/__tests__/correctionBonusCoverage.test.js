import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {correctionBonusFixture} from '../testing/correctionBonusFixture.js'
for(const options of [{},{missingTime:true},{sharedWeek:true}])test(`earned bonus settles after corrected original work: ${JSON.stringify(options)}`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {api,bonusPeriod,allocation,e}=await correctionBonusFixture(h,options)
 const before=(await h.pool.query('SELECT * FROM payroll_run_employee ORDER BY id')).rows
 const settlement=(await h.pool.query('SELECT id FROM payroll_correction_settlement')).rows[0]
 const preview=(await api('/runs/preview',{payPeriodId:bonusPeriod.id})).preview
 assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings))
 const employee=preview.employees.find(r=>Number(r.employeeId)===Number(e.id)),bonus=employee.payItems.find(i=>i.kind==='BONUS')
 assert.equal(allocation.additionalOvertimeCents,options.sharedWeek?1154:238)
 assert.equal(employee.payItems.find(i=>i.kind==='BONUS_OVERTIME').amountCents,allocation.additionalOvertimeCents)
 assert.equal(employee.grossPayCents,110000+allocation.additionalOvertimeCents)
 assert.equal(employee.regularMinutes+employee.overtimeMinutes,2400)
 assert.equal(employee.sickLeaveAccrualMinutes,80)
 assert.ok(bonus.bonusAllocation.coverage.evidence.some(e=>e.correctionSettlementIds?.includes(Number(settlement.id))))
 const run=await api('/runs',{payPeriodId:bonusPeriod.id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH')
 if(!options.missingTime&&!options.sharedWeek){
  const calculation=(await h.pool.query("SELECT a.id,a.after_data FROM payroll_correction_settlement c JOIN payroll_audit_log a ON a.id=(c.plan->>'calculationId')::bigint WHERE c.id=$1",[settlement.id])).rows[0]
  await h.pool.query("UPDATE payroll_audit_log SET after_data=jsonb_set(after_data,'{calculation,workedWagesDifferenceCents}','1'::jsonb) WHERE id=$1",[calculation.id])
  await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH',409)
  assert.equal((await h.pool.query('SELECT status FROM payroll_run WHERE id=$1',[run.id])).rows[0].status,'REVIEW')
  await h.pool.query('UPDATE payroll_audit_log SET after_data=$1 WHERE id=$2',[calculation.after_data,calculation.id])
  const correctionPayment=(await h.pool.query('SELECT re.id,re.net_pay_cents FROM payroll_run_employee re JOIN payroll_correction_settlement c ON c.run_employee_id=re.id WHERE c.id=$1',[settlement.id])).rows[0]
  await h.pool.query('UPDATE payroll_run_employee SET net_pay_cents=net_pay_cents+1 WHERE id=$1',[correctionPayment.id])
  await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH',409)
  await h.pool.query('UPDATE payroll_run_employee SET net_pay_cents=$1 WHERE id=$2',[correctionPayment.net_pay_cents,correctionPayment.id])
 }
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-BONUS-AFTER-CORRECTION'})
 assert.deepEqual((await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id<>$1 ORDER BY id',[run.id])).rows,before)
 const paid=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
 assert.deepEqual(paid.statement_snapshot.payItems.find(i=>i.kind==='BONUS').bonusAllocation.coverage,bonus.bonusAllocation.coverage)
 assert.equal(Number(paid.net_pay_cents),employee.netPayCents)
})
