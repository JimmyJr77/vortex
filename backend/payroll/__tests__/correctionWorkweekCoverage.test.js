import test from 'node:test'
import assert from 'node:assert/strict'
import {correctionWorkweekCoverage} from '../correctionWorkweekCoverage.js'
const fixture=()=>({runId:1,periodStart:'2026-08-03',periodEnd:'2026-08-09',workweekPaymentVersion:1,
 before:{regularMinutes:2400,overtimeMinutes:0,regularPayCents:100000,overtimePayCents:0},
 after:{regularMinutes:2400,overtimeMinutes:120,regularPayCents:100000,overtimePayCents:7500},
 delta:{regularMinutes:0,overtimeMinutes:120,regularPayCents:0,overtimePayCents:7500,workedWagesCents:7500},
 originalEntries:[{workDate:'2026-08-03',workweekStart:'2026-08-03',minutes:2400,regularMinutes:2400,overtimeMinutes:0}],
 proposedEntries:[{workDate:'2026-08-03',workweekStart:'2026-08-03',minutes:2520,regularMinutes:2400,overtimeMinutes:120}],
 originalWorkweekPayments:[{week:'2026-08-03',workedMinutes:2400,straightTimePayCents:100000,premiumCents:0}],
 proposedWorkweekPayments:[{week:'2026-08-03',workedMinutes:2520,straightTimePayCents:105001,premiumCents:2499}],
})
test('correction workweek coverage preserves retained cents instead of recalculating their split',()=>{
 const change=fixture(),proof=correctionWorkweekCoverage(change,9)
 assert.deepEqual(proof.deltas,[{week:'2026-08-03',workedMinutes:120,straightTimePayCents:5001,premiumCents:2499}])
 assert.equal(proof.settlementId,9);assert.equal(proof.runId,1)
 change.proposedWorkweekPayments[0].premiumCents=0
 assert.equal(proof.corrected[0].premiumCents,2499)
})
test('correction workweek coverage rejects missing and inconsistent dated wage evidence',()=>{
 const mutations=[
  c=>{c.workweekPaymentVersion=2},c=>{delete c.originalWorkweekPayments},c=>{c.periodEnd='2026-08-02'},
  c=>{c.after.regularPayCents++},c=>{c.proposedWorkweekPayments[0].premiumCents++},
  c=>{c.proposedWorkweekPayments.push({...c.proposedWorkweekPayments[0]})},
  c=>{c.proposedWorkweekPayments[0].workedMinutes++},c=>{c.proposedWorkweekPayments[0].week='2026-08-10'},
  c=>{c.proposedEntries[0].workDate='2026-08-10'},c=>{c.proposedEntries[0].minutes--},
  c=>{c.proposedEntries[0].regularMinutes--;c.proposedEntries[0].overtimeMinutes++},
  c=>{c.delta.workedWagesCents++},c=>{c.delta.overtimeMinutes++},
 ]
 for(const mutate of mutations){const change=fixture();mutate(change);assert.throws(()=>correctionWorkweekCoverage(change,9),{status:409})}
 assert.throws(()=>correctionWorkweekCoverage(fixture(),0),{status:409})
})
