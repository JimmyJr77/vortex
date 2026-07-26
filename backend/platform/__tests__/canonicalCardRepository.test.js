import test from 'node:test'
import assert from 'node:assert/strict'

import { listCanonicalCards } from '../canonicalCardRepository.js'

test('canonical card search includes hidden aliases and display names', async () => {
  const pool = {
    async query(sql, params) {
      assert.deepEqual(params, [9, null, 'push ups'])
      assert.match(sql, /d\.display_name ILIKE/)
      assert.match(sql, /unnest\(d\.aliases\)/)
      assert.match(sql, /alias ILIKE/)
      return { rows: [{ id: 'definition-1', canonical_name: 'Push-Up' }] }
    },
  }

  const cards = await listCanonicalCards(pool, 9, { search: 'push ups' })
  assert.equal(cards[0].canonical_name, 'Push-Up')
})
