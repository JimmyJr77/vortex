import {runRetirementReplacementAllocationSweep,startRetirementReplacementAllocationScheduler} from '../retirementReplacementAutomation.js'
import {readFile} from 'node:fs/promises'
import {retirementReversalAccountingFixture} from '../testing/retirementReversalAccountingFixture.js'
import {employeeRetirementContributions} from '../employeeRetirementContributions.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {createRetirementSftpServer} from '../testing/retirementSftpServer.js'
import {retirementBankProvider} from '../testing/retirementBankProvider.js'
import {retirementReceiptIntakeFixture} from '../testing/retirementReceiptIntakeFixture.js'
import {readRetirementSftpReceipt,transferRetirementAllocation,verifyRetirementSftpConnection} from '../retirementSftpTransport.js'
import {decryptDocument} from '../onboarding.js'
const enabled=!!process.env.PAYROLL_TEST_DATABASE_URL
async function scenario(work,{blockWrite=false}={}){
 const old=process.env.PAYROLL_DOCUMENT_KEY,key=randomBytes(32).toString('hex');process.env.PAYROLL_DOCUMENT_KEY=key
 const server=await createRetirementSftpServer(),provider=retirementBankProvider();let qboFetcher=async()=>{throw new Error('No synthetic accounting configured')},hook=async()=>{},transferHook=async()=>{},receiptDate='2026-09-19T15:00:00Z'
 const h=await createHarness({quickbooksFetcher:(...args)=>qboFetcher(...args),paymentFetcher:provider.fetcher,remittanceNow:()=>new Date(receiptDate),retirementNow:()=>new Date('2026-09-11T12:00:00Z'),retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options),retirementAllocationTransfer:async(c,file,options)=>{await transferHook(options);return transferRetirementAllocation(c,file,{...server.options,...options,...(blockWrite?{beforeWrite:async()=>false}:{})})},retirementReceiptReader:async(c,receipt)=>{const result=await readRetirementSftpReceipt(c,receipt,server.options);await hook();return result}})
 try{const f=await retirementReceiptIntakeFixture(h,server.config),check=(requestKey=randomUUID())=>f.api(f.receiptPath,{confirmed:true,bindingId:f.bindingId,requestKey});await work({h,f,server,key,check,provider,setQbo:fetcher=>{qboFetcher=fetcher},setNow:value=>{receiptDate=value},setHook:fn=>{hook=fn},setTransferHook:fn=>{transferHook=fn}})}finally{await h.close();await server.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
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

for(const automatic of [false,true])test(`reviewed participant reversals require prior posting and a verified full bank return (${automatic?'automatic':'manual'} replacement)`,{skip:!enabled},()=>scenario(async({h,f,server,check,provider,setNow,setQbo,setTransferHook})=>{
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

 assert.equal(server.state.created,2);assert.equal(provider.posts(),1);assert.equal(accounting.posts(),2)

 assert.equal((await check()).summary.status,'REVERSED')
 const employee=await f.api('/retirement-contributions',undefined,'GET',200,true);assert.equal(employee.items[0].contributions[0].status,'REVIEW_REQUIRED');assert.equal(employee.items[0].contributions[0].postedCents,null)
 assert.equal((await f.api(`/retirement-remittance-authorizations/${f.remittanceId}/assessment`)).returnReviewRequired,true)
 provider.creditValid(false);await f.api(bankPath,{action:'RECOVER',confirmed:true});const changed=await f.api(`/retirement-remittance-authorizations/${f.remittanceId}/assessment`);assert.equal(changed.reversedAllocationCents,null);assert.equal(changed.replacementReviewStatus,'EVIDENCE_REQUIRED');assert.equal((await check()).summary.status,'RECONCILIATION_REQUIRED');assert.equal(accounting.posts(),2)
 assert.equal(provider.posts(),1);assert.equal(server.state.created,2)
}))
