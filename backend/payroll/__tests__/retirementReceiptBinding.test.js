import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {createHarness} from '../testing/harness.js'
import {createRetirementSftpServer} from '../testing/retirementSftpServer.js'
import {retirementDestinationProvider} from '../testing/retirementDestinationProvider.js'
import {retirementReceiptBindingFixture} from '../testing/retirementReceiptBindingFixture.js'
import {transferRetirementAllocation,verifyRetirementSftpConnection} from '../retirementSftpTransport.js'
const enabled=!!process.env.PAYROLL_TEST_DATABASE_URL
async function scenario(work,options){
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');const server=await createRetirementSftpServer(),provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>new Date('2026-09-19T12:00:00Z'),retirementNow:()=>new Date('2026-09-11T12:00:00Z'),retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options),retirementAllocationTransfer:(c,file,opts)=>transferRetirementAllocation(c,file,{...server.options,...opts})})
 try{await work({h,server,provider,f:await retirementReceiptBindingFixture(h,server.config,options)})}finally{await h.close();await server.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
}
test('receipt location retains original claim/configuration, exact retries and immutable historical bindings',{skip:!enabled},()=>scenario(async({h,server,f})=>{
 const auths=server.state.auths;assert.equal((await f.api(f.bindingPath)).status,'REVIEW_REQUIRED')
 const [one,two]=await Promise.all([f.api(f.bindingPath,f.bindingBody),f.api(f.bindingPath,f.bindingBody)]);assert.equal(one.id,two.id)
 const data=await f.api(f.bindingPath);assert.equal(data.status,'BOUND');assert.equal(data.history.length,1);assert.equal(data.host,server.config.host);assert.ok(!JSON.stringify(data).includes(server.config.privateKey));assert.equal(server.state.auths,auths)
 await assert.rejects(h.pool.query('UPDATE payroll_retirement_receipt_binding SET reference=$1 WHERE id=$2',['Changed history',one.id]),/append-only/)
 await f.api(f.bindingPath,{...f.bindingBody,fileName:'different.csv'},'POST',409)
 await f.api(f.bindingPath,{...f.bindingBody,requestKey:randomUUID()},'POST',409)
 await f.api(f.setupPath,{action:'SUSPEND',expectedRevision:1,requestKey:randomUUID(),reference:'Suspend future allocation sends while preserving the historical receipt server',confirmed:true})
 assert.equal((await f.api(f.bindingPath)).status,'BOUND')
 await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'));assert.equal((await f.api(f.bindingPath)).history[0].id,one.id)
}))
test('contract suspension blocks new interpretation while receipt suspension works offline and renewal preserves history',{skip:!enabled},()=>scenario(async({f})=>{
 const first=await f.api(f.bindingPath,f.bindingBody)
 await f.api(f.contractPath,{action:'SUSPEND',expectedRevision:1,requestKey:randomUUID(),confirmed:true,reference:'Suspend provider receipt interpretation pending changed terminology review'})
 assert.equal((await f.api(f.bindingPath)).status,'CONTRACT_SUSPENDED');assert.equal((await f.api(f.bindingPath,f.bindingBody)).id,first.id)
 await f.api(f.bindingPath,{...f.bindingBody,expectedRevision:1,requestKey:randomUUID()},'POST',409)
 const key=process.env.PAYROLL_DOCUMENT_KEY;delete process.env.PAYROLL_DOCUMENT_KEY
 try{const body={action:'SUSPEND',expectedRevision:1,requestKey:randomUUID(),confirmed:true,reference:'Suspend receipt retrieval while the original path is independently reviewed'},a=await f.api(f.bindingPath,body);assert.equal((await f.api(f.bindingPath,body)).id,a.id)}finally{process.env.PAYROLL_DOCUMENT_KEY=key}
 const c=await f.api(f.contractPath,{...f.contractBody,expectedRevision:2,requestKey:randomUUID()})
 assert.equal((await f.api(f.bindingPath)).status,'SUSPENDED')
 await f.api(f.bindingPath,{...f.bindingBody,contractId:c.id,fileName:'renewed_receipt.csv',expectedRevision:2,requestKey:randomUUID()});const history=await f.api(f.bindingPath);assert.equal(history.status,'BOUND');assert.equal(history.history.length,3);assert.equal(history.history[2].file_name,f.bindingBody.fileName)
}))
test('receipt binding rejects unclaimed files, foreign sources and unsafe locations before any remote read',{skip:!enabled},()=>scenario(async({h,f,server})=>{
 assert.equal((await f.api(f.bindingPath)).status,'ALLOCATION_NOT_CLAIMED');await f.api(f.bindingPath,f.bindingBody,'POST',409);await f.dispatch()
 const reads=server.state.reads
 for(const values of [{directory:'/staging'},{directory:'/staging/receipts'},{directory:'/incoming/../elsewhere'},{fileName:'../receipt.csv'},{contractId:randomUUID()},{originalFileReviewed:false}])await f.api(f.bindingPath,{...f.bindingBody,...values,requestKey:randomUUID()},'POST',values.contractId?409:400)
 const foreign=await fetch(`${h.url}/api/admin/payroll${f.bindingPath}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(foreign.status,404)
 assert.equal(server.state.reads,reads);assert.equal((await f.api(f.bindingPath)).history.length,0)
},{claim:false}))
