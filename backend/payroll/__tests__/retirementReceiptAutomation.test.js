import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {createRetirementSftpServer} from '../testing/retirementSftpServer.js'
import {retirementDestinationProvider} from '../testing/retirementDestinationProvider.js'
import {retirementReceiptIntakeFixture} from '../testing/retirementReceiptIntakeFixture.js'
import {readRetirementSftpReceipt,transferRetirementAllocation,verifyRetirementSftpConnection} from '../retirementSftpTransport.js'
import {checkRetirementReceipts,startRetirementReceiptScheduler} from '../retirementReceiptAutomation.js'
test('automatic receipt checks serialize concurrent sweeps, retain actor-free evidence, respect due times and suspension',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async()=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const server=await createRetirementSftpServer(),provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>new Date('2026-09-19T15:00:00Z'),retirementNow:()=>new Date('2026-09-11T12:00:00Z'),retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options),retirementAllocationTransfer:(c,f,o)=>transferRetirementAllocation(c,f,{...server.options,...o})})
 try{
  const f=await retirementReceiptIntakeFixture(h,server.config),reader=(c,r)=>readRetirementSftpReceipt(c,r,server.options),options={reader,receiptNow:()=>new Date('2026-09-19T15:00:00Z')}
  server.files.set(f.remotePath,f.receipt());const results=await Promise.all([checkRetirementReceipts(h.pool,1,options),checkRetirementReceipts(h.pool,1,options)])
  assert.equal(results.reduce((n,r)=>n+r.checked,0),1);assert.equal(results.reduce((n,r)=>n+r.failed,0),0)
  const row=(await h.pool.query('SELECT * FROM payroll_retirement_receipt_observation')).rows[0];assert.equal(row.automatic,true);assert.equal(row.created_by,null);assert.equal(row.summary.status,'POSTED')
  assert.deepEqual(await checkRetirementReceipts(h.pool,1,options),{checked:0,posted:0,failed:0});assert.equal((await checkRetirementReceipts(h.pool,2,options)).checked,0)
  server.files.delete(f.remotePath);assert.equal((await checkRetirementReceipts(h.pool,1,{...options,now:new Date(Date.now()+25*3600000)})).checked,1)
  const history=await f.api(f.receiptPath);assert.equal(history.history[0].summary.status,'RECEIPT_NOT_FOUND');assert.equal(history.history[0].automatic,true)
  await f.api(f.bindingPath,{action:'SUSPEND',expectedRevision:1,requestKey:randomUUID(),confirmed:true,reference:'Suspend automatic receipt checks during provider naming review'})
  assert.equal((await checkRetirementReceipts(h.pool,1,{...options,now:new Date(Date.now()+26*3600000)})).checked,0);assert.equal(server.state.created,1);assert.equal(server.state.renames,1)
 }finally{await h.close();await server.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
test('receipt scheduler honors test and explicit disable settings',()=>{
 const env=process.env.NODE_ENV,flag=process.env.PAYROLL_RETIREMENT_RECEIPT_CHECKS_ENABLED
 try{process.env.NODE_ENV='test';assert.equal(startRetirementReceiptScheduler({}),null);process.env.NODE_ENV='production';process.env.PAYROLL_RETIREMENT_RECEIPT_CHECKS_ENABLED='false';assert.equal(startRetirementReceiptScheduler({}),null)}finally{if(env===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=env;if(flag===undefined)delete process.env.PAYROLL_RETIREMENT_RECEIPT_CHECKS_ENABLED;else process.env.PAYROLL_RETIREMENT_RECEIPT_CHECKS_ENABLED=flag}
})
