import test from 'node:test'
import assert from 'node:assert/strict'
import {settlementUnsentProof} from '../settlementUnsentProof.js'
const observation = (changes={}) => ({id:'1',source:'SUBMISSION',create_attempted:false,retry_id:null,result:{status:'UNCERTAIN'},...changes})
test('only completed submission evidence establishes no send, never absence or a legacy claim',()=>{
 for (const rows of [[],[observation({source:'RECOVERY'})],[observation({create_attempted:null})],[observation({create_attempted:undefined})]]) assert.equal(settlementUnsentProof(rows).canRetry,false)
 assert.deepEqual(settlementUnsentProof([observation()]),{canRetry:true,observationId:'1',reason:null})
})
test('any attempted create, matched journal or contradictory evidence permanently prevents a new write',()=>{
 const recovery=changes=>observation({id:'2',source:'RECOVERY',...changes})
 const laterAbsence=observation({id:'3',source:'RECOVERY',result:{status:'NOT_FOUND'}})
 // Distinct IDs and exactly one submission isolate the adverse evidence rule.
 assert.equal(settlementUnsentProof([observation(),recovery({}),laterAbsence]).canRetry,true)
 for (const evidence of [recovery({create_attempted:true}),recovery({result:{status:'SYNCED'}}),recovery({result:{status:'NEEDS_REVIEW'}})]) assert.equal(settlementUnsentProof([observation(),evidence,laterAbsence]).canRetry,false)
})
test('a crash after a durable retry claim cannot be mistaken for an unsent attempt',()=>{
 const rows=[observation()]
 assert.equal(settlementUnsentProof(rows,[{id:'retry-1'}]).canRetry,false)
 rows.push(observation({id:'2',retry_id:'retry-1'}))
 assert.equal(settlementUnsentProof(rows,[{id:'retry-1'}]).canRetry,true)
 assert.equal(settlementUnsentProof(rows,[{id:'retry-1'},{id:'retry-2'}]).canRetry,false)
})
test('no-send proof selects the latest identity without relying on timestamp ties or unsafe numeric rounding',()=>{
 const rows=[observation({id:'9007199254740993',retry_id:'retry-1'}),observation({id:'9007199254740992'})]
 assert.equal(settlementUnsentProof(rows,[{id:'retry-1'}]).observationId,'9007199254740993')
 assert.equal(settlementUnsentProof(rows.toReversed(),[{id:'retry-1'}]).observationId,'9007199254740993')
})

test('malformed, duplicated, unclaimed and reordered evidence fails closed',()=>{
 for(const [rows,retries] of [
  [[observation(),observation()],[]],
  [[observation({id:'-1'})],[]],
  [[observation({source:'UNKNOWN'})],[]],
  [[observation({result:{status:'UNKNOWN'}})],[]],
  [[observation({retry_id:'missing'})],[]],
  [[observation({source:'RECOVERY'}),observation({id:'2'})],[]],
  [[observation(),observation({id:'2',retry_id:'retry-1'})],[{id:'retry-1'},{id:'retry-1'}]],
 ]) assert.equal(settlementUnsentProof(rows,retries).canRetry,false)
})
