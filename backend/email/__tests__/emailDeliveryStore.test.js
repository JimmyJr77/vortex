import test from 'node:test'
import assert from 'node:assert/strict'

import { recordDelivery, registerEmailPool } from '../emailDeliveryStore.js'

test('delivery idempotency is claimed atomically before concurrent receipt sends', async () => {
  let inserted = false
  let insertCalls = 0
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      if (text.includes('INSERT INTO email_delivery')) {
        insertCalls += 1
        assert.match(text, /ON CONFLICT \(idempotency_key\)[\s\S]*DO NOTHING/)
        assert.equal(params[13], 'stripe-payment-receipt:91')
        if (inserted) return { rows: [] }
        inserted = true
        return { rows: [{ id: 41 }] }
      }
      if (text.includes('SELECT id FROM email_delivery WHERE idempotency_key')) {
        assert.deepEqual(params, ['stripe-payment-receipt:91'])
        return { rows: [{ id: 41 }] }
      }
      throw new Error(`Unexpected email delivery query: ${text}`)
    },
  }
  registerEmailPool(pool)

  try {
    const input = {
      category: 'payment_receipt',
      stream: 'transactional',
      email: 'payer@example.com',
      idempotencyKey: 'stripe-payment-receipt:91',
    }
    const [first, replay] = await Promise.all([
      recordDelivery(input),
      recordDelivery(input),
    ])

    assert.deepEqual(first, { id: 41 })
    assert.deepEqual(replay, { id: 41, duplicate: true })
    assert.equal(insertCalls, 2)
  } finally {
    registerEmailPool(null)
  }
})
