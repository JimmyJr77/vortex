import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
test('invoice coverage links reject stale, retracted, uncovered, missing and wrong-carrier reviews',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api}=await monthlyBenefitsFixture(h)
 const row=(await api('/benefit-coverage?month=2026-09')).rows[0]
 const review={month:row.month,employeeId:row.employeeId,onboardingCycle:row.onboardingCycle,planId:row.planId,sourceFingerprint:row.sourceFingerprint,expectedRevision:0,carrier:'Synthetic Carrier',disposition:'COVERED',coverageStart:'2026-09-01',coverageEnd:'2026-09-30',reference:'Synthetic confirmed carrier evidence for invoice selection',confirmed:true,requestKey:randomUUID()}
 const first=await api('/benefit-coverage',review)
 const input=async ids=>({month:'2026-09',carrier:review.carrier,invoiceNumber:'COVERAGE-SELECTION',invoiceDate:'2026-09-01',dueDate:'2026-09-30',amountCents:57500,reference:'Actual synthetic carrier invoice reference',reconciliation:'Verified actual coverage and all invoice charges against retained records',confirmed:true,fingerprint:(await api('/benefit-carrier-invoices?month=2026-09')).source.fingerprint,coverageReviewIds:ids})
 await api('/benefit-carrier-invoices',{...await input([first.id]),carrier:'Another Carrier'},'POST',409)
 await api('/benefit-carrier-invoices',await input([randomUUID()]),'POST',409)
 await api('/benefit-carrier-invoices',await input([first.id,first.id]),'POST',400)
 const old=await input([first.id])
 const second=await api('/benefit-coverage',{...review,expectedRevision:1,disposition:'NOT_COVERED',requestKey:randomUUID()})
 await api('/benefit-carrier-invoices',old,'POST',409)
 await api('/benefit-carrier-invoices',await input([first.id]),'POST',409)
 await api('/benefit-carrier-invoices',await input([second.id]),'POST',409)
 const third=await api('/benefit-coverage',{...review,expectedRevision:2,disposition:'RETRACTED',requestKey:randomUUID()})
 await api('/benefit-carrier-invoices',await input([third.id]),'POST',409)
 assert.equal((await api('/benefit-carrier-invoices?month=2026-09')).history.length,0)
 const fourth=await api('/benefit-coverage',{...review,expectedRevision:3,requestKey:randomUUID()})
 const invoice=await api('/benefit-carrier-invoices',await input([fourth.id]));assert.ok(invoice.id)
 const retained=(await api('/benefit-carrier-invoices?month=2026-09')).history[0]
 assert.deepEqual(retained.invoice.coverageReviewIds,[fourth.id]);assert.equal(retained.current,true)
})
