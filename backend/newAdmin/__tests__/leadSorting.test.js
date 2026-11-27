import test from 'node:test'
import assert from 'node:assert/strict'
import { leadOrderBy } from '../leadSorting.js'
import { leadInput, listLeads } from '../leads.js'

test('lead sorting whitelists public keys and keeps a stable tie breaker with null dates last', async () => {
  assert.equal(leadOrderBy(), 'r.created_at DESC NULLS LAST,r.id DESC')
  assert.match(leadOrderBy({sortBy:'name',sortDirection:'asc'}), /r.last_name.*ASC NULLS LAST.*r.first_name.*ASC NULLS LAST.*r.id ASC/)
  for (const query of [{sortBy:'r.id'},{sortBy:'__proto__'},{sortDirection:'asc;drop table registrations'}]) {
    await assert.rejects(listLeads({query:async()=>{throw new Error('must reject before querying')}},1,query), {statusCode:400})
  }
})

test('last contacted accepts real calendar dates or an explicit clear', () => {
  assert.deepEqual(leadInput({lastContactedAt:'2024-02-29'},{partial:true}), {lastContactedAt:'2024-02-29'})
  assert.deepEqual(leadInput({lastContactedAt:null},{partial:true}), {lastContactedAt:null})
  for (const lastContactedAt of ['', '2025-02-29', '2026-11-31', '2026-11-27T15:00:00Z', 20261127, true]) {
    assert.throws(()=>leadInput({lastContactedAt},{partial:true}), /Last contacted date/)
  }
})
