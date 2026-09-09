import test from 'node:test'
import assert from 'node:assert/strict'
import { correctionPairs } from '../reassessBillingAllocations.js'
const original = {id:1,amount_cents:-562,metadata:{customerAuditVisibility:'suppressed'}}
const reversal = {id:2,amount_cents:562,related_charge_id:1,source_type:'proration_reversal',metadata:{customerAuditVisibility:'suppressed',reversesChargeId:1}}
test('automatic reassessment requires exact and unique reversal evidence, not hidden visibility', () => {
  assert.equal(correctionPairs([original,reversal]).length,1)
  assert.equal(correctionPairs([original,{...reversal,amount_cents:563}]).length,0)
  assert.equal(correctionPairs([original,{...reversal,metadata:{customerAuditVisibility:'suppressed'}}]).length,0)
  assert.equal(correctionPairs([original,reversal,{...reversal,id:3}]).length,0)
  assert.equal(correctionPairs([original,{...reversal,related_charge_id:9}]).length,0)
  assert.equal(correctionPairs([{...original,metadata:{}},reversal]).length,0)
})
