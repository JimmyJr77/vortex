import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {createRetirementSftpServer} from '../testing/retirementSftpServer.js'
import {retirementBankProvider} from '../testing/retirementBankProvider.js'
import {retirementReceiptIntakeFixture} from '../testing/retirementReceiptIntakeFixture.js'
import {readRetirementSftpReceipt,transferRetirementAllocation,verifyRetirementSftpConnection} from '../retirementSftpTransport.js'
import {checkRetirementReceipts} from '../retirementReceiptAutomation.js'
import {retirementContributionAssessment} from '../retirementContributionAssessment.js'
test('contribution assessment requires exact bank and every participant receipt, reopens for returns and stale evidence',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async()=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const server=await createRetirementSftpServer(),provider=retirementBankProvider(),h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>new Date('2026-09-19T15:00:00Z'),retirementNow:()=>new Date('2026-09-11T12:00:00Z'),retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options),retirementAllocationTransfer:(c,f,o)=>transferRetirementAllocation(c,f,{...server.options,...o})})
 try{
  const f=await retirementReceiptIntakeFixture(h,server.config),path=`/retirement-remittance-authorizations/${f.remittanceId}`,read=()=>f.api(path+'/assessment')
  let data=await read();assert.equal(data.payrollStatus,'MATCHED');assert.equal(data.bankStatus,'UNVERIFIED');assert.equal(data.receiptStatus,'UNVERIFIED')
  await f.api(path+'/dispatch',{action:'SUBMIT',confirmed:true,bankInstructionsReviewed:true,outsideActivityReviewed:true,reference:'Independent trustee credit and separate allocation instructions reviewed'})
  provider.complete();await f.api(path+'/dispatch',{action:'RECOVER',confirmed:true})
  data=await read();assert.equal(data.bankStatus,'BANK_POSTED');assert.equal(data.status,'REVIEW_REQUIRED')
  server.files.set(f.remotePath,f.receipt());await checkRetirementReceipts(h.pool,1,{reader:(c,r)=>readRetirementSftpReceipt(c,r,server.options),receiptNow:()=>new Date('2026-09-19T15:00:00Z')})
  data=await read();assert.equal(data.status,'DELIVERY_EVIDENCE_MATCHED');assert.equal(data.postedCents,1400);assert.equal(data.accountingStatus,'REQUIRED');assert.equal(data.issues.length,1)
  for(const v of ['PRIVATE-PARTICIPANT','Synthetic batch','encrypted','sourceSha256'])assert.ok(!JSON.stringify(data).includes(v))
  const stale=await retirementContributionAssessment(h.pool,1,f.remittanceId,{now:new Date(Date.now()+25*3600000)});assert.equal(stale.status,'REVIEW_REQUIRED');assert.equal(stale.bankStatus,'UNVERIFIED');assert.equal(stale.postedCents,null)
  await assert.rejects(retirementContributionAssessment(h.pool,2,f.remittanceId),e=>e.status===404)
  provider.returned();await f.api(path+'/dispatch',{action:'RECOVER',confirmed:true});data=await read();assert.equal(data.status,'REVIEW_REQUIRED');assert.equal(data.bankStatus,'UNVERIFIED');assert.equal(data.receiptStatus,'POSTED');assert.equal(provider.posts(),1);assert.equal(server.state.created,1)
 }finally{await h.close();await server.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
