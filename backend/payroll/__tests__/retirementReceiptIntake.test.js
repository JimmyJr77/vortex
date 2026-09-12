import {runRetirementReplacementSettlementSweep} from '../retirementReplacementSettlementAutomation.js'
import {retirementReplacementAssessment} from '../retirementReplacementAssessment.js'
import {checkRetirementReplacementReceipts,startRetirementReplacementReceiptScheduler} from '../retirementReplacementReceiptAutomation.js'
import {runRetirementReplacementBankSweep,startRetirementReplacementBankScheduler} from '../retirementReplacementBankAutomation.js'
import {retirementReplacementBankProvider} from '../testing/retirementReplacementBankProvider.js'
import {runRetirementReplacementAllocationSweep,startRetirementReplacementAllocationScheduler} from '../retirementReplacementAutomation.js'
import {readFile} from 'node:fs/promises'
import {retirementReversalAccountingFixture} from '../testing/retirementReversalAccountingFixture.js'
import {employeeRetirementContributions} from '../employeeRetirementContributions.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {createRetirementSftpServer} from '../testing/retirementSftpServer.js'
import {retirementBankProvider} from '../testing/retirementBankProvider.js'
import {retirementReceiptIntakeFixture} from '../testing/retirementReceiptIntakeFixture.js'
import {readRetirementSftpReceipt,transferRetirementAllocation,verifyRetirementSftpConnection} from '../retirementSftpTransport.js'
import {decryptDocument} from '../onboarding.js'
const enabled=!!process.env.PAYROLL_TEST_DATABASE_URL
async function scenario(work,{blockWrite=false}={}){
 const old=process.env.PAYROLL_DOCUMENT_KEY,key=randomBytes(32).toString('hex');process.env.PAYROLL_DOCUMENT_KEY=key
 const server=await createRetirementSftpServer(),provider=retirementBankProvider();let paymentFetcher=provider.fetcher,qboFetcher=async()=>{throw new Error('No synthetic accounting configured')},hook=async()=>{},transferHook=async()=>{},receiptDate='2026-09-19T15:00:00Z'
 const h=await createHarness({quickbooksFetcher:(...args)=>qboFetcher(...args),paymentFetcher:(...args)=>paymentFetcher(...args),remittanceNow:()=>new Date(receiptDate),retirementNow:()=>new Date('2026-09-11T12:00:00Z'),retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options),retirementAllocationTransfer:async(c,file,options)=>{await transferHook(options);return transferRetirementAllocation(c,file,{...server.options,...options,...(blockWrite?{beforeWrite:async()=>false}:{})})},retirementReceiptReader:async(c,receipt)=>{const result=await readRetirementSftpReceipt(c,receipt,server.options);await hook();return result}})
 try{const f=await retirementReceiptIntakeFixture(h,server.config),check=(requestKey=randomUUID())=>f.api(f.receiptPath,{confirmed:true,bindingId:f.bindingId,requestKey});await work({h,f,server,key,check,provider,setQbo:fetcher=>{qboFetcher=fetcher},setPayment:fetcher=>{paymentFetcher=fetcher},setNow:value=>{receiptDate=value},setHook:fn=>{hook=fn},setTransferHook:fn=>{transferHook=fn}})}finally{await h.close();await server.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
}
test('receipt intake retains encrypted exact files/results once per check and protects scopes and audit privacy',{skip:!enabled},()=>scenario(async({h,f,server,check,key})=>{
 const bytes=f.receipt();server.files.set(f.remotePath,bytes);const requestKey=randomUUID(),[one,two]=await Promise.all([check(requestKey),check(requestKey)]);assert.equal(one.id,two.id);assert.equal(one.summary.status,'POSTED');assert.equal(one.summary.postedCents,1400)
 const stored=(await h.pool.query('SELECT * FROM payroll_retirement_receipt_observation')).rows;assert.equal(stored.length,1);assert.ok(!stored[0].encrypted_receipt.includes(Buffer.from('PRIVATE-PARTICIPANT')));assert.ok(decryptDocument(stored[0].encrypted_receipt,`payroll-retirement-receipt:1:${one.id}:file`).equals(bytes));assert.equal(JSON.parse(decryptDocument(stored[0].encrypted_result,`payroll-retirement-receipt:1:${one.id}:result`).toString()).status,'POSTED')
 const history=await f.api(f.receiptPath);assert.equal(history.history.length,1);assert.ok(!JSON.stringify(history).includes('Synthetic batch'));assert.ok(!JSON.stringify(history).includes('PRIVATE-PARTICIPANT'));assert.equal(history.history[0].summary.decision,'RECONCILED')
 const foreign=await fetch(`${h.url}/api/admin/payroll${f.receiptPath}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(foreign.status,404)
 await assert.rejects(h.pool.query('UPDATE payroll_retirement_receipt_observation SET summary=$1 WHERE id=$2',[{},one.id]),/append-only/)
 delete process.env.PAYROLL_DOCUMENT_KEY;assert.equal((await check(requestKey)).id,one.id);assert.equal((await check()).summary.status,'CREDENTIALS_UNAVAILABLE');process.env.PAYROLL_DOCUMENT_KEY=key
 assert.equal(server.state.created,1);assert.equal(server.state.renames,1)
}))
test('regressing, stale and changed-batch receipts cannot replace a reconciled participant posting',{skip:!enabled},()=>scenario(async({h,f,server,check})=>{
 server.files.set(f.remotePath,f.receipt());await check()
 server.files.set(f.remotePath,f.receipt({status:'Imported',recordedAt:'2026-09-19T14:00:00Z'}));assert.equal((await check()).summary.status,'REGRESSION')
 server.files.set(f.remotePath,f.receipt({recordedAt:'2026-09-19T12:30:00Z'}));assert.equal((await check()).summary.status,'STALE')
 server.files.set(f.remotePath,f.receipt({batchId:'Different batch',recordedAt:'2026-09-19T14:00:00Z'}));assert.equal((await check()).summary.status,'CONFLICT')
 server.files.set(f.remotePath,f.receipt({recordedAt:'2026-09-19T14:30:00Z'}));assert.equal((await check()).summary.status,'POSTED')
 assert.equal((await h.pool.query("SELECT count(*)::int n FROM payroll_retirement_receipt_observation WHERE decision='RECONCILED'")).rows[0].n,2)
 server.files.delete(f.remotePath);assert.equal((await check()).summary.status,'RECEIPT_NOT_FOUND');assert.equal(server.state.created,1)
}))
test('a contract suspended during retrieval preserves encrypted receipt but does not interpret it',{skip:!enabled},()=>scenario(async({h,f,server,check,setHook})=>{
 server.files.set(f.remotePath,f.receipt());setHook(async()=>{await f.api(f.contractPath,{action:'SUSPEND',expectedRevision:1,requestKey:randomUUID(),confirmed:true,reference:'Suspend receipt interpretation during provider result retrieval'})})
 const outcome=await check();assert.equal(outcome.summary.status,'BINDING_CHANGED');const stored=(await h.pool.query('SELECT encrypted_receipt,encrypted_result FROM payroll_retirement_receipt_observation WHERE id=$1',[outcome.id])).rows[0];assert.ok(stored.encrypted_receipt);assert.equal(stored.encrypted_result,null)
 await f.api(f.receiptPath,{confirmed:true,bindingId:f.bindingId,requestKey:randomUUID()},'POST',409)
}))
test('a retrieved invalid provider receipt blocks an otherwise proven unsent allocation release',{skip:!enabled},()=>scenario(async({h,f,server,check})=>{
 const releasePath=`${f.deliveryPath}/${f.allocationId}/release-unsent`
 await check();assert.equal((await f.api(releasePath+'/preview',{})).eligible,true)
 server.files.set(f.remotePath,Buffer.from('invalid provider evidence'));assert.equal((await check()).summary.status,'RECONCILIATION_REQUIRED')
 const preview=await f.api(releasePath+'/preview',{});assert.equal(preview.eligible,false);assert.match(preview.reasons.join(' '),/provider receipt was retrieved/)
 await f.api(releasePath,{fingerprint:preview.fingerprint,requestKey:randomUUID(),confirmed:true,outsideActivityReviewed:true,reference:'Attempt release despite contradictory provider receipt evidence'},'POST',409)
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_allocation_unsent_release')).rows[0].n,0);assert.equal(server.state.created,0)
},{blockWrite:true}))

test('employee contribution outcomes expose only their own reconciled receipt and fail closed on later uncertainty',{skip:!enabled},()=>scenario(async({h,f,server,check})=>{
 const read=()=>f.api('/retirement-contributions',undefined,'GET',200,true)
 const initial=await read();assert.equal(initial.items[0].contributions[0].status,'RECEIPT_UNVERIFIED');assert.equal(initial.items[0].contributions[0].amountCents,1400)
 server.files.set(f.remotePath,f.receipt());await check();const posted=await read();assert.equal(posted.items[0].contributions[0].status,'POSTED');assert.equal(posted.items[0].contributions[0].postedCents,1400)
 for(const privateValue of ['PRIVATE-PARTICIPANT','PRIVATE-PLAN','Synthetic batch','encrypted_result','sourceSha256',f.bindingId])assert.ok(!JSON.stringify(posted).includes(privateValue))
 assert.equal((await employeeRetirementContributions(h.pool,2,f.employee.id)).items.length,0);assert.equal((await employeeRetirementContributions(h.pool,1,999999)).items.length,0)
 const spoofed=await f.api('/retirement-contributions?employeeId=999999&facilityId=2',undefined,'GET',200,true);assert.deepEqual(spoofed,posted)
 assert.equal((await employeeRetirementContributions(h.pool,1,f.employee.id,{now:new Date(Date.now()+25*3600000)})).items[0].contributions[0].status,'REVIEW_REQUIRED')
 server.files.delete(f.remotePath);await check();const uncertain=await read();assert.equal(uncertain.items[0].contributions[0].status,'REVIEW_REQUIRED');assert.equal(uncertain.items[0].contributions[0].postedCents,null)
 await f.api('/retirement-contributions?beforeRunId=invalid',undefined,'GET',400,true)
 assert.equal((await fetch(h.url+'/api/payroll/employee/retirement-contributions')).status,401)
}))

test('returned funding reopens employee participant visibility and persists across later ordinary observations',{skip:!enabled},()=>scenario(async({h,f,server,check,provider})=>{
 const read=()=>f.api('/retirement-contributions',undefined,'GET',200,true)
 server.files.set(f.remotePath,f.receipt());await check();assert.equal((await read()).items[0].contributions[0].status,'POSTED')
 const bankPath=`/retirement-remittance-authorizations/${f.remittanceId}/dispatch`
 await f.api(bankPath,{action:'SUBMIT',confirmed:true,bankInstructionsReviewed:true,outsideActivityReviewed:true,reference:'Verified trustee funding and independent participant allocation file'})
 provider.complete();await f.api(bankPath,{action:'RECOVER',confirmed:true})
 provider.returnedCredit();await f.api(bankPath,{action:'RECOVER',confirmed:true})
 const returned=(await read()).items[0].contributions[0];assert.equal(returned.fundingStatus,'RETURN_REVIEW_REQUIRED');assert.equal(returned.status,'REVIEW_REQUIRED');assert.equal(returned.postedCents,null);assert.equal(returned.amountCents,1400)
 for(const value of ['PRIVATE RETURN REASON','PRIVATE-PARTICIPANT','PRIVATE-PLAN',f.remittanceId])assert.ok(!JSON.stringify(returned).includes(value))
 provider.complete();await f.api(bankPath,{action:'RECOVER',confirmed:true});await check()
 assert.equal((await read()).items[0].contributions[0].fundingStatus,'RETURN_REVIEW_REQUIRED')
 const assessment=await f.api(`/retirement-remittance-authorizations/${f.remittanceId}/assessment`);assert.equal(assessment.returnReviewRequired,true);assert.equal(assessment.status,'REVIEW_REQUIRED')
 await assert.rejects(h.pool.query('INSERT INTO payroll_retirement_contribution_assessment(facility_id,authorization_id,fingerprint,summary) VALUES(1,$1,$2,$3)',[f.remittanceId,'0'.repeat(64),{...assessment,status:'RECONCILED',payrollStatus:'MATCHED',bankStatus:'BANK_POSTED',receiptStatus:'POSTED',accountingStatus:'MATCHED',returnAccountingStatus:'NOT_REQUIRED',postedCents:1400,issues:[]}]),/matching evidence in every component/)
 assert.equal((await f.api(f.receiptPath)).history[0].summary.status,'POSTED');assert.equal(provider.posts(),1)
 assert.equal((await employeeRetirementContributions(h.pool,2,f.employee.id)).items.length,0)
}))

for(const automatic of [false,true])test(`reviewed participant reversals require prior posting and a verified full bank return (${automatic?'automatic':'manual'} replacement)`,{skip:!enabled},()=>scenario(async({h,f,server,check,provider,setNow,setQbo,setTransferHook,setPayment})=>{
 const accounting=retirementReversalAccountingFixture(h,f);setQbo(accounting.fetcher)
 const contract=await f.api(f.contractPath,{...f.contractBody,expectedRevision:1,requestKey:randomUUID(),contract:{...f.contractBody.contract,participantReversalConfirmed:true,statusValues:{...f.contractBody.contract.statusValues,REVERSED:'Reversed credit'}}})
 const binding=await f.api(f.bindingPath,{...f.bindingBody,expectedRevision:1,contractId:contract.id,requestKey:randomUUID()});f.bindingId=binding.id
 const bankPath=`/retirement-remittance-authorizations/${f.remittanceId}/dispatch`
 await f.api(bankPath,{action:'SUBMIT',confirmed:true,bankInstructionsReviewed:true,outsideActivityReviewed:true,reference:'Verified trustee funding and independent participant allocation file'})
 provider.complete();await f.api(bankPath,{action:'RECOVER',confirmed:true});assert.equal((await accounting.prepareOriginal()).status,'SYNCED')
 server.files.set(f.remotePath,f.receipt());assert.equal((await check()).summary.status,'POSTED')
 const reversed=f.receipt({status:'Reversed credit',recordedAt:'2026-09-24T15:00:00Z',ordinaryPretaxCents:0,ordinaryRothCents:0,catchUpPretaxCents:0,catchUpRothCents:0,totalCents:0});setNow('2026-09-25T15:00:00Z');server.files.set(f.remotePath,reversed)
 assert.equal((await check()).summary.status,'RECONCILIATION_REQUIRED')
 provider.returnedCredit();await f.api(bankPath,{action:'RECOVER',confirmed:true})
 const outcome=await check();assert.equal(outcome.summary.status,'REVERSED');assert.equal(outcome.summary.reversedAllocationCents,1400);assert.equal(outcome.summary.postedCents,0)
 const retained=(await h.pool.query('SELECT encrypted_result FROM payroll_retirement_receipt_observation WHERE id=$1',[outcome.id])).rows[0]
 const evidence=JSON.parse(decryptDocument(retained.encrypted_result,`payroll-retirement-receipt:1:${outcome.id}:result`).toString());assert.ok(evidence.returnBankEvidence.observationId);assert.equal(evidence.returnBankEvidence.event.amountCents,1400)
 const beforeAccounting=await f.api(`/retirement-remittance-authorizations/${f.remittanceId}/assessment`);assert.equal(beforeAccounting.receiptStatus,'REVERSED');assert.equal(beforeAccounting.reversedAllocationCents,1400);assert.equal(beforeAccounting.replacementReviewStatus,'EVIDENCE_REQUIRED')
 assert.equal((await accounting.prepareReturn()).status,'SYNCED')
 const ready=await f.api(`/retirement-remittance-authorizations/${f.remittanceId}/assessment`);assert.equal(ready.replacementReviewStatus,'EVIDENCE_READY');assert.equal(ready.status,'REVIEW_REQUIRED');assert.equal(ready.accountingStatus,'VERIFIED_WITH_RETURN')
 assert.equal((await f.api(`/retirement-remittance-authorizations/${f.remittanceId}/assessment-history`)).history[0].summary.replacementReviewStatus,'EVIDENCE_READY')
 const replacementPath=`/retirement-remittance-authorizations/${f.remittanceId}/replacement-preview`,instructions={confirmed:true,newAllocationRequired:true,priorBatchReversedConfirmed:true,outsideActivityReviewed:true,lateCorrectionReviewed:true,reference:'Verified recordkeeper instructions require a new allocation and separate replacement funding',fileName:'reviewed_replacement_2026.csv',depositDate:'2026-09-29'}
 const replacement=await f.api(replacementPath,instructions);assert.equal(replacement.status,'REPLACEMENT_PREVIEW_ONLY');assert.equal(replacement.originalWithheldDate,'2026-09-18');assert.equal(replacement.timing.depositDate,'2026-09-29');assert.equal(replacement.amountCents,1400);assert.equal(replacement.receiptId,outcome.id)
 assert.equal((await f.api(replacementPath,instructions)).fingerprint,replacement.fingerprint);assert.ok(!JSON.stringify(replacement).includes('PRIVATE-PARTICIPANT'))
 await f.api(replacementPath,{...instructions,newAllocationRequired:false},'POST',400)
 await f.api(replacementPath,{...instructions,fileName:f.deliveryBody.fileName},'POST',409)
 await f.api(replacementPath,{...instructions,depositDate:'2026-09-27'},'POST',409)
 server.files.set(f.remotePath,Buffer.from('changed reversal receipt'));await f.api(replacementPath,instructions,'POST',409);server.files.set(f.remotePath,reversed)
 const target=server.config.deliveryDirectory+'/'+instructions.fileName;server.files.set(target,Buffer.from('outside existing file'));await f.api(replacementPath,instructions,'POST',409);server.files.delete(target)
 const authPath=`/retirement-remittance-authorizations/${f.remittanceId}/replacement-authorizations`,body={confirmed:true,autoProcess:true,requestKey:randomUUID(),fingerprint:replacement.fingerprint,inputs:instructions}
 await f.api(authPath,{...body,fingerprint:'0'.repeat(64)},'POST',409)
 const approvals=await Promise.all([f.api(authPath,body),f.api(authPath,body)]);assert.equal(approvals[0].id,approvals[1].id);assert.equal(approvals.filter(a=>a.reused).length,1)
 await f.api(authPath,{...body,requestKey:randomUUID()},'POST',409)
 const stored=(await h.pool.query('SELECT * FROM payroll_retirement_replacement_authorization')).rows[0];assert.ok(decryptDocument(stored.encrypted_allocation,`payroll-retirement-replacement:1:${stored.id}`).toString().includes('PRIVATE-PARTICIPANT'));assert.ok(!JSON.stringify(await f.api(authPath)).includes('encrypted_allocation'))
 await assert.rejects(h.pool.query('INSERT INTO payroll_retirement_allocation_authorization(id,facility_id,remittance_id,configuration_id,file_name,reference,request_key,request_fingerprint,created_by) SELECT $1,facility_id,remittance_id,configuration_id,$2,reference,$3,request_fingerprint,created_by FROM payroll_retirement_allocation_authorization WHERE id=$4',[randomUUID(),instructions.fileName,randomUUID(),f.allocationId]),/never-reserved retirement allocation filename/)
 const foreign=await fetch(h.url+'/api/admin/payroll'+authPath,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(foreign.status,404)
 const vault=process.env.PAYROLL_DOCUMENT_KEY;delete process.env.PAYROLL_DOCUMENT_KEY
 const cancelPath=`/retirement-replacement-authorizations/${stored.id}/cancel`,cancel={confirmed:true,reference:'Recheck the replacement instructions before any file or funds are claimed'}
 try{assert.equal((await f.api(authPath,body)).reused,true);await f.api(cancelPath,cancel);assert.equal((await f.api(cancelPath,cancel)).reused,true);assert.equal((await f.api(authPath,body)).cancelled,true)}finally{process.env.PAYROLL_DOCUMENT_KEY=vault}
 await assert.rejects(h.pool.query("INSERT INTO payroll_retirement_replacement_claim(authorization_id,kind) VALUES($1,'BANK')",[stored.id]),/Cancelled replacement/)
 await f.api(replacementPath,instructions,'POST',409)
 const nextInputs={...instructions,fileName:'reviewed_replacement_second_2026.csv'},nextPreview=await f.api(replacementPath,nextInputs),next=await f.api(authPath,{...body,inputs:nextInputs,fingerprint:nextPreview.fingerprint,requestKey:randomUUID()})
 const replacementBindingPath=`/retirement-replacement-authorizations/${next.id}/receipt-binding`,replacementBindingBody={...f.bindingBody,expectedRevision:0,contractId:contract.id,fileName:'replacement_receipt.csv',requestKey:randomUUID()}
 await f.api(replacementBindingPath,replacementBindingBody,'POST',409)
 const dispatchPath=`/retirement-replacement-authorizations/${next.id}/allocation-dispatch`,dispatchBody={confirmed:true,action:'SUBMIT',outsideActivityReviewed:true,reference:'Verified no outside replacement allocation has been submitted'}
 await f.api(dispatchPath,{confirmed:true,action:'RECOVER'},'POST',409)
 await f.api(dispatchPath,{...dispatchBody,outsideActivityReviewed:false},'POST',400)
 server.files.set(f.remotePath,Buffer.from('changed before first replacement submission'));await f.api(dispatchPath,dispatchBody,'POST',409);server.files.set(f.remotePath,reversed)
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_replacement_claim WHERE authorization_id=$1',[next.id])).rows[0].n,0)
 setTransferHook(async options=>{if(options.mode==='SUBMIT')assert.equal((await h.pool.query("SELECT count(*)::int n FROM payroll_retirement_replacement_claim WHERE authorization_id=$1 AND kind='ALLOCATION'",[next.id])).rows[0].n,1)})
 server.state.loseRename=true
 const automationOptions={facility:1,fetcher:accounting.fetcher,paymentFetcher:provider.fetcher,reader:(c,r)=>readRetirementSftpReceipt(c,r,server.options),transfer:async(c,file,options)=>{if(options.mode==='SUBMIT')assert.equal((await h.pool.query("SELECT count(*)::int n FROM payroll_retirement_replacement_claim WHERE authorization_id=$1 AND kind='ALLOCATION'",[next.id])).rows[0].n,1);return transferRetirementAllocation(c,file,{...server.options,...options})},dispatchNow:()=>new Date('2026-09-25T15:00:00Z')}
 if(automatic){
  const start=new Date();assert.equal((await runRetirementReplacementAllocationSweep(h.pool,{...automationOptions,facility:2,now:start})).attempted,0)
  const sweeps=await Promise.all([runRetirementReplacementAllocationSweep(h.pool,{...automationOptions,now:start}),runRetirementReplacementAllocationSweep(h.pool,{...automationOptions,now:start})]);assert.equal(sweeps.reduce((n,x)=>n+x.attempted,0),1)
  assert.equal((await runRetirementReplacementAllocationSweep(h.pool,{...automationOptions,now:new Date(+start+60000)})).attempted,0)
  const recovered=await runRetirementReplacementAllocationSweep(h.pool,{...automationOptions,now:new Date(+start+360000)});assert.equal(recovered.verified,1)
  const history=(await f.api(authPath)).history.find(x=>x.id===next.id);assert.equal(history.file_automatic,true);assert.equal(history.file_attempts.length,2)
  assert.equal((await h.pool.query("SELECT automatic FROM payroll_retirement_replacement_claim WHERE authorization_id=$1 AND kind='ALLOCATION'",[next.id])).rows[0].automatic,true)
  await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_replacement_attempt WHERE authorization_id=$1',[next.id]),/append-only/)
  const enabled=process.env.PAYROLL_RETIREMENT_REPLACEMENT_ENABLED;process.env.PAYROLL_RETIREMENT_REPLACEMENT_ENABLED='false';try{assert.equal(startRetirementReplacementAllocationScheduler(h.pool),null)}finally{if(enabled===undefined)delete process.env.PAYROLL_RETIREMENT_REPLACEMENT_ENABLED;else process.env.PAYROLL_RETIREMENT_REPLACEMENT_ENABLED=enabled}
 }else{
  const dispatches=await Promise.all([f.api(dispatchPath,dispatchBody),f.api(dispatchPath,dispatchBody)])
  assert.equal(dispatches.filter(x=>x.recovery).length,1);assert.ok(dispatches.some(x=>x.result.status==='REMOTE_FILE_VERIFIED'));assert.ok(dispatches.some(x=>x.result.status==='TRANSPORT_UNCERTAIN'))
 }
 assert.equal(server.state.created,2)
 const replacementTarget=server.config.deliveryDirectory+'/'+nextInputs.fileName
 assert.ok(server.files.get(replacementTarget).toString().includes('PRIVATE-PARTICIPANT'))
 const boundReplacement=await Promise.all([f.api(replacementBindingPath,replacementBindingBody),f.api(replacementBindingPath,replacementBindingBody)]);assert.equal(boundReplacement[0].id,boundReplacement[1].id);assert.equal(boundReplacement.filter(x=>x.reused).length,1)
 const receiptLocation=await f.api(replacementBindingPath);assert.equal(receiptLocation.status,'BOUND');assert.equal(receiptLocation.originalFileName,nextInputs.fileName);assert.equal(receiptLocation.history.length,1)
 await f.api(replacementBindingPath,{...replacementBindingBody,requestKey:randomUUID()},'POST',409)
 const foreignLocation=await fetch(h.url+'/api/admin/payroll'+replacementBindingPath,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(foreignLocation.status,404)
 await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_replacement_receipt_binding WHERE allocation_id=$1',[next.id]),/append-only/)
 await assert.rejects(h.pool.query('INSERT INTO payroll_retirement_replacement_receipt_binding SELECT $1,2,allocation_id,claim_id,configuration_id,contract_id,2,disposition,directory,file_name,reference,$2,request_fingerprint,created_by,clock_timestamp() FROM payroll_retirement_replacement_receipt_binding WHERE allocation_id=$3',[randomUUID(),randomUUID(),next.id]),/scoped claim/)
 delete process.env.PAYROLL_DOCUMENT_KEY
 try{assert.equal((await f.api(replacementBindingPath,replacementBindingBody)).reused,true);await f.api(replacementBindingPath,{action:'SUSPEND',expectedRevision:1,requestKey:randomUUID(),confirmed:true,reference:'Suspend replacement receipt interpretation while verifying provider location'});assert.equal((await f.api(replacementBindingPath)).status,'SUSPENDED')}finally{process.env.PAYROLL_DOCUMENT_KEY=vault}
 await f.api(replacementBindingPath,{...replacementBindingBody,expectedRevision:2,requestKey:randomUUID()});assert.equal((await f.api(replacementBindingPath)).history.length,3)
 assert.equal((await f.api(f.bindingPath)).history[0].id,f.bindingId)
 const replacementBank=retirementReplacementBankProvider(provider.fetcher,next.id,{beforePost:async()=>assert.equal((await h.pool.query("SELECT count(*)::int n FROM payroll_retirement_replacement_claim WHERE authorization_id=$1 AND kind='BANK' AND encrypted_instruction IS NOT NULL",[next.id])).rows[0].n,1)})
 setPayment(replacementBank.fetcher)
 const fundingPath=`/retirement-replacement-authorizations/${next.id}/bank-dispatch`,fundingBody={confirmed:true,action:'SUBMIT',bankInstructionsReviewed:true,outsideActivityReviewed:true,reference:'Verified separate replacement funding with no outside payment or provider debit'}
 await f.api(fundingPath,{confirmed:true,action:'RECOVER'},'POST',409)
 await f.api(fundingPath,{...fundingBody,outsideActivityReviewed:false},'POST',400)
 const allocationBytes=server.files.get(replacementTarget);server.files.delete(replacementTarget);await f.api(fundingPath,fundingBody,'POST',409);server.files.set(replacementTarget,allocationBytes);assert.equal(replacementBank.posts(),0)
 const bankAutomationOptions={...automationOptions,paymentFetcher:replacementBank.fetcher},bankStart=new Date()
 if(automatic){
  assert.equal((await runRetirementReplacementBankSweep(h.pool,{...bankAutomationOptions,facility:2,now:bankStart})).attempted,0)
  server.files.delete(replacementTarget);assert.equal((await runRetirementReplacementBankSweep(h.pool,{...bankAutomationOptions,now:bankStart})).attempted,1);assert.equal(replacementBank.posts(),0);server.files.set(replacementTarget,allocationBytes)
  assert.equal((await runRetirementReplacementBankSweep(h.pool,{...bankAutomationOptions,now:new Date(+bankStart+60000)})).attempted,0)
  const sweeps=await Promise.all([runRetirementReplacementBankSweep(h.pool,{...bankAutomationOptions,now:new Date(+bankStart+360000)}),runRetirementReplacementBankSweep(h.pool,{...bankAutomationOptions,now:new Date(+bankStart+360000)})]);assert.equal(sweeps.reduce((n,x)=>n+x.attempted,0),1)
  assert.equal((await runRetirementReplacementBankSweep(h.pool,{...bankAutomationOptions,now:new Date(+bankStart+720000)})).attempted,1)
  const history=(await f.api(authPath)).history.find(x=>x.id===next.id);assert.equal(history.bank_result.status,'SENT');assert.equal(history.bank_automatic,true);assert.equal(history.bank_attempts.length,3)
  assert.equal((await h.pool.query("SELECT automatic FROM payroll_retirement_replacement_claim WHERE authorization_id=$1 AND kind='BANK'",[next.id])).rows[0].automatic,true)
  const enabled=process.env.PAYROLL_RETIREMENT_REPLACEMENT_ENABLED;process.env.PAYROLL_RETIREMENT_REPLACEMENT_ENABLED='false';try{assert.equal(startRetirementReplacementBankScheduler(h.pool),null)}finally{if(enabled===undefined)delete process.env.PAYROLL_RETIREMENT_REPLACEMENT_ENABLED;else process.env.PAYROLL_RETIREMENT_REPLACEMENT_ENABLED=enabled}
 }else{
  const funding=await Promise.all([f.api(fundingPath,fundingBody),f.api(fundingPath,fundingBody)]);assert.equal(funding.filter(x=>x.recovery).length,1);assert.ok(funding.some(x=>x.result.status==='UNCERTAIN'));assert.ok(funding.some(x=>x.result.status==='SENT'))
 }
 assert.equal(replacementBank.posts(),1)
 const bankClaim=(await h.pool.query("SELECT encrypted_instruction FROM payroll_retirement_replacement_claim WHERE authorization_id=$1 AND kind='BANK'",[next.id])).rows[0];const bankIntent=JSON.parse(decryptDocument(bankClaim.encrypted_instruction,`payroll-retirement-replacement-bank:1:${next.id}`).toString());assert.equal(bankIntent.originalAuthorizationId,f.remittanceId);assert.equal(bankIntent.originalWithheldDate,'2026-09-18');assert.equal(bankIntent.paymentDate,'2026-09-29')
 replacementBank.complete()
 if(automatic){assert.equal((await runRetirementReplacementBankSweep(h.pool,{...bankAutomationOptions,now:new Date(+bankStart+1080000)})).verified,1);assert.equal((await runRetirementReplacementBankSweep(h.pool,{...bankAutomationOptions,now:new Date(+bankStart+3600000)})).attempted,0)}
 const bankPosted=await f.api(fundingPath,{confirmed:true,action:'RECOVER'});assert.equal(bankPosted.result.settlementStatus,'BANK_POSTED')
 const replacementReceiptPath=`/retirement-replacement-authorizations/${next.id}/receipts`,receiptBinding=(await f.api(replacementBindingPath)).history[0],replacementReceiptRemote=receiptBinding.directory+'/'+receiptBinding.file_name
 const replacementReceiptBody={confirmed:true,bindingId:receiptBinding.id,requestKey:randomUUID()},replacementReceiptValues={sourceFileName:nextInputs.fileName,sourceSha256:createHash('sha256').update(allocationBytes).digest('hex'),batchId:'Synthetic replacement participant batch',recordedAt:'2026-09-29T15:00:00Z'}
 setNow('2026-09-30T15:00:00Z')
 server.files.set(replacementReceiptRemote,f.receipt());assert.equal((await f.api(replacementReceiptPath,{...replacementReceiptBody,requestKey:randomUUID()})).summary.status,'RECONCILIATION_REQUIRED')
 server.files.set(replacementReceiptRemote,f.receipt(replacementReceiptValues))
 const replacementReceipts=await Promise.all([f.api(replacementReceiptPath,replacementReceiptBody),f.api(replacementReceiptPath,replacementReceiptBody)]);assert.equal(replacementReceipts[0].id,replacementReceipts[1].id);assert.equal(replacementReceipts[0].summary.status,'POSTED');assert.equal(replacementReceipts[0].summary.postedCents,1400)
 const replacementAssessmentPath=`/retirement-replacement-authorizations/${next.id}/assessment`
 const matchedReplacement=await f.api(replacementAssessmentPath)
 assert.equal(matchedReplacement.deliveryStatus,'MATCHED',JSON.stringify(matchedReplacement));assert.equal(matchedReplacement.bankStatus,'BANK_POSTED');assert.equal(matchedReplacement.receiptStatus,'POSTED');assert.equal(matchedReplacement.postedCents,1400);assert.equal(matchedReplacement.status,'REVIEW_REQUIRED');assert.equal(matchedReplacement.accountingStatus,'REQUIRED');assert.equal(matchedReplacement.caseStatus,'OPEN')
 assert.ok(!JSON.stringify(matchedReplacement).includes('PRIVATE-PARTICIPANT'))
 const employeeReplacement=()=>f.api('/retirement-contributions',undefined,'GET',200,true)
 const employeeWithReplacement=await employeeReplacement(),employeeOutcome=employeeWithReplacement.items[0].contributions[0];assert.equal(employeeOutcome.status,'REVIEW_REQUIRED');assert.equal(employeeOutcome.postedCents,null);assert.equal(employeeOutcome.replacement.status,'POSTED');assert.equal(employeeOutcome.replacement.postedCents,1400);assert.equal(employeeOutcome.replacement.caseStatus,'OPEN')
 assert.deepEqual(Object.keys(employeeOutcome.replacement).sort(),['accountingStatus','caseStatus','postedCents','receiptCheckedAt','status'].sort())
 for(const secret of ['PRIVATE-PARTICIPANT','Synthetic replacement participant batch',next.id,nextInputs.fileName,'realmId','sourceSha256','encrypted_result'])assert.ok(!JSON.stringify(employeeWithReplacement).includes(secret))
 assert.equal((await employeeRetirementContributions(h.pool,2,f.employee.id)).items.length,0);assert.equal((await employeeRetirementContributions(h.pool,1,999999)).items.length,0)
 assert.deepEqual(await f.api('/retirement-contributions?employeeId=999999&facilityId=2',undefined,'GET',200,true),employeeWithReplacement)
 assert.equal((await employeeRetirementContributions(h.pool,1,f.employee.id,{now:new Date(Date.now()+25*3600000)})).items[0].contributions[0].replacement.postedCents,null)

 const staleReplacement=await retirementReplacementAssessment(h.pool,1,next.id,{now:new Date(Date.now()+25*3600000)});assert.equal(staleReplacement.deliveryStatus,'UNVERIFIED');assert.equal(staleReplacement.bankStatus,'UNVERIFIED');assert.equal(staleReplacement.receiptStatus,'UNVERIFIED');assert.equal(staleReplacement.postedCents,null)
 const futureReplacement=await retirementReplacementAssessment(h.pool,1,next.id,{now:new Date(Date.now()-3600000)});assert.equal(futureReplacement.bankStatus,'UNVERIFIED');assert.equal(futureReplacement.receiptStatus,'UNVERIFIED')
 const foreignAssessment=await fetch(h.url+'/api/admin/payroll'+replacementAssessmentPath,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(foreignAssessment.status,404)
 const settlementPreviewPath=`/retirement-replacement-authorizations/${next.id}/settlement-preview`,settlementApprovalPath=`/retirement-replacement-authorizations/${next.id}/settlement-authorizations`
 const originalReturnJournal=accounting.journal('101');accounting.setJournal('101',null);await f.api(settlementPreviewPath,{},'POST',409);accounting.setJournal('101',originalReturnJournal)
 accounting.closed(true);await f.api(settlementPreviewPath,{},'POST',409);accounting.closed(false)
 const settlementPreview=await f.api(settlementPreviewPath,{})
 assert.equal(settlementPreview.returnJournalId,'101');assert.equal(settlementPreview.sourceJournalId,'99');assert.equal(settlementPreview.journals.length,1);assert.equal(settlementPreview.journals[0].payload.TxnDate,'2026-09-29');assert.deepEqual(settlementPreview.journals[0].payload.Line.map(l=>[l.JournalEntryLineDetail.PostingType,l.JournalEntryLineDetail.AccountRef.value,l.Amount]),[['Debit','7',14],['Credit','8',14]])
 assert.equal(accounting.posts(),2)
 const settlementReview={confirmed:true,autoPost:true,outsideAccountingReviewed:true,fingerprint:settlementPreview.fingerprint,requestKey:randomUUID(),reference:'Reviewed exact replacement liability and bank journals with no outside accounting duplicates'}
 await f.api(settlementApprovalPath,{...settlementReview,outsideAccountingReviewed:false},'POST',400)
 const settlementApprovals=await Promise.all([f.api(settlementApprovalPath,settlementReview),f.api(settlementApprovalPath,settlementReview)]);assert.equal(settlementApprovals[0].id,settlementApprovals[1].id)
 const cancelledSettlement=settlementApprovals[0].id,cancelSettlementPath=`/retirement-replacement-settlement-authorizations/${cancelledSettlement}/cancel`,cancelSettlement={confirmed:true,reference:'Cancel reviewed replacement accounting before any provider posting'}
 delete process.env.PAYROLL_DOCUMENT_KEY;try{assert.equal((await f.api(settlementApprovalPath,settlementReview)).reused,true);await f.api(cancelSettlementPath,cancelSettlement);assert.equal((await f.api(cancelSettlementPath,cancelSettlement)).reused,true)}finally{process.env.PAYROLL_DOCUMENT_KEY=vault}
 // A changed second preflight must retain affirmative non-send; release then
 // permits a new approval without deleting the old journal reservation.
 const unsentSettlement=await f.api(settlementApprovalPath,{...settlementReview,requestKey:randomUUID()}),unsentBase=`/retirement-replacement-settlement-authorizations/${unsentSettlement.id}`
 await f.api(unsentBase+'/release-preview',{},'POST',409)
 let returnReads=0
 accounting.onRead(async url=>{if(url.includes('/journalentry/101')&&++returnReads===2)accounting.setJournal('101',null)})
 const unsentResult=await f.api(unsentBase+'/post',{confirmed:true,action:'POST'})
 accounting.onRead(async()=>{});accounting.setJournal('101',originalReturnJournal)
 assert.equal(unsentResult.results[0].status,'NOT_SENT');assert.equal(accounting.posts(),2)
 const releasePreview=await f.api(unsentBase+'/release-preview',{})
 assert.equal(releasePreview.status,'RELEASE_PREVIEW_ONLY');assert.equal(releasePreview.replacementAuthorizationId,next.id);assert.equal(releasePreview.journals[0].status,'NOT_FOUND')
 assert.equal((await f.api(unsentBase+'/release-preview',{})).fingerprint,releasePreview.fingerprint)
 const foreignRelease=await fetch(h.url+'/api/admin/payroll'+unsentBase+'/release-preview',{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:'{}'});assert.equal(foreignRelease.status,404)
 const unsentJob=(await h.pool.query('SELECT * FROM payroll_retirement_replacement_settlement_journal WHERE authorization_id=$1',[unsentSettlement.id])).rows[0]
 accounting.setJournal('outside',{...unsentJob.payload,Id:'outside'});await f.api(unsentBase+'/release-preview',{},'POST',409);accounting.setJournal('outside',null)
 const releaseBody={confirmed:true,outsideActivityReviewed:true,fingerprint:releasePreview.fingerprint,reference:'Verified original replacement journals never sent and absent without outside accounting'}
 await f.api(unsentBase+'/release-unsent',{...releaseBody,fingerprint:'0'.repeat(64)},'POST',409)
 const releaseResults=await Promise.all([f.api(unsentBase+'/release-unsent',releaseBody),f.api(unsentBase+'/release-unsent',releaseBody)])
 assert.equal(releaseResults.filter(r=>r.reused).length,1)
 delete process.env.PAYROLL_DOCUMENT_KEY;try{assert.equal((await f.api(unsentBase+'/release-unsent',releaseBody)).reused,true)}finally{process.env.PAYROLL_DOCUMENT_KEY=vault}
 await f.api(unsentBase+'/release-unsent',{...releaseBody,reference:'A different review must never replace the retained release'},'POST',409)
 await f.api(unsentBase+'/post',{confirmed:true,action:'RECOVER'},'POST',409)
 await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_replacement_settlement_release WHERE authorization_id=$1',[unsentSettlement.id]),/append-only/)
 const approvedSettlement=await f.api(settlementApprovalPath,{...settlementReview,requestKey:randomUUID()}),postSettlementPath=`/retirement-replacement-settlement-authorizations/${approvedSettlement.id}/post`
 await f.api(postSettlementPath,{confirmed:true,action:'RECOVER'},'POST',409)
 accounting.setJournal('101',null);await f.api(postSettlementPath,{confirmed:true,action:'POST'},'POST',409);assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_replacement_settlement_claim WHERE authorization_id=$1',[approvedSettlement.id])).rows[0].n,0);accounting.setJournal('101',originalReturnJournal)
 accounting.onPost(async()=>{assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_replacement_settlement_claim WHERE authorization_id=$1',[approvedSettlement.id])).rows[0].n,1);assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_replacement_settlement_journal WHERE authorization_id=$1',[approvedSettlement.id])).rows[0].n,1)})
 accounting.loseNextResponse()
 const settlementWorkerOptions={facility:1,fetcher:accounting.fetcher,paymentFetcher:replacementBank.fetcher},settlementStart=new Date()
 if(automatic){assert.equal((await runRetirementReplacementSettlementSweep(h.pool,{...settlementWorkerOptions,facility:2,now:settlementStart})).attempted,0);assert.equal((await runRetirementReplacementSettlementSweep(h.pool,{...settlementWorkerOptions,now:settlementStart})).attempted,1)}
 else assert.equal((await f.api(postSettlementPath,{confirmed:true,action:'POST'})).results[0].status,'UNCERTAIN')
 assert.equal(accounting.posts(),3);assert.equal((await f.api(replacementAssessmentPath)).accountingStatus,'REVIEW_REQUIRED')
 if(automatic){const sweeps=await Promise.all([runRetirementReplacementSettlementSweep(h.pool,{...settlementWorkerOptions,now:new Date(+settlementStart+360000)}),runRetirementReplacementSettlementSweep(h.pool,{...settlementWorkerOptions,now:new Date(+settlementStart+360000)})]);assert.equal(sweeps.reduce((n,r)=>n+r.attempted,0),1)}
 else assert.equal((await f.api(postSettlementPath,{confirmed:true,action:'RECOVER'})).status,'SYNCED')
 await f.api(`/retirement-replacement-settlement-authorizations/${approvedSettlement.id}/release-preview`,{},'POST',409)
 assert.equal(accounting.posts(),3);assert.equal((await f.api(replacementAssessmentPath)).accountingStatus,'MATCHED');assert.equal((await f.api(replacementAssessmentPath)).caseStatus,'CLOSED');assert.equal((await employeeReplacement()).items[0].contributions[0].replacement.accountingStatus,'MATCHED')
 const closedCase=await f.api(`/retirement-remittance-authorizations/${f.remittanceId}/assessment`);assert.equal(closedCase.status,'REPLACEMENT_RECONCILED');assert.equal(closedCase.replacementCaseStatus,'CLOSED');assert.equal(closedCase.returnReviewRequired,false)
 const caseHistory=async()=> (await h.pool.query('SELECT id,summary FROM payroll_retirement_contribution_assessment WHERE authorization_id=$1 ORDER BY id DESC',[f.remittanceId])).rows
 const closedHistory=await caseHistory();assert.equal(closedHistory[0].summary.status,'REPLACEMENT_RECONCILED');assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`retirement-contribution-${f.remittanceId}`])).rows[0].status,'DISMISSED')
 assert.equal((await h.pool.query("SELECT count(*)::int n FROM payroll_alert WHERE facility_id=1 AND status='OPEN' AND dedupe_key=ANY($1::text[])",[[`retirement-replacement-bank-${next.id}`,`retirement-replacement-file-${next.id}`,`retirement-replacement-receipt-${next.id}`]])).rows[0].n,0)
 const closedEmployee=(await employeeReplacement()).items[0].contributions[0];assert.equal(closedEmployee.replacement.caseStatus,'CLOSED');assert.equal(closedEmployee.fundingStatus,'RETURN_REPLACED');assert.equal(closedEmployee.status,'REVERSED');assert.equal(closedEmployee.replacement.postedCents,1400)
 await assert.rejects(h.pool.query('INSERT INTO payroll_retirement_contribution_assessment(facility_id,authorization_id,fingerprint,summary) VALUES(1,$1,$2,$3)',[f.remittanceId,'0'.repeat(64),{...closedHistory[0].summary,replacementEvidence:{...closedHistory[0].summary.replacementEvidence,postedCents:1}}]),/Replacement closure requires/)
 accounting.closed(true);assert.equal((await f.api(postSettlementPath,{confirmed:true,action:'RECOVER'})).status,'SYNCED');accounting.closed(false)
 accounting.setJournal('101',null);assert.equal((await f.api(postSettlementPath,{confirmed:true,action:'RECOVER'})).status,'NEEDS_REVIEW');assert.equal((await f.api(replacementAssessmentPath)).accountingStatus,'REVIEW_REQUIRED');accounting.setJournal('101',originalReturnJournal);assert.equal((await f.api(postSettlementPath,{confirmed:true,action:'RECOVER'})).status,'SYNCED')
 assert.equal((await retirementReplacementAssessment(h.pool,1,next.id,{now:new Date(Date.now()+25*3600000)})).accountingStatus,'REVIEW_REQUIRED')
 const replacementJournal=accounting.journal('102');accounting.setJournal('102',null);assert.equal((await f.api(postSettlementPath,{confirmed:true,action:'RECOVER'})).results[0].status,'NOT_FOUND');assert.equal((await f.api(replacementAssessmentPath)).accountingStatus,'REVIEW_REQUIRED');assert.equal(accounting.posts(),3);accounting.setJournal('102',replacementJournal)
 assert.equal((await caseHistory())[0].summary.status,'REVIEW_REQUIRED');assert.ok((await caseHistory()).some(row=>row.summary.status==='REPLACEMENT_RECONCILED'));assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`retirement-contribution-${f.remittanceId}`])).rows[0].status,'OPEN');assert.equal((await employeeReplacement()).items[0].contributions[0].replacement.caseStatus,'OPEN')
 assert.equal((await f.api(postSettlementPath,{confirmed:true,action:'RECOVER'})).status,'SYNCED')
 assert.equal((await caseHistory())[0].summary.status,'REPLACEMENT_RECONCILED');assert.ok((await caseHistory()).filter(row=>row.summary.status==='REPLACEMENT_RECONCILED').length>=2)
 await f.api(`/retirement-replacement-settlement-authorizations/${approvedSettlement.id}/cancel`,cancelSettlement,'POST',409)
 const foreignSettlement=await fetch(h.url+'/api/admin/payroll'+postSettlementPath,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'},body:JSON.stringify({confirmed:true,action:'POST'})});assert.equal(foreignSettlement.status,404)
 await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_replacement_settlement_claim WHERE authorization_id=$1',[approvedSettlement.id]),/append-only/)
 await assert.rejects(h.pool.query("INSERT INTO payroll_retirement_replacement_settlement_observation(journal_id,source,result,create_attempted) SELECT id,'RECOVERY','{}'::jsonb,true FROM payroll_retirement_replacement_settlement_journal WHERE authorization_id=$1",[approvedSettlement.id]),/check constraint/)
 const privateReceipt=(await h.pool.query('SELECT * FROM payroll_retirement_replacement_receipt_observation WHERE id=$1',[replacementReceipts[0].id])).rows[0];assert.ok(!privateReceipt.encrypted_receipt.includes(Buffer.from('PRIVATE-PARTICIPANT')));assert.ok(decryptDocument(privateReceipt.encrypted_receipt,`payroll-retirement-replacement-receipt:1:${privateReceipt.id}:file`).equals(server.files.get(replacementReceiptRemote)))
 assert.ok(!JSON.stringify(await f.api(replacementReceiptPath)).includes('PRIVATE-PARTICIPANT'));assert.ok(!JSON.stringify(await f.api(replacementReceiptPath)).includes('Synthetic replacement participant batch'))
 delete process.env.PAYROLL_DOCUMENT_KEY;try{assert.equal((await f.api(replacementReceiptPath,replacementReceiptBody)).reused,true)}finally{process.env.PAYROLL_DOCUMENT_KEY=vault}
 server.files.set(replacementReceiptRemote,f.receipt({...replacementReceiptValues,recordedAt:'2026-09-30T12:00:00Z',ordinaryPretaxCents:500,totalCents:900}));assert.equal((await f.api(replacementReceiptPath,{...replacementReceiptBody,requestKey:randomUUID()})).summary.status,'REGRESSION')
 server.files.delete(replacementReceiptRemote);assert.equal((await f.api(replacementReceiptPath,{...replacementReceiptBody,requestKey:randomUUID()})).summary.status,'RECEIPT_NOT_FOUND')
 assert.equal((await f.api(replacementAssessmentPath)).receiptStatus,'UNVERIFIED');assert.equal((await f.api(replacementAssessmentPath)).postedCents,null)
 const receiptAutomationStart=new Date(Date.now()+360000),receiptAutomationOptions={reader:(c,r)=>readRetirementSftpReceipt(c,r,server.options),receiptNow:()=>new Date('2026-09-30T15:00:00Z')}
 assert.equal((await checkRetirementReplacementReceipts(h.pool,2,{...receiptAutomationOptions,now:receiptAutomationStart})).checked,0)
 server.files.set(replacementReceiptRemote,f.receipt(replacementReceiptValues))
 assert.equal((await checkRetirementReplacementReceipts(h.pool,1,{...receiptAutomationOptions,now:receiptAutomationStart,reader:async()=>{throw new Error('Synthetic receipt outage')}})).checked,1);assert.equal((await f.api(replacementReceiptPath)).history[0].summary.status,'RECEIPT_UNAVAILABLE')
 assert.equal((await checkRetirementReplacementReceipts(h.pool,1,{...receiptAutomationOptions,now:new Date(+receiptAutomationStart+60000)})).checked,0)
 const receiptSweeps=await Promise.all([checkRetirementReplacementReceipts(h.pool,1,{...receiptAutomationOptions,now:new Date(+receiptAutomationStart+360000)}),checkRetirementReplacementReceipts(h.pool,1,{...receiptAutomationOptions,now:new Date(+receiptAutomationStart+360000)})]);assert.equal(receiptSweeps.reduce((n,r)=>n+r.checked,0),1);assert.equal(receiptSweeps.reduce((n,r)=>n+r.posted,0),1)
 const automaticReceipt=(await f.api(replacementReceiptPath)).history[0];assert.equal(automaticReceipt.automatic,true);assert.equal(automaticReceipt.summary.status,'POSTED');assert.equal((await h.pool.query('SELECT created_by FROM payroll_retirement_replacement_receipt_observation WHERE id=$1',[automaticReceipt.id])).rows[0].created_by,null)
 assert.equal((await checkRetirementReplacementReceipts(h.pool,1,{...receiptAutomationOptions,now:new Date(+receiptAutomationStart+3600000)})).checked,0)
 server.files.delete(replacementReceiptRemote);assert.equal((await checkRetirementReplacementReceipts(h.pool,1,{...receiptAutomationOptions,now:new Date(+receiptAutomationStart+25*3600000)})).checked,1);assert.equal((await f.api(replacementReceiptPath)).history[0].summary.status,'RECEIPT_NOT_FOUND')
 await f.api(replacementBindingPath,{action:'SUSPEND',expectedRevision:3,requestKey:randomUUID(),confirmed:true,reference:'Suspend replacement receipt checks while verifying the provider path'});assert.equal((await checkRetirementReplacementReceipts(h.pool,1,{...receiptAutomationOptions,now:new Date(+receiptAutomationStart+26*3600000)})).checked,0)
 const receiptEnabled=process.env.PAYROLL_RETIREMENT_REPLACEMENT_RECEIPT_CHECKS_ENABLED;process.env.PAYROLL_RETIREMENT_REPLACEMENT_RECEIPT_CHECKS_ENABLED='false';try{assert.equal(startRetirementReplacementReceiptScheduler(h.pool),null)}finally{if(receiptEnabled===undefined)delete process.env.PAYROLL_RETIREMENT_REPLACEMENT_RECEIPT_CHECKS_ENABLED;else process.env.PAYROLL_RETIREMENT_REPLACEMENT_RECEIPT_CHECKS_ENABLED=receiptEnabled}
 const foreignReceipt=await fetch(h.url+'/api/admin/payroll'+replacementReceiptPath,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(foreignReceipt.status,404)
 await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_replacement_receipt_observation WHERE allocation_id=$1',[next.id]),/append-only/)
 assert.equal((await f.api(f.receiptPath)).history[0].summary.status,'REVERSED');assert.equal(replacementBank.posts(),1);assert.equal(server.state.created,2)
 replacementBank.missing(true);assert.equal((await f.api(fundingPath,fundingBody)).result.status,'NOT_FOUND');assert.equal(replacementBank.posts(),1)
 assert.equal((await f.api(replacementAssessmentPath)).bankStatus,'UNVERIFIED')
 assert.equal((await employeeReplacement()).items[0].contributions[0].replacement.status,'REVIEW_REQUIRED');assert.equal((await employeeReplacement()).items[0].contributions[0].replacement.postedCents,null)
 await h.pool.query("INSERT INTO payroll_retirement_replacement_observation(authorization_id,kind,source,result,created_by,automatic) VALUES($1,'BANK','RECOVERY',$2,NULL,true)",[next.id,{status:'RETURNED'}])
 replacementBank.missing(false);assert.equal((await f.api(fundingPath,fundingBody)).result.settlementStatus,'BANK_POSTED');const returnedReplacement=await f.api(replacementAssessmentPath);assert.equal(returnedReplacement.returnReviewRequired,true);assert.equal(returnedReplacement.deliveryStatus,'UNVERIFIED');assert.equal(returnedReplacement.bankStatus,'UNVERIFIED');assert.equal(returnedReplacement.postedCents,null);assert.equal((await employeeReplacement()).items[0].contributions[0].replacement.postedCents,null)
 delete process.env.PAYROLL_DOCUMENT_KEY;try{assert.equal((await f.api(fundingPath,{confirmed:true,action:'RECOVER'})).result.status,'RECOVERY_UNAVAILABLE')}finally{process.env.PAYROLL_DOCUMENT_KEY=vault}
 const foreignBank=await fetch(h.url+'/api/admin/payroll'+fundingPath,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'},body:JSON.stringify({confirmed:true,action:'RECOVER'})});assert.equal(foreignBank.status,404)
 server.files.delete(replacementTarget)
 assert.equal((await f.api(dispatchPath,dispatchBody)).result.status,'REMOTE_FILE_NOT_FOUND');assert.equal(server.state.created,2)
 delete process.env.PAYROLL_DOCUMENT_KEY
 try{assert.equal((await f.api(dispatchPath,{confirmed:true,action:'RECOVER'})).result.status,'RECOVERY_UNAVAILABLE')}finally{process.env.PAYROLL_DOCUMENT_KEY=vault}
 const fileHistory=(await f.api(authPath)).history.find(x=>x.id===next.id);assert.equal(fileHistory.file_claimed,true);assert.equal(fileHistory.file_result.status,'RECOVERY_UNAVAILABLE')
 assert.equal((await h.pool.query("SELECT count(*)::int n FROM payroll_retirement_replacement_claim WHERE authorization_id=$1 AND kind='ALLOCATION'",[next.id])).rows[0].n,1)
 await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_replacement_observation WHERE authorization_id=$1',[next.id]),/append-only/i)
 await f.api(`/retirement-replacement-authorizations/${next.id}/cancel`,cancel,'POST',409)
 await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_replacement_authorization'),/append-only/)
 await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'));assert.equal((await f.api(authPath)).history.length,2)

 assert.equal(server.state.created,2);assert.equal(provider.posts(),1);assert.equal(accounting.posts(),3)

 assert.equal((await check()).summary.status,'REVERSED')
 const employee=await f.api('/retirement-contributions',undefined,'GET',200,true);assert.equal(employee.items[0].contributions[0].status,'REVIEW_REQUIRED');assert.equal(employee.items[0].contributions[0].postedCents,null)
 assert.equal((await f.api(`/retirement-remittance-authorizations/${f.remittanceId}/assessment`)).returnReviewRequired,true)
 provider.creditValid(false);await f.api(bankPath,{action:'RECOVER',confirmed:true});const changed=await f.api(`/retirement-remittance-authorizations/${f.remittanceId}/assessment`);assert.equal(changed.reversedAllocationCents,null);assert.equal(changed.replacementReviewStatus,'EVIDENCE_REQUIRED');assert.equal((await check()).summary.status,'RECONCILIATION_REQUIRED');assert.equal(accounting.posts(),3)
 assert.equal(provider.posts(),1);assert.equal(server.state.created,2)
}))
