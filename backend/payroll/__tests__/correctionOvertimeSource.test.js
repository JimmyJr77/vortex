import test from 'node:test'
import assert from 'node:assert/strict'
import {correctionPremiumEvidence} from '../correctionOvertimeSource.js'
const fixture=()=>({runId:1,workweekPaymentVersion:1,before:{regularPayCents:100000,overtimePayCents:0},after:{regularPayCents:100000,overtimePayCents:15000},originalWorkweekPayments:[{week:'2026-09-07',straightTimePayCents:100000,premiumCents:0}],proposedWorkweekPayments:[{week:'2026-09-07',straightTimePayCents:110000,premiumCents:5000}]})
test('correction premium retains only the added paid premium and rejects ambiguous differences',()=>{
 const row=fixture(),evidence=correctionPremiumEvidence([row],15000);assert.equal(evidence.premiumCents,5000);assert.equal(evidence.status,'RECONCILED')
 assert.deepEqual(correctionPremiumEvidence(evidence.runs,15000),evidence)
 row.proposedWorkweekPayments[0].premiumCents=1;assert.equal(evidence.runs[0].proposedWorkweekPayments[0].premiumCents,5000)
 for(const rows of [[fixture(),fixture()],[{...fixture(),workweekPaymentVersion:2}],[{...fixture(),originalWorkweekPayments:[]}],[{...fixture(),before:{regularPayCents:100001,overtimePayCents:0}}]])assert.equal(correctionPremiumEvidence(rows,15000).premiumCents,null)
 assert.equal(correctionPremiumEvidence([fixture()],15001).premiumCents,null)
 const negative=fixture();negative.before={regularPayCents:100000,overtimePayCents:16000};negative.originalWorkweekPayments=[{week:'2026-09-07',straightTimePayCents:110000,premiumCents:6000}];assert.equal(correctionPremiumEvidence([negative],0).status,'REVIEW_REQUIRED')
})
