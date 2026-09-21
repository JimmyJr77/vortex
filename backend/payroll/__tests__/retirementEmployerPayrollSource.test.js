import test from 'node:test'
import assert from 'node:assert/strict'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {regularRetirementFixture} from '../testing/regularRetirementFixture.js'
import {retirementEmployerPayrollSource} from '../retirementEmployerPayrollSource.js'

test('employer payroll inputs derive from scoped retained wages, plan, ledger and employee statement',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHistoricalHarness(t,{retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(()=>h.close())
 const {api,employee,periods}=await regularRetirementFixture(h)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 const args={facility:1,employeeId:employee.id,runId:run.id,planId:'standard'}
 await assert.rejects(retirementEmployerPayrollSource(h.pool,args),/approved or finalized/)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH')
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 const approved=await retirementEmployerPayrollSource(h.pool,args)
 assert.equal(approved.runStatus,'APPROVED')
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-EMPLOYER-SOURCE'})
 const source=await retirementEmployerPayrollSource(h.pool,args)
 assert.equal(source.status,'RECONCILED_PAYROLL_INPUTS');assert.equal(source.runStatus,'FINALIZED')
 assert.deepEqual(source.compensation,{REGULAR:20000,OVERTIME:0,BONUS:0,PAID_LEAVE:0})
 assert.equal(source.compensation415Cents,20000);assert.equal(source.ordinaryDeferralsCents,1400);assert.equal(source.catchUpDeferralsCents,0)
 assert.notEqual(source.fingerprint,approved.fingerprint)
 assert.equal(source.salaryCoveredLeave,false);assert.equal(source.requiresEmployerEligibilityReview,true)
 assert.equal(source.requiresEmployerCompensationReview,true);assert.match(source.fingerprint,/^[a-f0-9]{64}$/)
 assert.equal((await retirementEmployerPayrollSource(h.pool,args)).fingerprint,source.fingerprint)
 assert.equal(source.posted,undefined);assert.equal(source.retainedCalculation,undefined)
 for(const patch of [{facility:2},{employeeId:employee.id+1},{planId:'wrong-plan'},{runId:Number(run.id)+1}])await assert.rejects(retirementEmployerPayrollSource(h.pool,{...args,...patch}),{status:409})
 const db=await h.pool.connect()
 const corrupt=async(sql,params,pattern)=>{
  await db.query('BEGIN')
  try{await db.query(sql,params);await assert.rejects(retirementEmployerPayrollSource(db,args),pattern)}finally{await db.query('ROLLBACK')}
 }
 try{
  await corrupt('UPDATE payroll_run_employee SET other_taxable_pay_cents=other_taxable_pay_cents+1 WHERE payroll_run_id=$1',[run.id],/Posted wages differ/)
  await corrupt('UPDATE payroll_run_employee SET pretax_deduction_cents=pretax_deduction_cents+1 WHERE payroll_run_id=$1',[run.id],/Posted retirement deductions/)
  await corrupt("UPDATE payroll_run_employee SET statement_snapshot=jsonb_set(statement_snapshot,'{retirement,plans,0,ordinaryPretaxCents}','9999') WHERE payroll_run_id=$1",[run.id],/employee statement differs/)
  await db.query('BEGIN')
  try{
   await db.query("UPDATE payroll_run_employee SET statement_snapshot=jsonb_set(statement_snapshot,'{testSourceChange}','true') WHERE payroll_run_id=$1",[run.id])
   assert.notEqual((await retirementEmployerPayrollSource(db,args)).fingerprint,source.fingerprint)
  }finally{await db.query('ROLLBACK')}
 }finally{db.release()}
 assert.equal((await retirementEmployerPayrollSource(h.pool,args)).fingerprint,source.fingerprint)
})

test('employer source does not mix another payment year into 2026 plan evidence',async()=>{
 const db={query:async()=>({rows:[{status:'FINALIZED',payment_day:'2027-01-01',calculation_snapshot:{employees:[{employeeId:1}]}}]})}
 await assert.rejects(retirementEmployerPayrollSource(db,{facility:1,employeeId:1,runId:1,planId:'standard'}),/payment year/)
})
