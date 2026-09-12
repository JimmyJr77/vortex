import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {createHarness} from '../testing/harness.js'
import {retirementReceiptContractFixture} from '../testing/retirementReceiptContractFixture.js'
import {allocationFormatFixture} from '../testing/retirementAllocationFixture.js'
test('receipt contract retains concurrent retries, detects source changes and preserves offline suspension/history',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async()=>{
 const h=await createHarness()
 try{
  const f=await retirementReceiptContractFixture(h);assert.equal((await f.api(f.path)).status,'REVIEW_REQUIRED')
  const [one,two]=await Promise.all([f.api(f.path,f.body),f.api(f.path,f.body)]);assert.equal(one.id,two.id)
  const state=await f.api(f.path);assert.equal(state.status,'CURRENT');assert.equal(state.history.length,1);assert.equal(state.history[0].contract.columns.length,13)
  await f.api(f.path,{...f.body,requestKey:randomUUID()},409)
  await f.api(f.path,{...f.body,contract:{...f.body.contract,reference:'Changed terms on a reused request identity'}},409)
  await assert.rejects(h.pool.query('UPDATE payroll_retirement_receipt_contract SET reference=$1 WHERE id=$2',['Changed history',one.id]),/append-only/)
  await f.api(f.path,undefined,404,2)
  const format=await f.api(f.formatPath,{format:{...allocationFormatFixture(),dateFormat:'US'},planRevisionId:f.body.planRevisionId,expectedRevision:1,requestKey:randomUUID()});assert.equal((await f.api(f.path)).status,'SOURCE_CHANGED')
  assert.equal((await f.api(f.path,f.body)).id,one.id)
  await f.api(f.path,{...f.body,expectedRevision:1,requestKey:randomUUID()},409)
  const key=process.env.PAYROLL_DOCUMENT_KEY;delete process.env.PAYROLL_DOCUMENT_KEY
  try{const suspension={action:'SUSPEND',expectedRevision:1,requestKey:randomUUID(),confirmed:true,reference:'Suspend receipt interpretation after provider source format changed'},s=await f.api(f.path,suspension);assert.equal((await f.api(f.path,suspension)).id,s.id);assert.equal((await f.api(f.path)).status,'SUSPENDED')}finally{if(key===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=key}
  await f.api(f.path,{...f.body,expectedRevision:2,allocationFormatId:format.id,requestKey:randomUUID()});assert.equal((await f.api(f.path)).status,'CURRENT')
  await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'));assert.equal((await f.api(f.path)).history.length,3)
 }finally{await h.close()}
})
test('receipt reviews reject missing semantic confirmations, duplicate mappings and foreign source IDs',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async()=>{
 const h=await createHarness()
 try{
  const f=await retirementReceiptContractFixture(h)
  for(const contract of [{...f.body.contract,sourceHashConfirmed:false},{...f.body.contract,cumulativeAmountsConfirmed:false},{...f.body.contract,participantPostingConfirmed:false},{...f.body.contract,statusValues:{...f.body.contract.statusValues,POSTED:'Imported'}}])await f.api(f.path,{...f.body,contract,requestKey:randomUUID()},409)
  await f.api(f.path,{...f.body,allocationFormatId:randomUUID()},409)
  await f.api(f.path,{action:'SUSPEND',expectedRevision:0,requestKey:randomUUID(),confirmed:true,reference:'Cannot suspend a receipt contract that does not yet exist'},409)
  assert.equal((await f.api(f.path)).history.length,0)
 }finally{await h.close()}
})
