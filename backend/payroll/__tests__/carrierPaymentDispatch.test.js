import {carrierNoticeReadiness,readCarrierRemittanceNotice} from '../carrierRemittanceNotice.js'
import {runCarrierInvoiceSweep} from '../carrierInvoiceAutomation.js'
import {runCarrierReconciliationSweep} from '../carrierReconciliationAutomation.js'
import {readFile} from 'node:fs/promises'
import {runCarrierSettlementSweep} from '../carrierSettlementAutomation.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {encryptDocument} from '../onboarding.js'
import {syncQuickbooksRun} from '../quickbooks.js'
test('carrier dispatch claims once, blocks cancellation and recovers a lost provider response without resending',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const key=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='27'.repeat(32);t.after(()=>{if(key===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=key})
 const journals=new Map();let hiddenDoc=null,nextId=50,creates=0,closedDate=null,bankName='Synthetic account',settlementLookupFails=false
 const fetcher=async(url,options)=>{let data
  if(url.includes('/account/'))data={Account:{Id:url.split('/').at(-1),Name:url.endsWith('/9')?bankName:'Synthetic account',Active:true,AccountType:url.endsWith('/9')?'Bank':url.endsWith('/7')?'Expense':'Other Current Liability',CurrencyRef:{value:'USD'}}}
  else if(url.endsWith('/preferences'))data={Preferences:{AccountingInfoPrefs:closedDate?{BookCloseDate:closedDate}:{},CurrencyPrefs:{HomeCurrency:{value:'USD'}}}}
  else if(url.includes('/query?')&&url.includes('VTXK-')&&settlementLookupFails)throw new Error('Synthetic settlement lookup unavailable')
  else if(url.includes('/query?')){const doc=decodeURIComponent(url).match(/DocNumber = '([^']+)'/)?.[1],row=doc===hiddenDoc?null:journals.get(doc);data={QueryResponse:{JournalEntry:row?[row]:[]}}}
  else if(options.body){const payload=JSON.parse(options.body),row={...payload,Id:String(++nextId)};journals.set(row.DocNumber,row);creates++;if(row.DocNumber.startsWith('VTXK-'))throw new Error('Synthetic lost settlement journal response');data={JournalEntry:row}}
  else data={JournalEntry:[...journals.values()].find(j=>url.endsWith('/'+j.Id))}
  return {ok:true,status:200,json:async()=>data}
 }
 let changedDestination=false,paymentWrites=0,providerOrder=null,providerMissing=false;let dispatchNow=new Date('2051-01-01T12:00:00Z')
 const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
 const paymentFetcher=async(url,options)=>{
  if(options.method==='POST'){paymentWrites++;providerOrder={...JSON.parse(options.body),id:uid(30),live_mode:false,status:'approved',reconciliation_status:'unreconciled',transaction_ids:[]};throw new Error('Synthetic lost carrier response')}
  if(url.includes('/transactions/'))return {ok:true,status:200,json:async()=>({id:uid(40),live_mode:false,internal_account_id:uid(2),currency:'USD',direction:'debit',posted:true,as_of_date:'2026-09-18',amount:25000})}
  if(url.includes('/transaction_line_items?'))return {ok:true,status:200,json:async()=>[{id:uid(41),transaction_id:uid(40),transactable_type:'payment_order',transactable_id:uid(30),live_mode:false,type:'originating',amount:25000}]}
  if(url.includes('/payment_orders/'))return {ok:!!providerOrder&&!providerMissing,status:providerOrder&&!providerMissing?200:404,json:async()=>providerOrder}
  return {ok:true,status:200,json:async()=>url.includes('/internal_accounts/')?{id:uid(2),currency:'USD',live_mode:false}:{id:uid(3),counterparty_id:uid(4),party_type:'business',party_name:'Synthetic Benefits LLC',account_type:'checking',live_mode:false,verification_status:'verified',updated_at:changedDestination?'2026-09-11T12:01:00Z':'2026-09-11T12:00:00Z',account_details:[{id:uid(5),account_number_safe:'1234'}],routing_details:[{id:uid(6),payment_type:'ach',routing_number_type:'aba',routing_number:'021000021'}]}}
 }

 const h=await createHarness({quickbooksFetcher:fetcher,paymentFetcher,payrollNow:()=>dispatchNow});t.after(()=>h.close());const {api,periods}=await monthlyBenefitsFixture(h)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-INVOICE-CORRECTION'})
 const accounts={wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6'},tokens=encryptDocument(Buffer.from(JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expiresAt:Date.now()+3600000})),'quickbooks:1')
 await h.pool.query("INSERT INTO payroll_quickbooks_connection(facility_id,realm_id,environment,account_ids,encrypted_tokens) VALUES(1,'123','sandbox',$1,$2)",[accounts,tokens]);await syncQuickbooksRun(h.pool,1,run.id,{fetcher})
 const path='/benefit-carrier-invoices',source=(await api(`${path}?month=2026-09`)).source
 const body={month:'2026-09',carrier:'Synthetic Health',invoiceNumber:'CORRECT-SEP',invoiceDate:'2026-09-01',dueDate:'2026-09-30',amountCents:57500,reference:'Synthetic carrier invoice reference',reconciliation:'Matched coverage and retained employee contribution',confirmed:true,fingerprint:source.fingerprint,allocation:{employerExpenseCents:45000,employeeContributionCents:12500,confirmed:true,reference:'Verified retained payroll contribution',contributions:[{key:source.contributions[0].key,amountCents:12500}]}}
 const invoice=await api(path,body),selected={prepareJournal:true,expenseAccountId:'7',carrierAccountId:'8'},preview=(await api(`${path}/${invoice.id}/accounting-check`,selected)).premiumPreview
 const a=await api(`${path}/${invoice.id}/premium-authorizations`,{...selected,confirmed:true,reference:'Reviewed original premium journal',requestKey:'original-correction-premium-request',fingerprint:preview.fingerprint});await api(`/carrier-premium-authorizations/${a.id}/post`,{confirmed:true})

 const paymentPath=`${path}/${invoice.id}/payment-preview`,payment={amountCents:57500,paymentDate:'2026-09-18'}
 await api(paymentPath,payment,'POST',409)
 const conn=await api('/payment-connection',{organizationId:uid(1),originatingAccountId:uid(2),apiKey:'synthetic-private-key',mode:'TEST',reference:'Reviewed employer funding',expectedRevision:0,confirmed:true},'POST',201)
 const payeeBody={carrier:'Synthetic Health',accountId:uid(3),connectionRevision:conn.revision},p=await api('/carrier-payees/preview',payeeBody)
 await api('/carrier-payees',{...payeeBody,previousId:p.previousId,fingerprint:p.fingerprint,confirmed:true,reference:'Independently verified carrier instructions'})
 const ready=await api(paymentPath,payment)
 assert.equal(ready.status,'PREVIEW_ONLY');assert.equal(ready.premiumJournalId,'52');assert.equal(ready.destination.accountLast4,'1234');assert.equal(ready.amountCents,57500);assert.equal(ready.liabilityAccount.id,'8');assert.equal(JSON.stringify(ready).includes(uid(3)),false)
 for(const patch of [{amountCents:57501},{amountCents:0},{amountCents:0.5},{paymentDate:'2026-02-30'}])await api(paymentPath,{...payment,...patch},'POST',400)
 await api(paymentPath,{...payment,paymentDate:'2026-08-31'},'POST',409)
 assert.notEqual((await api(paymentPath,{...payment,amountCents:25000})).fingerprint,ready.fingerprint)
 assert.equal((await api(paymentPath,payment)).fingerprint,ready.fingerprint)
 changedDestination=true;await api(paymentPath,payment,'POST',409);changedDestination=false
 hiddenDoc=preview.payload.DocNumber;await api(paymentPath,payment,'POST',409);hiddenDoc=null
 const original=journals.get(preview.payload.DocNumber);journals.set(preview.payload.DocNumber,{...original,Id:'999'});await api(paymentPath,payment,'POST',409);journals.set(preview.payload.DocNumber,original)
 const headers={Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'}
 assert.equal((await fetch(`${h.url}/api/admin/payroll${paymentPath}`,{method:'POST',headers,body:JSON.stringify(payment)})).status,404)

 const authPath=`${path}/${invoice.id}/payment-authorizations`,partial=await api(paymentPath,{...payment,amountCents:25000}),authorization=await api(authPath,{...payment,amountCents:25000,confirmed:true,outsideActivityReviewed:true,reference:'Reviewed carrier payment with no outside activity',requestKey:'carrier-dispatch-authorization',fingerprint:partial.fingerprint})
 const remainder=await api(paymentPath,{...payment,amountCents:32500});await api(authPath,{...payment,amountCents:32500,confirmed:true,outsideActivityReviewed:true,reference:'Separate remaining carrier payment authorization',requestKey:'carrier-remainder-authorization',fingerprint:remainder.fingerprint})
 const dispatchPath=`/carrier-payment-authorizations/${authorization.id}/dispatch`,submit={action:'SUBMIT',confirmed:true}
 await api(dispatchPath,{action:'RECOVER',confirmed:true},'POST',409)
 await api(dispatchPath,submit,'POST',409);assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_payment_claim')).rowCount,0)
 dispatchNow=new Date('2026-09-17T12:00:00Z')
 changedDestination=true;await api(dispatchPath,submit,'POST',409);changedDestination=false
 assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_payment_claim')).rowCount,0)
 assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_payment_receipt')).rowCount,0)
 const sent=await api(dispatchPath,submit);assert.equal(sent.result.status,'UNCERTAIN');assert.equal(paymentWrites,1)
 const claim=(await h.pool.query('SELECT * FROM payroll_carrier_payment_claim')).rows[0];assert.equal(claim.encrypted_instruction.includes(Buffer.from(uid(3))),false)
 const cancel={confirmed:true,reference:'Attempt cancel after dispatch claim'}
 await api(`/carrier-payment-authorizations/${authorization.id}/cancel`,cancel,'POST',409)
 await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_payment_cancellation(authorization_id,reference,created_by) VALUES($1,$2,99)',[authorization.id,cancel.reference]),/requires provider recovery/)
 const recovered=await Promise.all([api(dispatchPath,submit),api(dispatchPath,{action:'RECOVER',confirmed:true})]);assert.ok(recovered.every(r=>r.recovery&&r.result.status==='PROVIDER_APPROVED'));assert.equal(paymentWrites,1)
 providerMissing=true;assert.equal((await api(dispatchPath,{action:'RECOVER',confirmed:true})).result.status,'NOT_FOUND');assert.equal(paymentWrites,1);providerMissing=false
 await api(`/carrier-payment-authorizations/${authorization.id}/settlement-preview`,{},'POST',409)
 const replacement=await api('/payment-connection',{organizationId:uid(1),originatingAccountId:uid(2),apiKey:'new-synthetic-private-key',mode:'TEST',reference:'New employer credential after claimed payment',expectedRevision:conn.revision,confirmed:true},'POST',201);assert.ok(replacement.revision>conn.revision)
 assert.equal((await api(dispatchPath,{action:'RECOVER',confirmed:true})).result.status,'PROVIDER_APPROVED');assert.equal(paymentWrites,1)
 providerOrder={...providerOrder,status:'completed',reconciliation_status:'reconciled',transaction_ids:[uid(40)]};dispatchNow=new Date('2026-09-21T12:00:00Z')
 const settled=await api(dispatchPath,{action:'RECOVER',confirmed:true});assert.equal(settled.result.settlementStatus,'BANK_POSTED');assert.equal(settled.result.settlementEvidence[0].amountCents,25000);assert.equal(paymentWrites,1)
 const settlementPath=`/carrier-payment-authorizations/${authorization.id}/settlement-preview`
 await api(settlementPath,{},'POST',409)
 const mappingPath='/quickbooks/carrier-settlement-mapping',mappingState=await api(mappingPath)
 await api(mappingPath,{confirmed:true,expectedRevision:mappingState.revision,fundingRevisionId:conn.revision,connectionGeneration:mappingState.connection.generation,realmId:'123',environment:'sandbox',bankAccountId:'9',liabilityAccountId:'8',reference:'Reviewed historical funding and premium liability'},'POST',201)
 const count=creates,settlement=await api(settlementPath,{})
 assert.equal(settlement.status,'PREVIEW_ONLY');assert.equal(settlement.amountCents,25000);assert.equal(settlement.journals.length,1);assert.equal(settlement.journals[0].payload.TxnDate,'2026-09-18');assert.equal(settlement.journals[0].payload.Line[0].JournalEntryLineDetail.AccountRef.value,'8');assert.equal(settlement.journals[0].payload.Line[1].JournalEntryLineDetail.AccountRef.value,'9')
 assert.equal((await api(settlementPath,{})).fingerprint,settlement.fingerprint)
 const settlementAuthPath=`/carrier-payment-authorizations/${authorization.id}/settlement-authorizations`,settlementBody={confirmed:true,autoPost:true,fingerprint:settlement.fingerprint,requestKey:'carrier-settlement-review-key',reference:'Reviewed bank allocations and authorized automatic posting'}
 await api(settlementAuthPath,{...settlementBody,autoPost:false},'POST',400)
 await api(settlementAuthPath,{...settlementBody,fingerprint:'a'.repeat(64)},'POST',409)
 const authorizations=await Promise.all([api(settlementAuthPath,settlementBody),api(settlementAuthPath,settlementBody)]);assert.equal(authorizations[0].id,authorizations[1].id);assert.equal(authorizations.filter(a=>a.reused).length,1)
 await api(settlementAuthPath,{...settlementBody,requestKey:'competing-settlement-review-key'},'POST',409)
 await api(settlementAuthPath,{...settlementBody,reference:'Changed reused settlement reference'},'POST',409)
 const settlementId=authorizations[0].id,cancelSettlement=`/carrier-settlement-authorizations/${settlementId}/cancel`,cancelBody={confirmed:true,reference:'Cancel settlement review before journal posting'}
 await api(cancelSettlement,cancelBody);assert.equal((await api(cancelSettlement,cancelBody)).reused,true)
 await api(settlementAuthPath,settlementBody,'POST',409)
 await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_settlement_claim(authorization_id) VALUES($1)',[settlementId]),/Cancelled carrier settlement/)
 let renewed=await api(settlementAuthPath,{...settlementBody,requestKey:'renewed-carrier-settlement-key'})
 assert.equal((await api(settlementAuthPath)).history.length,2)
 let postSettlement=`/carrier-settlement-authorizations/${renewed.id}/post`
 await api(postSettlement,{confirmed:true,action:'RECOVER'},'POST',409)
 bankName='Changed before posting';const blockedSweep=await runCarrierSettlementSweep(h.pool,{facility:1,fetcher,paymentFetcher,now:new Date()});assert.equal(blockedSweep.attempted,1);assert.equal(blockedSweep.synced,0);assert.equal((await h.pool.query("SELECT * FROM payroll_alert WHERE dedupe_key=$1 AND status='OPEN'",[`carrier-settlement-${renewed.id}`])).rowCount,1);await api(postSettlement,{confirmed:true,action:'POST'},'POST',409);bankName='Synthetic account'
 assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_settlement_claim')).rowCount,0)
 settlementLookupFails=true;const unsent=await api(postSettlement,{confirmed:true,action:'POST'});assert.equal(unsent.results[0].status,'UNCERTAIN');assert.equal(creates,count)
 assert.equal((await api(settlementAuthPath)).history.find(a=>a.id===renewed.id).can_release,true)
 const releasePath=`/carrier-settlement-authorizations/${renewed.id}/release-unsent`,releaseBody={confirmed:true,reference:'Cancel proven-unsent settlement after unavailable lookup'}
 await api(releasePath,releaseBody,'POST',409);settlementLookupFails=false
 const releaseResults=await Promise.all([api(releasePath,releaseBody),api(releasePath,releaseBody)]);assert.equal(releaseResults.filter(r=>r.reused).length,1)
 await api(postSettlement,{confirmed:true,action:'POST'},'POST',409)
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_settlement_release'),/append-only/)
 renewed=await api(settlementAuthPath,{...settlementBody,requestKey:'fresh-after-unsent-settlement-release'});postSettlement=`/carrier-settlement-authorizations/${renewed.id}/post`
 const outcomes=await Promise.all([api(postSettlement,{confirmed:true,action:'POST'}),api(postSettlement,{confirmed:true,action:'POST'})])
 assert.equal(outcomes.filter(r=>r.recovery).length,1);assert.equal(outcomes.find(r=>!r.recovery).results[0].status,'UNCERTAIN');assert.equal(outcomes.find(r=>r.recovery).status,'SYNCED');assert.equal(creates,count+1)
 assert.equal((await api(settlementAuthPath)).history.find(a=>a.id===renewed.id).can_release,false)
 await api(`/carrier-settlement-authorizations/${renewed.id}/release-unsent`,releaseBody,'POST',409)
 await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_settlement_journal(id,authorization_id,facility_id,realm_id,environment,event_key,payload) SELECT gen_random_uuid(),authorization_id,facility_id,realm_id,environment,event_key,payload FROM payroll_carrier_settlement_journal WHERE authorization_id=$1',[renewed.id]),/unreleased journal claim/)
 await assert.rejects(h.pool.query("INSERT INTO payroll_carrier_settlement_release(authorization_id,evidence,reference,created_by) VALUES($1,'[]',$2,99)",[renewed.id,releaseBody.reference]),/Every retained settlement journal/)
 const settlementDoc=settlement.journals[0].payload.DocNumber
 hiddenDoc=settlementDoc;assert.equal((await api(postSettlement,{confirmed:true,action:'RECOVER'})).results[0].status,'NOT_FOUND');hiddenDoc=null
 assert.equal((await api(postSettlement,{confirmed:true,action:'RECOVER'})).status,'SYNCED')
 const sweepNow=new Date(Date.now()+6*60000),sweeps=await Promise.all([runCarrierSettlementSweep(h.pool,{facility:1,fetcher,paymentFetcher,now:sweepNow}),runCarrierSettlementSweep(h.pool,{facility:1,fetcher,paymentFetcher,now:sweepNow})]);assert.equal(sweeps.reduce((n,s)=>n+s.attempted,0),1)
 assert.equal((await runCarrierSettlementSweep(h.pool,{facility:1,fetcher,paymentFetcher,now:sweepNow})).attempted,0)
 assert.equal((await runCarrierSettlementSweep(h.pool,{facility:2,fetcher,paymentFetcher,now:new Date(Date.now()+2*86400000)})).attempted,0)
 hiddenDoc=settlementDoc;const recheck=await runCarrierSettlementSweep(h.pool,{facility:1,fetcher,paymentFetcher,now:new Date(Date.now()+2*86400000)});assert.equal(recheck.attempted,1);assert.equal(recheck.synced,0);hiddenDoc=null
 assert.equal((await runCarrierSettlementSweep(h.pool,{facility:1,fetcher,paymentFetcher,now:new Date(Date.now()+2*86400000+6*60000)})).synced,1)
 assert.equal(creates,count+1)
 const journalHistory=(await api(settlementAuthPath)).history.find(r=>r.id===renewed.id);assert.equal(journalHistory.journals[0].result.status,'SYNCED')
 assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_settlement_event_reservation')).rowCount,1)
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_settlement_event_reservation'),/retained unsent cancellation/)
 await assert.rejects(h.pool.query('UPDATE payroll_carrier_settlement_event_reservation SET realm_id=realm_id'),/cannot be reassigned/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_settlement_journal'),/append-only/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_settlement_observation'),/append-only/)

 await api(`/carrier-settlement-authorizations/${renewed.id}/cancel`,cancelBody,'POST',409)
 await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_settlement_cancellation(authorization_id,reference,created_by) VALUES($1,$2,99)',[renewed.id,cancelBody.reference]),/requires recovery/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_settlement_authorization'),/append-only/)
 assert.equal((await fetch(`${h.url}/api/admin/payroll${settlementAuthPath}`,{headers})).status,404)
 closedDate='2026-09-18';await api(settlementPath,{},'POST',409);closedDate=null
 bankName='Changed remote bank';await api(settlementPath,{},'POST',409);bankName='Synthetic account'
 hiddenDoc=preview.payload.DocNumber;await api(settlementPath,{},'POST',409);hiddenDoc=null
 providerMissing=true;await api(settlementPath,{},'POST',409);providerMissing=false
 providerOrder={...providerOrder,status:'approved',reconciliation_status:'unreconciled',transaction_ids:[]};await api(settlementPath,{},'POST',409)
 providerOrder={...providerOrder,status:'completed',reconciliation_status:'reconciled',transaction_ids:[uid(40)]}
 await h.pool.query('UPDATE payroll_settings SET quickbooks_connection_generation=quickbooks_connection_generation+1 WHERE facility_id=1');await api(settlementPath,{},'POST',409)
 assert.equal((await fetch(`${h.url}/api/admin/payroll${settlementPath}`,{method:'POST',headers,body:'{}'})).status,404)
 assert.equal(creates,count+1);assert.equal(paymentWrites,1)
 const receiptPath=`/carrier-payment-authorizations/${authorization.id}/receipt`,receipt=await api(receiptPath)
 assert.equal(receipt.status,'BANK_CONFIRMED');assert.equal(receipt.amountCents,25000);assert.equal(receipt.destination.accountLast4,'1234');assert.equal(receipt.bankWithdrawals[0].postedDate,'2026-09-18');assert.equal(receipt.mode,'TEST');assert.equal(receipt.sourceResult,undefined)
 const advicePath=`/carrier-payment-authorizations/${authorization.id}/remittance-advice`,advice=await api(advicePath)
 assert.match(advice.text,/\$250.00/);assert.match(advice.subject,/^TEST/);assert.equal(advice.text.includes('1234'),false)
 const adviceDownload=await fetch(`${h.url}/api/admin/payroll${advicePath}/download?fingerprint=${advice.fingerprint}`,{headers:{Authorization:'Bearer payroll-test-admin'}})
 assert.equal(adviceDownload.status,200);assert.equal(adviceDownload.headers.get('cache-control'),'no-store');assert.match(adviceDownload.headers.get('content-security-policy'),/sandbox/);assert.match(await adviceDownload.text(),/Carrier remittance advice/)
 await api(`${advicePath}/download`,undefined,'GET',409)
 assert.equal((await fetch(`${h.url}/api/admin/payroll${advicePath}`,{headers})).status,404)
 assert.equal((await fetch(`${h.url}/api/admin/payroll${advicePath}`)).status,401)
 assert.equal(paymentWrites,1)
 const noticePath=`/carrier-payment-authorizations/${authorization.id}/remittance-notices`,recipientPath=`/benefit-carrier-invoices/${receipt.invoiceId}/remittance-recipient`
 await api(`${noticePath}/preview`,{},'POST',409)
 const recipientBody={action:'REVIEW',expectedRevision:0,requestKey:uid(801),confirmed:true,name:'Carrier receivables team',email:'carrier@example.com',reference:'Independent carrier contact confirmation for this invoice'}
 await api(recipientPath,recipientBody)
 const oldNoticePreview=await api(`${noticePath}/preview`,{})
 await api(recipientPath,{...recipientBody,expectedRevision:1,requestKey:uid(802),email:'newcarrier@example.com'})
 await api(noticePath,{confirmed:true,reference:'Reviewed exact notice and carrier destination for delivery',requestKey:uid(803),fingerprint:oldNoticePreview.fingerprint},'POST',409)
 const noticePreview=await api(`${noticePath}/preview`,{}),noticeBody={confirmed:true,reference:'Reviewed exact notice and carrier destination for delivery',requestKey:uid(804),fingerprint:noticePreview.fingerprint},notice=await api(noticePath,noticeBody)
 assert.equal((await api(noticePath,noticeBody)).reused,true);await api(noticePath,{...noticeBody,reference:'A changed review reference for the same request'},'POST',409)
 assert.equal((await api(noticePath)).history[0].status,'AUTHORIZED');assert.equal((await api(noticePath)).deliveryEnabled,false)
 const noticeRow=(await h.pool.query('SELECT * FROM payroll_carrier_remittance_notice WHERE id=$1',[notice.id])).rows[0]
 assert.equal(noticeRow.encrypted_notice.toString().includes('newcarrier@example.com'),false);assert.equal(readCarrierRemittanceNotice(noticeRow).advice.text,noticePreview.advice.text);assert.throws(()=>readCarrierRemittanceNotice({...noticeRow,content_sha256:'0'.repeat(64)}))
 // Routine bank observation refresh preserves the already reviewed notice text.
 await api(dispatchPath,{action:'RECOVER',confirmed:true});assert.equal((await carrierNoticeReadiness(h.pool,noticeRow)).ready,true)
 await api(recipientPath,{...recipientBody,action:'REVOKE',expectedRevision:2,requestKey:uid(805)})
 assert.equal((await api(noticePath)).history[0].status,'BLOCKED');await api(`${noticePath}/preview`,{},'POST',409)
 const cancellationBody={confirmed:true,reference:'Cancel notice after carrier recipient revocation'}
 await api(`${noticePath}/${notice.id}/cancel`,cancellationBody);assert.equal((await api(`${noticePath}/${notice.id}/cancel`,cancellationBody)).reused,true)
 await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_remittance_claim(notice_id,dispatch_key) VALUES($1,$2)',[notice.id,uid(806)]),/Cancelled remittance notices/)
 await api(recipientPath,{...recipientBody,expectedRevision:3,requestKey:uid(807)})
 const replacementPreview=await api(`${noticePath}/preview`,{}),replacementBody={...noticeBody,fingerprint:replacementPreview.fingerprint,requestKey:uid(808)}
 const attempts=await Promise.allSettled([api(noticePath,replacementBody),api(noticePath,{...replacementBody,requestKey:uid(809)})]);assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1)
 const replacementNotice=(await api(noticePath)).history.find(n=>n.status==='AUTHORIZED');assert.ok(replacementNotice)
 await h.pool.query('INSERT INTO payroll_carrier_remittance_claim(notice_id,dispatch_key) VALUES($1,$2)',[replacementNotice.id,uid(810)])
 await api(`${noticePath}/${replacementNotice.id}/cancel`,cancellationBody,'POST',409)
 await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_remittance_cancellation(notice_id,reference,created_by) VALUES($1,$2,99)',[replacementNotice.id,'Invalid cancellation after claim']),/Claimed remittance notices/)
 for(const table of ['payroll_carrier_remittance_notice','payroll_carrier_remittance_cancellation','payroll_carrier_remittance_claim'])await assert.rejects(h.pool.query(`DELETE FROM ${table}`),/append-only/)
 assert.equal((await fetch(`${h.url}/api/admin/payroll${noticePath}`,{headers})).status,404);assert.equal((await fetch(`${h.url}/api/admin/payroll${noticePath}`)).status,401)
 assert.equal((await fetch(`${h.url}/api/admin/payroll${noticePath}/${notice.id}/cancel`,{method:'POST',headers,body:JSON.stringify(cancellationBody)})).status,404)
 assert.equal(paymentWrites,1)
 const applicationPath=`/carrier-payment-authorizations/${authorization.id}/application`,applicationState=await api(applicationPath)
 assert.equal(applicationState.earliestBankDate,receipt.bankWithdrawals[0].postedDate)
 const applicationBody={kind:'REVIEW',confirmed:true,expectedRevision:0,requestKey:'carrier-application-first-review',receiptFingerprint:applicationState.receiptFingerprint,applicationDate:'2026-09-18',appliedCents:10000,documentIds:[],reference:'Carrier statement shows partial application and remaining unapplied funds'}
 await api(applicationPath,{...applicationBody,appliedCents:25001},'POST',400);await api(applicationPath,{...applicationBody,applicationDate:'2026-09-22'},'POST',400);await api(applicationPath,{...applicationBody,documentIds:[uid(99)]},'POST',409)
 const applications=await Promise.all([api(applicationPath,applicationBody),api(applicationPath,applicationBody)]);assert.equal(applications[0].id,applications[1].id)
 assert.equal((await api(applicationPath)).status,'PARTIALLY_APPLIED');assert.equal((await api(applicationPath)).history[0].details.unappliedCents,15000)
 await api(applicationPath,{...applicationBody,requestKey:'stale-carrier-application-key'},'POST',409)
 const fullApplication=await api(applicationPath,{...applicationBody,expectedRevision:applications[0].id,requestKey:'carrier-application-full-review',appliedCents:25000,reference:'Carrier confirms full invoice application after resolving unapplied funds'})
 assert.equal((await api(applicationPath)).status,'FULLY_APPLIED')
 assert.equal((await api(applicationPath)).reconciliation.status,'OPEN')
 await h.pool.query('UPDATE payroll_settings SET quickbooks_connection_generation=quickbooks_connection_generation-1 WHERE facility_id=1')
 assert.equal((await api(applicationPath)).reconciliation.status,'RECONCILED')
 const invoiceBalance=(await api(authPath)).invoiceBalance;assert.equal(invoiceBalance.status,'OPEN');assert.equal(invoiceBalance.invoiceAmountCents,57500);assert.equal(invoiceBalance.authorizedCents,57500);assert.equal(invoiceBalance.bankConfirmedCents,25000);assert.equal(invoiceBalance.appliedCents,25000);assert.equal(invoiceBalance.reconciledCents,25000);assert.equal(invoiceBalance.remainingToApplyCents,32500);assert.equal(invoiceBalance.unreservedCents,0)
 const invoiceNow=new Date('2026-09-12T12:00:00Z'),invoiceSweeps=await Promise.all([runCarrierInvoiceSweep(h.pool,{facility:1,now:invoiceNow}),runCarrierInvoiceSweep(h.pool,{facility:1,now:invoiceNow})]);assert.equal(invoiceSweeps.reduce((n,r)=>n+r.attempted,0),1)
 assert.equal((await api(authPath)).invoiceBalance.assessmentHistory[0].assessment.status,'OPEN')
 assert.equal((await h.pool.query("SELECT * FROM payroll_alert WHERE dedupe_key=$1 AND status='OPEN'",[`carrier-invoice-${invoice.id}`])).rowCount,0)
 assert.equal((await runCarrierInvoiceSweep(h.pool,{facility:1,now:new Date(+invoiceNow+300001)})).changed,0)
 assert.equal((await api(authPath)).invoiceBalance.assessmentHistory.length,1)
 assert.equal((await runCarrierInvoiceSweep(h.pool,{facility:2,now:invoiceNow})).attempted,0)
 assert.equal((await runCarrierInvoiceSweep(h.pool,{facility:1,now:new Date('2026-10-01T12:00:00Z')})).changed,0)
 assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key=$1",[`carrier-invoice-${invoice.id}`])).rows[0].status,'OPEN')
 await assert.rejects(h.pool.query("INSERT INTO payroll_carrier_invoice_assessment(invoice_id,facility_id,previous_id,fingerprint,assessment) SELECT invoice_id,facility_id,id,fingerprint,jsonb_set(assessment,'{status}','\"RECONCILED\"') FROM payroll_carrier_invoice_assessment ORDER BY id DESC LIMIT 1"),/exact full payment evidence/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_invoice_assessment'),/append-only/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_invoice_check'),/append-only/)
 await assert.rejects(h.pool.query("INSERT INTO payroll_carrier_invoice_check(invoice_id,facility_id,status,message) VALUES($1,2,'FAILED','Invalid scope')",[invoice.id]),/scoped invoice/)
 const reconciliationNow=new Date(Date.now()+86400000),reconciliationSweeps=await Promise.all([runCarrierReconciliationSweep(h.pool,{facility:1,now:reconciliationNow}),runCarrierReconciliationSweep(h.pool,{facility:1,now:reconciliationNow})]);assert.equal(reconciliationSweeps.reduce((n,r)=>n+r.attempted,0),1)
 assert.equal((await api(applicationPath)).reconciliationHistory[0].assessment.status,'RECONCILED')
 assert.equal((await runCarrierReconciliationSweep(h.pool,{facility:1,now:new Date(+reconciliationNow+300001)})).changed,0)
 assert.equal((await api(applicationPath)).reconciliationHistory.length,1)
 assert.equal((await runCarrierReconciliationSweep(h.pool,{facility:2,now:new Date(+reconciliationNow+600001)})).attempted,0)
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_reconciliation_assessment'),/append-only/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_reconciliation_check'),/append-only/)
 hiddenDoc=settlementDoc;await api(postSettlement,{confirmed:true,action:'RECOVER'});assert.equal((await api(applicationPath)).reconciliation.status,'OPEN');hiddenDoc=null
 await api(postSettlement,{confirmed:true,action:'RECOVER'});assert.equal((await api(applicationPath)).reconciliation.status,'RECONCILED')
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_application'),/append-only/)
 assert.equal((await fetch(`${h.url}/api/admin/payroll${applicationPath}`,{headers})).status,404)
 const retainedReceipt=(await h.pool.query('SELECT * FROM payroll_carrier_payment_receipt')).rows[0]
 await api(dispatchPath,{action:'RECOVER',confirmed:true});assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_payment_receipt')).rowCount,1)
 providerOrder={...providerOrder,status:'returned',reconciliation_status:'unreconciled',transaction_ids:[]};await api(dispatchPath,{action:'RECOVER',confirmed:true})
 assert.equal((await api(applicationPath)).status,'NEEDS_REVIEW');assert.equal((await api(applicationPath)).reconciliation.status,'OPEN')
 assert.equal((await runCarrierReconciliationSweep(h.pool,{facility:1,now:new Date(+reconciliationNow+600002)})).changed,1)
 assert.equal((await api(applicationPath)).reconciliationHistory[0].assessment.status,'OPEN')
 await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_reconciliation_check(assessment_id) SELECT id FROM payroll_carrier_reconciliation_assessment ORDER BY id LIMIT 1'),/latest assessment/)
 await assert.rejects(h.pool.query("INSERT INTO payroll_carrier_reconciliation_assessment(payment_authorization_id,facility_id,fingerprint,assessment) SELECT payment_authorization_id,2,fingerprint,assessment FROM payroll_carrier_reconciliation_assessment ORDER BY id DESC LIMIT 1"),/scoped payment/)
 assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1",[`carrier-reconciliation-${authorization.id}`])).rows[0].status,'OPEN')
 await api(applicationPath,{...applicationBody,expectedRevision:fullApplication.id,requestKey:'changed-bank-application-review'},'POST',409)
 await api(applicationPath,{kind:'RETRACT',confirmed:true,expectedRevision:fullApplication.id,requestKey:'carrier-application-retracted-review',reference:'Retract carrier application after later bank return evidence'})
 assert.equal((await api(applicationPath)).status,'RETRACTED');assert.equal((await api(applicationPath)).history.length,3)
 await api(advicePath,undefined,'GET',409);await api(`${advicePath}/download?fingerprint=${advice.fingerprint}`,undefined,'GET',409)
 assert.equal((await carrierNoticeReadiness(h.pool,(await h.pool.query('SELECT * FROM payroll_carrier_remittance_notice WHERE id=$1',[replacementNotice.id])).rows[0])).ready,false)
 const changedReceipt=await api(receiptPath);assert.equal(changedReceipt.status,'NEEDS_REVIEW');assert.equal(changedReceipt.amountCents,25000);assert.equal(changedReceipt.createdAt,receipt.createdAt)
 const download=await fetch(`${h.url}/api/admin/payroll${receiptPath}/download`,{headers:{Authorization:'Bearer payroll-test-admin'}});assert.equal(download.status,200);assert.match(download.headers.get('content-security-policy'),/sandbox/);const html=await download.text();assert.match(html,/Needs review/);assert.match(html,/Test — synthetic funds/);assert.equal(html.includes('synthetic-private-key'),false)
 assert.equal((await fetch(`${h.url}/api/admin/payroll${receiptPath}`,{headers})).status,404)
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_payment_receipt'),/append-only/)
 assert.deepEqual((await h.pool.query('SELECT receipt FROM payroll_carrier_payment_receipt')).rows[0].receipt,retainedReceipt.receipt)
 providerOrder={...providerOrder,status:'completed',reconciliation_status:'reconciled',transaction_ids:[uid(40)]};await api(dispatchPath,{action:'RECOVER',confirmed:true});assert.equal((await api(receiptPath)).status,'BANK_CONFIRMED')
 await api(applicationPath,{...applicationBody,expectedRevision:(await api(applicationPath)).revision,requestKey:'renew-after-return-application',appliedCents:25000})
 assert.equal((await runCarrierReconciliationSweep(h.pool,{facility:1,now:new Date(+reconciliationNow+900003)})).changed,1)
 assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1",[`carrier-reconciliation-${authorization.id}`])).rows[0].status,'DISMISSED')
 const hist=await api(authPath),retained=hist.history.find(r=>r.id===authorization.id);assert.equal(retained.claimed,true);assert.equal(retained.result.status,'COMPLETED');assert.equal(hist.availableCents,0)
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_payment_claim'),/append-only/);await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_payment_observation'),/append-only/)
 assert.equal((await fetch(`${h.url}/api/admin/payroll${dispatchPath}`,{method:'POST',headers,body:JSON.stringify(submit)})).status,404)
 // Simulate enabling receipt retention for an existing settled/returned payment.
 await h.pool.query('DROP TABLE payroll_carrier_payment_receipt')
 await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'))
 assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_payment_receipt')).rowCount,0)
 providerOrder={...providerOrder,status:'returned',reconciliation_status:'unreconciled',transaction_ids:[]};await api(dispatchPath,{action:'RECOVER',confirmed:true})
 const historicalReceipt=await api(receiptPath);assert.equal(historicalReceipt.status,'NEEDS_REVIEW');assert.equal(historicalReceipt.sourceObservationId,receipt.sourceObservationId);assert.equal(historicalReceipt.amountCents,receipt.amountCents)

 assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_settlement_event_reservation')).rowCount,1)
 assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_settlement_release')).rowCount,1)
 // Inject a one-time retention failure and a second scoped payment candidate to
 // prove failure isolation separately from the receipted-payment selection SQL.
 const otherPayment=hist.history.find(r=>r.id!==authorization.id).id
 let failRetention=true
 const failurePool={query:async(...args)=>{const result=await h.pool.query(...args);if(args[0].startsWith('SELECT r.authorization_id AS id'))return {...result,rows:[...result.rows,{id:otherPayment,facility_id:1}]};return result},connect:async()=>{const client=await h.pool.connect();return {query:async(...args)=>{if(failRetention&&args[0].startsWith('INSERT INTO payroll_carrier_reconciliation_check')){failRetention=false;throw new Error('Synthetic secret that must not enter alerts')}return client.query(...args)},release:(...args)=>client.release(...args)}}}
 const failureNow=new Date(+reconciliationNow+1200004),beforeFailure=(await api(applicationPath)).reconciliationHistory
 assert.deepEqual(await runCarrierReconciliationSweep(failurePool,{facility:1,now:failureNow}),{attempted:2,changed:1,failed:1})
 const failedState=await api(applicationPath);assert.equal(failedState.reconciliationCheckFailed,true);assert.equal((await api(authPath)).invoiceBalance.reconciledCents,0);assert.deepEqual(failedState.reconciliationHistory,beforeFailure);assert.equal(failedState.reconciliationFailures.length,1);assert.equal(JSON.stringify(failedState.reconciliationFailures).includes('Synthetic secret'),false)
 assert.equal((await h.pool.query('SELECT count(*) FROM payroll_carrier_reconciliation_assessment WHERE payment_authorization_id=$1',[otherPayment])).rows[0].count,'1')
 assert.equal((await runCarrierReconciliationSweep(h.pool,{facility:1,now:failureNow})).attempted,0)
 assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key=$1",[`carrier-reconciliation-check-${authorization.id}`])).rows[0].status,'OPEN')
 assert.equal((await runCarrierReconciliationSweep(h.pool,{facility:1,now:new Date(+failureNow+300001)})).failed,0)
 assert.equal((await api(applicationPath)).reconciliationCheckFailed,false);assert.equal((await api(applicationPath)).reconciliationFailures.length,1)
 assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key=$1",[`carrier-reconciliation-check-${authorization.id}`])).rows[0].status,'DISMISSED')

 // A lost commit response can leave a successful check and a failure at the
 // same scheduled timestamp. Keep recovery visible until a later known check.
 let lostCommit=true
 const uncertainPool={query:(...args)=>h.pool.query(...args),connect:async()=>{const client=await h.pool.connect();return {query:async(...args)=>{const result=await client.query(...args);if(lostCommit&&args[0]==='COMMIT'){lostCommit=false;throw new Error('Synthetic lost commit response')}return result},release:(...args)=>client.release(...args)}}}
 assert.equal((await runCarrierReconciliationSweep(uncertainPool,{facility:1,now:new Date(+failureNow+600002)})).failed,1)
 assert.equal((await api(applicationPath)).reconciliationCheckFailed,true)
 assert.equal((await runCarrierReconciliationSweep(h.pool,{facility:1,now:new Date(+failureNow+900003)})).failed,0)
 assert.equal((await api(applicationPath)).reconciliationCheckFailed,false)
 let failInvoiceCheck=true
 const invoiceFailurePool={query:(...args)=>h.pool.query(...args),connect:async()=>{const client=await h.pool.connect();return {query:async(...args)=>{if(failInvoiceCheck&&args[0].startsWith('INSERT INTO payroll_carrier_invoice_check')){failInvoiceCheck=false;throw new Error('Synthetic private invoice error')}return client.query(...args)},release:(...args)=>client.release(...args)}}}
 const priorInvoiceHistory=(await api(authPath)).invoiceBalance.assessmentHistory
 assert.equal((await runCarrierInvoiceSweep(invoiceFailurePool,{facility:1,now:new Date('2026-10-02T12:00:00Z')})).failed,1)
 const failedInvoice=(await api(authPath)).invoiceBalance;assert.deepEqual(failedInvoice.assessmentHistory,priorInvoiceHistory);assert.equal(failedInvoice.latestCheck.status,'FAILED');assert.equal(JSON.stringify(failedInvoice.failedChecks).includes('Synthetic private invoice error'),false)
 assert.equal((await runCarrierInvoiceSweep(h.pool,{facility:1,now:new Date('2026-10-02T12:01:00Z')})).attempted,0)
 assert.equal((await runCarrierInvoiceSweep(h.pool,{facility:1,now:new Date('2026-10-02T12:06:00Z')})).failed,0)
 const recoveredInvoice=(await api(authPath)).invoiceBalance;assert.equal(recoveredInvoice.latestCheck.status,'CHECKED');assert.equal(recoveredInvoice.failedChecks.length,1)
 assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key=$1",[`carrier-invoice-check-${invoice.id}`])).rows[0].status,'DISMISSED')
 await assert.rejects(h.pool.query("INSERT INTO payroll_carrier_invoice_check(invoice_id,facility_id,assessment_id,status) SELECT invoice_id,facility_id,id,'CHECKED' FROM payroll_carrier_invoice_assessment ORDER BY id LIMIT 1"),/current assessment/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_reconciliation_failure'),/append-only/)
 await assert.rejects(h.pool.query("INSERT INTO payroll_carrier_reconciliation_failure(payment_authorization_id,facility_id,message) VALUES($1,2,'Invalid scope')",[authorization.id]),/scoped payment/)

})
