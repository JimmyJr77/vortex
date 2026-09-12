import {test,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {retirementRemittanceAuthorizationFixture} from '../../backend/payroll/testing/retirementRemittanceAuthorizationFixture.js'
import {retirementBankProvider} from '../../backend/payroll/testing/retirementBankProvider.js'
import {encryptDocument} from '../../backend/payroll/onboarding.js'
import {journalPayload} from '../../backend/payroll/quickbooks.js'
test('settlement release preserves reviewed proof and permits one newly approved replacement',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(90000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');let journal=null,settlement=null,posts=0;let changed=false,closed=false;const wrong=false;let armed=false,sourceReads=0,absent=true
 const provider=retirementBankProvider(),h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>new Date('2026-09-19T15:00:00Z'),retirementNow:()=>new Date('2026-09-11T12:00:00Z'),quickbooksFetcher:async(url,options)=>{if(options.method==='POST'){posts++;settlement={...JSON.parse(options.body),Id:'100'};throw new Error('Synthetic lost settlement response')}if(url.includes('/journalentry/')&&armed&&++sourceReads>=2)changed=true;if(url.includes('/query?')&&!absent)throw new Error('Synthetic unavailable lookup');if(url.includes('/query?'))return {ok:true,json:async()=>({QueryResponse:{JournalEntry:settlement?[settlement]:[]}})};const account=url.split('/').pop();return {ok:true,json:async()=>url.includes('/journalentry/')?{JournalEntry:changed?{...journal,PrivateNote:'Changed outside application'}:journal}:url.endsWith('/preferences')?{Preferences:{CurrencyPrefs:{HomeCurrency:{value:'USD'}},AccountingInfoPrefs:closed?{BookCloseDate:'2026-09-22'}:{}}}:{Account:{Id:wrong?'99':account,Name:`Account ${account}`,Active:true,AccountType:account==='8'?'Bank':'Other Current Liability',CurrencyRef:{value:'USD'}}}}}})
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
  const postPath=`/retirement-settlement-authorizations/${auth.id}/post`,releasePath=`/retirement-settlement-authorizations/${auth.id}/release-preview`
  await f.api(releasePath,{},'POST',409)
  armed=true
  assert.equal((await f.api(postPath,{action:'POST',confirmed:true})).status,'NEEDS_REVIEW')
  assert.equal(posts,0)
  assert.equal((await h.pool.query('SELECT result FROM payroll_retirement_settlement_observation ORDER BY id DESC LIMIT 1')).rows[0].result.status,'NOT_SENT')
  armed=false;changed=false
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  let loseReleaseResponse=true
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(u.pathname.endsWith('/release-unsent')&&loseReleaseResponse){loseReleaseResponse=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic lost release response; retry original review.'})});return}await route.fulfill({response})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const panel=page.getByRole('region',{name:`Retirement settlement authorization ${a.id}`,exact:true})
  await panel.getByRole('button',{name:'Load retirement settlement history',exact:true}).click()
  const releasePanel=panel.getByRole('region',{name:`Unsent settlement release ${auth.id}`,exact:true})
  await releasePanel.getByRole('button',{name:'Review unsent retirement settlement',exact:true}).click()
  await expect(releasePanel).toContainText('absence verified')
  await releasePanel.getByRole('textbox',{name:'Unsent settlement release reason',exact:true}).fill('Verified original journals unsent and no outside settlement accounting')
  await releasePanel.getByRole('checkbox',{name:'I reviewed this exact non-send evidence and verified no outside accounting activity.',exact:true}).check()
  await releasePanel.getByRole('button',{name:'Release unsent retirement settlement',exact:true}).click()
  await expect(releasePanel).toContainText('Synthetic lost release response')
  await releasePanel.getByRole('button',{name:'Retry original settlement release',exact:true}).click()
  await expect(panel).toContainText('Unsent release retained')
  await expect(releasePanel).toHaveCount(0)
  expect((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_settlement_release')).rows[0].n).toBe(1)
  await page.getByRole('button',{name:'Prepare retirement settlement preview',exact:true}).click()
  await panel.getByRole('textbox',{name:'Retirement settlement approval reference',exact:true}).fill('Verified replacement settlement journal after proven original non-send release')
  await panel.getByRole('checkbox',{name:'I approve the exact proposed journals and verified no duplicate outside settlement accounting exists.',exact:true}).check()
  await panel.getByRole('button',{name:'Authorize retirement settlement',exact:true}).click()
  await panel.getByRole('checkbox',{name:'I confirm the retained retirement settlement posting action.',exact:true}).check()
  await panel.getByRole('button',{name:'Post authorized retirement settlement',exact:true}).click()
  await expect(panel).toContainText('Journal outcome: UNCERTAIN')
  await panel.getByRole('button',{name:'Recover retirement settlement journals',exact:true}).click()
  await expect(panel).toContainText('Journal outcome: SYNCED');expect(posts).toBe(1)
  await page.setViewportSize({width:390,height:1100});await panel.screenshot({path:'/tmp/payroll-retirement-release-ui-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
 }finally{await page.unrouteAll({behavior:'ignoreErrors'});await page.close();await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
