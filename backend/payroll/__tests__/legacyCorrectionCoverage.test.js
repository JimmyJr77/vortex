import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {correctionBonusFixture} from '../testing/correctionBonusFixture.js'
import {correctedBonusCoverage} from '../correctionBonusCoverage.js'
import {compensationEvidence} from '../employmentCompensation.js'
test('previously settled version-two calculations retain bonus-hour coverage without invented workweek cents',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {first}=await correctionBonusFixture(h)
 const record=(await h.pool.query('SELECT r.id AS run_id,r.calculation_snapshot,re.employee_id,re.regular_minutes,re.overtime_minutes,re.regular_pay_cents,re.overtime_pay_cents FROM payroll_run r JOIN payroll_run_employee re ON re.payroll_run_id=r.id WHERE r.id=$1',[first.id])).rows[0]
 const saved=(await h.pool.query("SELECT c.*,a.after_data->'calculation' AS calculation,re.statement_snapshot AS paid_snapshot,re.regular_pay_cents+re.overtime_pay_cents+re.other_taxable_pay_cents AS paid_gross_cents,re.net_pay_cents AS paid_net_cents FROM payroll_correction_settlement c JOIN payroll_run_employee re ON re.id=c.run_employee_id JOIN payroll_audit_log a ON a.id=(c.plan->>'calculationId')::bigint")).rows[0]
 // Reproduce the retained v2 format in memory. Never change stored paid data.
 const legacy=structuredClone(saved);legacy.calculation.version=2
 for(const run of legacy.calculation.runs){delete run.originalWorkweekPayments;delete run.proposedWorkweekPayments;delete run.workweekPaymentVersion}
 delete legacy.calculation.fingerprint
 const fingerprint=createHash('sha256').update(JSON.stringify(compensationEvidence(legacy.calculation))).digest('hex')
 legacy.calculation.fingerprint=fingerprint;legacy.plan.calculationFingerprint=fingerprint
 legacy.paid_snapshot.correctionSettlements[0].calculationFingerprint=fingerprint
 legacy.paid_snapshot.payItems.find(i=>i.kind==='WAGE_CORRECTION').correction.fingerprint=fingerprint
 const coverage=correctedBonusCoverage(record,[legacy])
 assert.equal(coverage.regularMinutes+coverage.overtimeMinutes,2520)
 assert.deepEqual(coverage.settlementIds,[Number(saved.id)]);assert.deepEqual(coverage.workweekCorrections,[])
})
