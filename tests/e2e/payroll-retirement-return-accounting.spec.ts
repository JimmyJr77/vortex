import {runRetirementReturnSweep} from '../../backend/payroll/retirementReturnAutomation.js'
import {verifyRetirementReturnAccountingSource} from '../../backend/payroll/retirementReturnAccountingSource.js'
import {test,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {retirementRemittanceAuthorizationFixture} from '../../backend/payroll/testing/retirementRemittanceAuthorizationFixture.js'
import {retirementBankProvider} from '../../backend/payroll/testing/retirementBankProvider.js'
import {encryptDocument,decryptDocument} from '../../backend/payroll/onboarding.js'
import {journalPayload} from '../../backend/payroll/quickbooks.js'
test('admin reviews approves cancels and automatically recovers retirement return accounting',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(90000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');let journal=null,settlement=null,creditJournal=null,posts=0;const changed=false,closed=false,wrong=false,changeReturnDuringReview=false;let qboFetcher
 const provider=retirementBankProvider(),h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>new Date('2026-09-19T15:00:00Z'),retirementNow:()=>new Date('2026-09-11T12:00:00Z'),quickbooksFetcher:qboFetcher=async(url,options)=>{if(changeReturnDuringReview&&url.endsWith('/preferences'))provider.creditValid(false);if(options.method==='POST'){posts++;const payload=JSON.parse(options.body);if(payload.PrivateNote.includes('returned bank'))creditJournal={...payload,Id:'101'};else settlement={...payload,Id:'100'};throw new Error('Synthetic lost settlement response')}if(url.includes('/query?'))return {ok:true,json:async()=>({QueryResponse:{JournalEntry:[settlement,creditJournal].filter(j=>j&&decodeURIComponent(url).includes(j.DocNumber))}})};const account=url.split('/').pop();return {ok:true,json:async()=>url.includes('/journalentry/')?{JournalEntry:url.endsWith('/100')?settlement:changed?{...journal,PrivateNote:'Changed outside application'}:journal}:url.endsWith('/preferences')?{Preferences:{CurrencyPrefs:{HomeCurrency:{value:'USD'}},AccountingInfoPrefs:closed?{BookCloseDate:'2026-09-24'}:{}}}:{Account:{Id:wrong?'99':account,Name:`Account ${account}`,Active:true,AccountType:account==='8'?'Bank':'Other Current Liability',CurrencyRef:{value:'USD'}}}}}})
 try{
  const f=await retirementRemittanceAuthorizationFixture(h),a=await f.api(f.path,f.body),base=`/retirement-remittance-authorizations/${a.id}`
  await f.api(base+'/dispatch',{action:'SUBMIT',confirmed:true,bankInstructionsReviewed:true,outsideActivityReviewed:true,reference:'Verified original trustee instructions and separate allocation delivery'})
  const accounts={wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6',retirement:'7'},run=(await h.pool.query("SELECT r.*,COALESCE(r.payment_date,p.pay_date) pay_date FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.id=$1",[f.run.id])).rows[0]
  journal={...journalPayload(run,accounts),Id:'99'}
  await h.pool.query("INSERT INTO payroll_quickbooks_connection(facility_id,realm_id,environment,account_ids,encrypted_tokens) VALUES(1,'123','sandbox',$1,$2)",[accounts,encryptDocument(Buffer.from(JSON.stringify({access_token:'synthetic-settlement-token',expiresAt:Date.now()+3600000})),'quickbooks:1')])
  await h.pool.query("INSERT INTO payroll_quickbooks_sync(facility_id,payroll_run_id,realm_id,environment,request_id,payload,status,external_id) VALUES(1,$1,'123','sandbox','synthetic-source',$2,'SYNCED','99')",[f.run.id,journalPayload(run,accounts)])
  const mappingPath='/retirement-plans/standard/settlement-mapping',state=await f.api(mappingPath)
  await f.api(mappingPath,{confirmed:true,requestKey:randomUUID(),expectedRevision:0,fundingRevisionId:state.funding[0].id,connectionGeneration:state.connection.generation,realmId:'123',environment:'sandbox',bankAccountId:'8',liabilityAccountId:'7',reference:'Verified original payroll retirement liability and original funding bank'},'POST',201)
  await f.api(base+'/settlement-preview',{},'POST',409);provider.complete()
  const preview=await f.api(base+'/settlement-preview',{});assert.equal(preview.status,'PREVIEW_ONLY');assert.equal(preview.amountCents,1400);assert.equal(preview.sourceJournalId,'99');assert.equal(preview.journals[0].payload.TxnDate,'2026-09-22');assert.deepEqual(preview.journals[0].payload.Line.map(l=>[l.Amount,l.JournalEntryLineDetail.PostingType,l.JournalEntryLineDetail.AccountRef.value]),[[14,'Debit','7'],[14,'Credit','8']])
  assert.equal((await f.api(base+'/settlement-preview',{})).fingerprint,preview.fingerprint)
  const authPath=base+'/settlement-authorizations',body={fingerprint:preview.fingerprint,confirmed:true,autoPost:true,reference:'Reviewed exact bank settlement and absence of outside duplicate accounting',requestKey:randomUUID()}
  const cancelled=await f.api(authPath,body),cancelPath=`/retirement-settlement-authorizations/${cancelled.id}/cancel`,reason={confirmed:true,reference:'Recheck settlement review before any journal has been claimed'}
  await f.api(cancelPath,reason);assert.equal((await f.api(cancelPath,reason)).reused,true);assert.equal((await f.api(authPath,body)).cancelled,true)
  await f.api(`/retirement-settlement-authorizations/${cancelled.id}/post`,{action:'POST',confirmed:true},'POST',409)
  body.requestKey=randomUUID()
  const auth=await f.api(authPath,body);assert.equal((await f.api(authPath,body)).id,auth.id)
  await f.api(authPath,{...body,requestKey:randomUUID()},'POST',409)
  const postPath=`/retirement-settlement-authorizations/${auth.id}/post`,results=await Promise.all([f.api(postPath,{action:'POST',confirmed:true}),f.api(postPath,{action:'POST',confirmed:true})])
  assert.equal(posts,1);assert.ok(results.some(r=>r.status==='SYNCED'));assert.equal((await h.pool.query('SELECT * FROM payroll_retirement_settlement_claim')).rowCount,1)
  const history=await f.api(authPath);assert.equal(history.history[0].claimed,true);assert.equal(history.history[0].journals[0].result.status,'SYNCED')
  await f.api(`/retirement-settlement-authorizations/${auth.id}/cancel`,{confirmed:true,reference:'Cannot cancel after a journal claim has been retained'},'POST',409)
  await f.api(base+'/dispatch',{action:'RECOVER',confirmed:true})
  const encrypted=(await h.pool.query('SELECT encrypted_instruction FROM payroll_retirement_remittance_claim WHERE authorization_id=$1',[a.id])).rows[0].encrypted_instruction
  const intent=JSON.parse(decryptDocument(encrypted,`payroll-retirement-instruction:1:${a.id}`).toString())
  const withdrawal=(await h.pool.query('SELECT result FROM payroll_retirement_remittance_observation WHERE authorization_id=$1 ORDER BY id DESC LIMIT 1',[a.id])).rows[0].result
  const qbo=(await h.pool.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=1')).rows[0]
  const check=(company=qbo,w=withdrawal)=>verifyRetirementReturnAccountingSource(h.pool,1,a.id,intent,w,company,{fetcher:qboFetcher})
  const verified=await check();assert.equal(verified.journals.length,1);assert.equal(verified.journals[0].journalId,'100');assert.equal(verified.sourceJournalId,'99')
  provider.returnedCredit();await f.api(base+'/dispatch',{action:'RECOVER',confirmed:true})
  assert.equal((await check()).journals[0].journalId,'100')
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  let loseApprovalResponse=false
  const approvalRequests:unknown[]=[]
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),isApproval=u.pathname.endsWith('/return-authorizations')&&route.request().method()==='POST';if(isApproval)approvalRequests.push(route.request().postDataJSON());const response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(isApproval&&loseApprovalResponse){loseApprovalResponse=false;expect(response.ok()).toBe(true);await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic lost approval response; retry the original request.'})});return}await route.fulfill({response})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const panel=page.getByRole('region',{name:`Retirement return accounting ${a.id}`,exact:true})
  await panel.getByRole('button',{name:'Prepare retirement return preview',exact:true}).click()
  await expect(panel).toContainText('Credit date 2026-09-24');await expect(panel).toContainText('Debit account 8: $14.00')
  const approve=async()=>{await panel.getByRole('textbox',{name:'Retirement return approval reference',exact:true}).fill('Reviewed exact returned credit and original journals with no duplicate outside accounting');await panel.getByRole('checkbox',{name:'I approve automatic posting of this exact return journal and verified no duplicate outside accounting exists.',exact:true}).check();await panel.getByRole('button',{name:'Authorize retirement return accounting',exact:true}).click()}
  await approve()
  await panel.getByRole('textbox',{name:'Return approval cancellation reason',exact:true}).fill('Recheck the return review before any journal is claimed')
  await panel.getByRole('checkbox',{name:'I confirm the selected return accounting action.',exact:true}).check()
  await panel.getByRole('button',{name:'Cancel unstarted return approval',exact:true}).click();await expect(panel).toContainText('CANCELLED')
  loseApprovalResponse=true
  await approve()
  await panel.getByRole('button',{name:'Retry original retirement return approval',exact:true}).click()
  await expect(panel.getByRole('button',{name:'Retry original retirement return approval',exact:true})).toHaveCount(0)
  expect(approvalRequests).toHaveLength(3);expect(approvalRequests[2]).toEqual(approvalRequests[1])
  expect((await f.api(base+'/return-authorizations')).history).toHaveLength(2)
  await expect(panel.getByRole('button',{name:'Post approved retirement return',exact:true})).toBeVisible()
  expect((await f.api(base+'/return-authorizations')).history.filter(r=>!r.cancelled_at)).toHaveLength(1)
  const options={facility:1,fetcher:qboFetcher,paymentFetcher:provider.fetcher}
  expect((await runRetirementReturnSweep(h.pool,options)).attempted).toBe(1)
  await panel.getByRole('button',{name:'Load retirement return history',exact:true}).click();await expect(panel).toContainText('Return journal: UNCERTAIN')
  expect((await runRetirementReturnSweep(h.pool,{...options,now:new Date(Date.now()+360000)})).synced).toBe(1)
  await expect(panel).toContainText('Return journal: SYNCED',{timeout:40000});expect(posts).toBe(2)
  const reconciliation=page.getByRole('region',{name:`Contribution reconciliation ${a.id}`,exact:true})
  await reconciliation.getByRole('button',{name:'Review contribution reconciliation',exact:true}).click()
  await expect(reconciliation).toContainText('Returned-credit accounting: MATCHED');await expect(reconciliation).toContainText('Assessment: REVIEW REQUIRED')
  provider.creditValid(false);await panel.getByRole('button',{name:'Recover retirement return journal',exact:true}).click();await expect(panel).toContainText('Source verification: REVIEW REQUIRED');expect(posts).toBe(2)
  await reconciliation.getByRole('button',{name:'Review contribution reconciliation',exact:true}).click();await expect(reconciliation).toContainText('Returned-credit accounting: REVIEW REQUIRED')
  await page.setViewportSize({width:390,height:1100});await panel.screenshot({path:'/tmp/payroll-retirement-return-ui-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
 }finally{await page.unrouteAll({behavior:'ignoreErrors'});await page.close();await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
