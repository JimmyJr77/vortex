import {runSettlementAutomationSweep} from '../../backend/payroll/settlementAutomationScheduler.js'
import {runCheckReplacementRecoverySweep} from '../../backend/payroll/checkReplacementRecoveryScheduler.js'
import {test,expect,type Request} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {configureSettlementFixture} from '../../backend/payroll/testing/settlementFixture.js'
import {runCheckIssueRecoverySweep} from '../../backend/payroll/checkIssueRecoveryScheduler.js'
import {monthlyBenefitsFixture} from '../../backend/payroll/testing/monthlyBenefitsFixture.js'
for(const variant of ['STOP_CLOSEOUT_RETRY_PREFLIGHT','STOP_CLOSEOUT_RETRY_RENEW','STOP_CLOSEOUT_RETRY','PROVIDER_CANCEL_CONTINUE','PROVIDER_CANCEL_RETRY','PROVIDER_CANCEL','PREFLIGHT','REVIEW','DELIVERY','STOP','STOP_RELEASE_HISTORY','STOP_RELEASE_PREFLIGHT','STOP_RELEASE','STOP_ACCOUNTING','STOP_ACH','STOP_CLOSEOUT'])test(`admin completes check workflow (${variant})`,async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(60000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const uuid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,records:Record<string,Record<string,unknown>>={};let order:Record<string,unknown>|null=null;let posts=0
 let tearingDown=false,lastPayrollActivity=0;const pendingPayrollRequests=new Set<Request>();
 const payrollRequest=(request:Request)=>new URL(request.url()).pathname.startsWith('/api/admin/payroll/');
 page.on('request',request=>{if(payrollRequest(request)){pendingPayrollRequests.add(request);lastPayrollActivity=Date.now()}});
 const finished=(request:Request)=>{if(pendingPayrollRequests.delete(request))lastPayrollActivity=Date.now()};page.on('requestfinished',finished);page.on('requestfailed',finished);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 let accountingFetcher:(url:string,options:Record<string,unknown>)=>Promise<unknown>=async()=>{throw new Error('Synthetic accounting not configured')}
 let payrollDate='2026-09-18T12:00:00Z',preflight=false,cancelPatches=0,cancellationReadFails=false,cancelLookupFails=false
 const cancellationDelay:{next:boolean;release?:()=>void}={next:false}
 const priorStopActions:Record<string,unknown>[]=[];let evidenceReadFails=false,stopRetryReadFails=false,stopLookupFails=false;let stopAction:Record<string,unknown>|null=null,stopPosts=0,replacementOrder:Record<string,unknown>|null=null,replacementExternal:string|null=null,replacementPosts=0,replacementBank=false
 const providerFetcher=async(url:string,options:{method?:string;body?:string}={})=>{
  const collection=new URL(url).pathname.split('/').pop()!
  if(collection==='payment_actions'){if(stopLookupFails&&options.method!=='POST')return {ok:false,status:503};if(options.method==='POST'){if(stopAction)priorStopActions.push({...stopAction});stopPosts++;stopAction={id:uuid(29+stopPosts),type:'stop',actionable_id:uuid(5),actionable_type:'payment_order',internal_account_id:uuid(2),live_mode:true,status:'pending'};throw new Error('Synthetic lost stop response')}return {ok:true,status:200,json:async()=>[...priorStopActions,...(stopAction?[stopAction]:[])]}}
  if(collection===uuid(40))return {ok:true,status:200,json:async()=>({id:uuid(40),counterparty_id:uuid(41),party_name:'Monthly Benefits',party_type:'individual',account_type:'checking',live_mode:true,verification_status:'verified',account_details:[{account_number_safe:'1234'}]})}
  if(collection===uuid(2))return preflight?{ok:false,status:503}:{ok:true,status:200,json:async()=>({id:uuid(2),currency:'USD',live_mode:true})}
  if(new URL(url).pathname.includes('/transactions/'))return {ok:true,status:200,json:async()=>({id:uuid(20),live_mode:true,internal_account_id:uuid(2),currency:'USD',direction:'debit',posted:true,as_of_date:replacementBank?'2026-09-22':'2026-09-21',amount:5970})}
  if(collection==='transaction_line_items')return {ok:true,status:200,json:async()=>[{id:uuid(21),transaction_id:uuid(20),transactable_type:'payment_order',transactable_id:replacementBank?uuid(50):uuid(5),live_mode:true,type:'originating',amount:5970}]}
  if(new URL(url).pathname.includes('/payment_orders')){
   if(cancelLookupFails&&options.method!=='PATCH'&&options.method!=='POST')return {ok:false,status:503}
   if(options.method==='PATCH'){cancelPatches++;expect(JSON.parse(options.body!)).toEqual({status:'cancelled'});order!.status=variant==='PROVIDER_CANCEL_CONTINUE'?'sent':'cancelled';throw new Error('Synthetic provider cancellation response lost')}
   if(replacementExternal&&(collection===replacementExternal||options.method==='POST')){if(options.method==='POST'){replacementPosts++;replacementOrder={...JSON.parse(options.body!),id:uuid(50),counterparty_id:uuid(variant==='STOP_ACH'?41:3),live_mode:true,status:'sent',reconciliation_status:'unreconciled'};throw new Error('Synthetic replacement response lost')}return {ok:!!replacementOrder,status:replacementOrder?200:404,json:async()=>replacementOrder}}
   if(options.method==='POST'){posts++;order={...JSON.parse(options.body!),id:uuid(variant.startsWith('PROVIDER_CANCEL')&&posts>3?6:5),counterparty_id:uuid(3),live_mode:true,status:variant.startsWith('PROVIDER_CANCEL')&&posts===3?'approved':'sent',reconciliation_status:'unreconciled'};throw new Error('Synthetic lost check response')}
   const matching=order&&(collection===order.external_id||collection===order.id);return {ok:!!matching,status:matching?200:404,json:async()=>order}
  }
  if(collection===uuid(3))return {ok:true,status:200,json:async()=>records.counterparties}
  if(collection===uuid(4))return {ok:true,status:200,json:async()=>records.external_accounts}
  if(collection==='documents')return {ok:true,status:200,json:async()=>[{id:uuid(new URL(url).searchParams.get('documentable_id')===uuid(50)?52:8),source:'modern_treasury',document_type:'rendered_check',documentable_type:'payment_order',documentable_id:new URL(url).searchParams.get('documentable_id'),file:{content_type:'application/pdf'}}]}
  if(collection==='download')return new Response('%PDF-1.4\nsynthetic browser check\n%%EOF',{headers:{'Content-Type':'application/pdf'}})
  if(options.method==='POST'){posts++;records[collection]={...JSON.parse(options.body!),id:uuid(collection==='counterparties'?3:4),live_mode:true,...(collection==='external_accounts'?{account_details:[],routing_details:[]}: {})};return {ok:true,status:201,json:async()=>records[collection]}}
  return {ok:true,status:200,json:async()=>records[collection]?[records[collection]]:[]}
 }
 const h=await createHarness({payrollNow:()=>new Date(payrollDate),paymentFetcher:providerFetcher,quickbooksFetcher:(url:string,options:Record<string,unknown>)=>accountingFetcher(url,options)})
 try{
  const {api,employee,periods}=await monthlyBenefitsFixture(h)
  const c=await api('/payment-connection',{organizationId:uuid(1),originatingAccountId:uuid(2),apiKey:'synthetic-browser-check-key',mode:'LIVE',reference:'Synthetic reviewed connection',expectedRevision:0,confirmed:true},'POST',201)
  await api('/payment-connection/verify',{expectedRevision:c.revision})
  const setupBody={connectionId:c.revision,expectedRevision:0,enabled:true,expiryDays:90,activationReference:'Synthetic digital check activation',confirmed:true},setup=await api('/check-configuration',setupBody,'POST',201)
  const payeePath=`/employees/${employee.id}/check-payee`,payee=await api(payeePath,{connectionId:c.revision,expectedRevision:0,payeeName:'Monthly Benefits',reference:'Synthetic legal recipient review',confirmed:true},'POST',201)
  for(const stage of ['COUNTERPARTY','ACCOUNT'])await api(`${payeePath}/${payee.id}/advance`,{stage,action:'CONTINUE',confirmed:true})
  const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
  const plan=await api(`/runs/${run.id}/payment-plan`);await api(`/runs/${run.id}/payment-authorization`,{fingerprint:plan.fingerprint,reference:'Synthetic approved check payroll',confirmed:true},'POST',201)
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{try{const u=new URL(route.request().url());if(evidenceReadFails&&u.pathname.endsWith('/evidence')){await route.fulfill({status:503,json:{success:false,message:'Synthetic unavailable evidence refresh'}});return}if(stopRetryReadFails&&u.pathname.endsWith('/stop')&&route.request().method()==='GET'){await route.fulfill({status:503,json:{success:false,message:'Synthetic unavailable stop retry review'}});return}if(cancellationReadFails&&u.pathname.endsWith('/cancellation')&&route.request().method()==='GET'){await route.fulfill({status:503,json:{success:false,message:'Synthetic unavailable cancellation refresh'}});return}if(cancellationDelay.next&&u.pathname.endsWith('/cancellation')&&route.request().method()==='GET'){cancellationDelay.next=false;const retained=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});await new Promise<void>(resolve=>{cancellationDelay.release=resolve});await route.fulfill({response:retained});return}await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})}catch(e){throw new Error(`Payroll proxy ${route.request().method()} ${new URL(route.request().url()).pathname}; teardown=${tearingDown}; failure=${route.request().failure()?.errorText||'none'}: ${e instanceof Error?e.message:String(e)}`)}})
  await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Payroll runs',exact:true}).click();await page.getByRole('button',{name:'Open review',exact:true}).click()
  const view=page.getByRole('region',{name:'Check issuance review Monthly Benefits',exact:true})
  await view.getByRole('button',{name:'Review check issuance',exact:true}).click();await expect(view.getByRole('status')).toHaveText('READY FOR CHECK REVIEW');await expect(view).toContainText('$59.70');await expect(view).toContainText('2026-09-18')
  await view.screenshot({path:'/tmp/payroll-check-issuance-review-mobile.png'});expect(await view.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
  if(['PREFLIGHT','PROVIDER_CANCEL','PROVIDER_CANCEL_RETRY','PROVIDER_CANCEL_CONTINUE'].includes(variant)){
   const providerCancel=variant.startsWith('PROVIDER_CANCEL');page.setDefaultTimeout(15000);preflight=!providerCancel;await page.clock.install()
   await view.getByLabel('Check issuance reference',{exact:true}).fill('Synthetic browser blocked check before submission');await view.getByLabel('I confirm no payment has already been issued for these wages and authorize this check.',{exact:true}).check();await view.getByRole('button',{name:'Issue payroll check',exact:true}).click()
   if(providerCancel){
    await view.getByRole('button',{name:'Recover check status',exact:true}).click();await expect(view.getByRole('status').first()).toHaveText('Check status: PROVIDER APPROVED')
    const cancellation=view.getByRole('region',{name:'Provider check cancellation',exact:true})
    await cancellation.getByLabel('Provider cancellation reference',{exact:true}).fill('Synthetic reviewed provider check cancellation');await cancellation.getByRole('checkbox').check();cancelLookupFails=variant==='PROVIDER_CANCEL_RETRY';await cancellation.getByRole('button',{name:'Cancel check at provider',exact:true}).click()
    if(variant==='PROVIDER_CANCEL_RETRY'){
     await expect(cancellation.getByRole('status')).toHaveText('Provider cancellation: NEEDS REVIEW');expect(cancelPatches).toBe(0)
     cancelLookupFails=false;await cancellation.getByRole('button',{name:'Recover provider cancellation',exact:true}).click();await expect(cancellation.getByText('Review cancellation retry',{exact:true})).toBeVisible()
     await cancellation.getByLabel('Cancellation retry reference',{exact:true}).fill('Synthetic fresh review after proven no-update failure');await cancellation.getByRole('checkbox').check()
     cancellationReadFails=true;await cancellation.getByRole('button',{name:'Refresh provider cancellation',exact:true}).click();await expect(cancellation.getByRole('button',{name:'Retry provider cancellation',exact:true})).not.toBeVisible()
     cancellationReadFails=false;await cancellation.getByRole('button',{name:'Refresh provider cancellation',exact:true}).click();await expect(cancellation.getByRole('button',{name:'Retry provider cancellation',exact:true})).toBeDisabled();await cancellation.getByRole('checkbox').check()
     await cancellation.getByRole('button',{name:'Retry provider cancellation',exact:true}).click();await expect(cancellation.getByText('Review cancellation retry',{exact:true})).not.toBeVisible()
     await cancellation.getByText('Cancellation retry history',{exact:true}).click();await expect(cancellation).toContainText('Synthetic fresh review after proven no-update failure');await cancellation.screenshot({path:'/tmp/payroll-cancel-retry-mobile.png'});expect(await cancellation.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
    }
    await expect(cancellation.getByRole('status')).toHaveText('Provider cancellation: UNCERTAIN');expect(cancelPatches).toBe(1)
    if(variant==='PROVIDER_CANCEL_CONTINUE'){
     await cancellation.getByRole('button',{name:'Recover provider cancellation',exact:true}).click();await expect(cancellation.getByText('Review the available original check',{exact:true})).toBeVisible()
     await cancellation.getByLabel('Original check continuation reference',{exact:true}).fill('Synthetic available original after unsuccessful cancellation');await cancellation.getByRole('checkbox').check()
     cancellationReadFails=true;await cancellation.getByRole('button',{name:'Refresh provider cancellation',exact:true}).click();await expect(cancellation.getByRole('button',{name:'Continue this original check',exact:true})).not.toBeVisible();cancellationReadFails=false
     await cancellation.getByRole('button',{name:'Refresh provider cancellation',exact:true}).click();await expect(cancellation.getByRole('button',{name:'Continue this original check',exact:true})).toBeDisabled();await cancellation.getByRole('checkbox').check()
     await cancellation.getByRole('button',{name:'Continue this original check',exact:true}).click();await expect(cancellation).toContainText('The reviewed original check may proceed');await cancellation.screenshot({path:'/tmp/payroll-cancel-continuation-mobile.png'});expect(await cancellation.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
     await view.getByRole('button',{name:'Recover check status',exact:true}).click();await expect(view.getByRole('status').first()).toHaveText('Check status: SENT');await page.clock.resume()
     await view.getByRole('button',{name:'Retain check document',exact:true}).click();const [file]=await Promise.all([page.waitForEvent('download'),view.getByRole('button',{name:'Download printable check',exact:true}).click()]);expect(file.suggestedFilename()).toMatch(/^payroll-check-/)
     const handoff='Synthetic original check handed over after reviewed continuation';await view.getByLabel('Printed check delivery reference',{exact:true}).fill(handoff);await view.getByLabel('I printed this retained check and handed it to this employee today.',{exact:true}).check();await view.getByRole('button',{name:'Record check delivery',exact:true}).click();await expect(view).toContainText(`Printed check delivery retained · ${handoff}`)
     await page.getByLabel('Payroll closeout reference',{exact:true}).fill('Synthetic continued original payroll finalized');await page.getByLabel('I confirm check deliveries and authorize closeout once bank evidence is verified for the approved payment date.',{exact:true}).check();await page.getByRole('button',{name:'Finalize paid payroll',exact:true}).click();await expect(page.getByRole('region',{name:'Authorize payroll payment plan',exact:true})).toContainText('Payroll finalized')
     expect(posts).toBe(3);expect(cancelPatches).toBe(1);expect(errors).toEqual([]);return
    }
    expect((await runCheckIssueRecoverySweep(h.pool,{fetcher:providerFetcher,now:()=>new Date(Date.now()+11*60000)})).checked).toBe(1)
    await page.clock.fastForward(31000);await expect(cancellation).toContainText('Provider cancellation is confirmed.');await page.clock.resume()
    cancellationDelay.next=true;await page.getByRole('button',{name:'Refresh payment authorization',exact:true}).click();await expect.poll(()=>typeof cancellationDelay.release).toBe('function');cancellationReadFails=true;await cancellation.getByRole('button',{name:'Refresh provider cancellation',exact:true}).click();await expect(cancellation.getByRole('alert')).toContainText('Synthetic unavailable');await expect(cancellation).not.toContainText('Provider cancellation is confirmed.')
    const delayedResponse=page.waitForResponse(r=>r.url().endsWith('/cancellation')&&r.request().method()==='GET'&&r.status()===200);cancellationDelay.release?.();await delayedResponse;await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));await expect(cancellation).not.toContainText('Provider cancellation is confirmed.')
    cancellationReadFails=false;await cancellation.getByRole('button',{name:'Refresh provider cancellation',exact:true}).click();await expect(cancellation).toContainText('Provider cancellation is confirmed.');await cancellation.getByRole('button',{name:'Review authorization release',exact:true}).click()
   }else{
    await expect(view).toContainText('Check submission stopped before provider creation.');expect(posts).toBe(2)
    expect((await runCheckIssueRecoverySweep(h.pool,{fetcher:providerFetcher,now:()=>new Date(Date.now()+11*60000)})).checked).toBe(1)
    await page.clock.fastForward(31000);await expect(view).toContainText('Fresh recovery confirms it was not found.');await page.clock.resume()
    await view.getByRole('button',{name:'Refresh cancellation eligibility',exact:true}).click()
   }
   const authorization=page.getByRole('region',{name:'Authorize payroll payment plan',exact:true})
   await authorization.getByLabel('Payment decision reference',{exact:true}).fill('Synthetic cancelled check authorization before submission');await authorization.getByLabel('I confirm this authorization should be cancelled before payment submission.',{exact:true}).check();await authorization.getByRole('button',{name:'Cancel payment authorization',exact:true}).click()
   await expect(authorization).toContainText('This authorization is retained as cancelled.');await authorization.getByText(providerCancel?'Provider cancellation evidence':'Check cancellation evidence',{exact:true}).click();await expect(authorization).toContainText(providerCancel?'provider cancellation recovered on':'submission blocked before creation; recovery confirmed no provider check')
   await authorization.screenshot({path:providerCancel?'/tmp/payroll-provider-check-cancel-mobile.png':'/tmp/payroll-check-preflight-cancel-mobile.png'});expect(await authorization.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(posts).toBe(providerCancel?3:2)
   await page.getByRole('button',{name:'Void run',exact:true}).click();await expect(page.getByText('Run voided. You can generate a fresh draft for this period.',{exact:true})).toBeVisible()
   preflight=false;await page.getByRole('combobox',{name:'Pay period',exact:true}).selectOption(String(periods[0].id));await page.getByRole('button',{name:'Preview payroll',exact:true}).click();await page.getByRole('button',{name:'Save draft snapshot',exact:true}).click()
   await page.getByRole('row').filter({hasText:'DRAFT'}).getByRole('button',{name:'Open review',exact:true}).click();await page.getByRole('button',{name:'Send to review',exact:true}).click();await page.getByRole('button',{name:'Approve run',exact:true}).click()
   await page.getByRole('button',{name:'Prepare payment plan',exact:true}).click();await expect(page.getByText('Ready for payment review. Approved date: 2026-09-18',{exact:true})).toBeVisible();await authorization.getByLabel('Payment decision reference',{exact:true}).fill('Synthetic rebuilt payroll payment authorization');await authorization.getByLabel('I reviewed the employee amounts, payment methods and payment date.',{exact:true}).check();await authorization.getByRole('button',{name:'Authorize payment plan',exact:true}).click()
   await view.getByRole('button',{name:'Review check issuance',exact:true}).click();await view.getByLabel('Check issuance reference',{exact:true}).fill('Synthetic new check after verified preflight cancellation');await view.getByLabel('I confirm no payment has already been issued for these wages and authorize this check.',{exact:true}).check();await view.getByRole('button',{name:'Issue payroll check',exact:true}).click();await view.getByRole('button',{name:'Recover check status',exact:true}).click();await expect(view.getByRole('status')).toHaveText('Check status: SENT')
   expect(posts).toBe(providerCancel?4:3);expect(cancelPatches).toBe(providerCancel?1:0);expect((await h.pool.query('SELECT * FROM payroll_check_issue')).rowCount).toBe(2);expect(errors).toEqual([]);return
  }
  if(['DELIVERY','STOP','STOP_RELEASE_HISTORY','STOP_RELEASE_PREFLIGHT','STOP_RELEASE','STOP_ACCOUNTING','STOP_ACH','STOP_CLOSEOUT','STOP_CLOSEOUT_RETRY_RENEW','STOP_CLOSEOUT_RETRY','STOP_CLOSEOUT_RETRY_PREFLIGHT'].includes(variant)){
   await page.clock.install()
   const submit=view.getByRole('button',{name:'Issue payroll check',exact:true});await expect(submit).toBeDisabled()
   await view.getByLabel('Check issuance reference',{exact:true}).fill('Synthetic browser check with no prior payment')
   await view.getByLabel('I confirm no payment has already been issued for these wages and authorize this check.',{exact:true}).check();await submit.click()
   await expect(view.getByRole('status')).toContainText('UNCERTAIN')
   expect((await runCheckIssueRecoverySweep(h.pool,{fetcher:providerFetcher,now:()=>new Date(Date.now()+2*86400000)})).checked).toBe(1)
   await page.clock.fastForward(31000);await expect(view.getByRole('status')).toHaveText('Check status: SENT');await expect(view).toContainText('Check status updated automatically.')
   await page.clock.resume()
   expect(posts).toBe(3)
   await expect(view.getByRole('button',{name:'Refresh check document',exact:true})).toBeEnabled()
   expect((await h.pool.query('SELECT automatic,created_by FROM payroll_check_document')).rows).toEqual([{automatic:true,created_by:null}])
   if(['STOP_ACCOUNTING','STOP_CLOSEOUT','STOP_CLOSEOUT_RETRY_RENEW','STOP_CLOSEOUT_RETRY','STOP_CLOSEOUT_RETRY_PREFLIGHT'].includes(variant)){
    const batch=await api(`/runs/${run.id}/payment-authorization`),checkBase=`/runs/${run.id}/payment-authorization/${batch.id}/checks/${employee.id}`
    const printed=await fetch(`${h.url}/api/admin/payroll${checkBase}/document`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({action:'DOWNLOAD'})});expect(printed.status).toBe(200);await printed.arrayBuffer()
    const reference='Synthetic original check handoff before later loss'
    await api(`${checkBase}/delivery`,{confirmed:true,deliveredInPerson:true,amountCents:5970,paymentDate:plan.paymentDate,reference})
    if(!variant.startsWith('STOP_CLOSEOUT'))await api(`/runs/${run.id}/payment-closeout`,{batchId:Number(batch.id),fingerprint:plan.fingerprint,paymentDate:plan.paymentDate,reference:'Synthetic original finalized payroll',confirmed:true,checkPayments:[{employeeId:employee.id,amountCents:5970,paymentDate:plan.paymentDate,reference}]})
    await page.reload();await page.getByRole('button',{name:'Payroll runs',exact:true}).click();await page.getByRole('button',{name:'Open review',exact:true}).click();await expect(view.getByRole('status')).toHaveText('Check status: SENT')
   }
   if(['STOP','STOP_RELEASE_HISTORY','STOP_RELEASE_PREFLIGHT','STOP_RELEASE','STOP_ACCOUNTING','STOP_ACH','STOP_CLOSEOUT','STOP_CLOSEOUT_RETRY_RENEW','STOP_CLOSEOUT_RETRY','STOP_CLOSEOUT_RETRY_PREFLIGHT'].includes(variant)){
    await view.getByText('Lost check or stop payment',{exact:true}).click()
    await view.getByLabel('Check stop review reference',{exact:true}).fill('Synthetic lost check requires stop')
    await view.getByLabel('I verified this bank supports stop-payment actions and authorize stopping this check.',{exact:true}).check()
    stopLookupFails=variant==='STOP_CLOSEOUT_RETRY_PREFLIGHT'||variant==='STOP_RELEASE_PREFLIGHT';await view.getByRole('button',{name:'Request check stop',exact:true}).click();await expect(view).toContainText('Stop request: UNCERTAIN');stopLookupFails=false
    if(['STOP_ACCOUNTING','STOP_CLOSEOUT','STOP_CLOSEOUT_RETRY_RENEW','STOP_CLOSEOUT_RETRY','STOP_CLOSEOUT_RETRY_PREFLIGHT'].includes(variant))await expect(view.getByRole('button',{name:'Download printable check',exact:true})).toHaveCount(0);else await expect(view.getByRole('button',{name:'Download printable check',exact:true})).toBeDisabled()
    if(variant.startsWith('STOP_CLOSEOUT_RETRY')){
     if(stopAction)stopAction.status='failed';await view.getByRole('button',{name:'Recover check stop',exact:true}).click();await expect(view).toContainText(variant==='STOP_CLOSEOUT_RETRY_PREFLIGHT'?'Stop request: NOT FOUND':'Stop request: FAILED')
     if(variant==='STOP_CLOSEOUT_RETRY_RENEW'){
      await view.getByLabel('Original check recovery reference',{exact:true}).fill('Synthetic found original before renewed loss');await view.getByLabel('I recovered the original check, no replacement was issued, and I authorize continuing that check.',{exact:true}).check();await view.getByRole('button',{name:'Continue original check',exact:true}).click();await expect(view).toContainText('The reviewed original check may continue')
     }
     const retryButton=variant==='STOP_CLOSEOUT_RETRY_RENEW'?'Request renewed bank stop':'Retry bank stop'
     const retry=view.getByRole('region',{name:'Failed check stop retry',exact:true});await retry.getByRole('button',{name:'Refresh stop retry review',exact:true}).click();if(variant==='STOP_CLOSEOUT_RETRY_PREFLIGHT')await expect(retry).toContainText('This attempt stopped before transmission')
     await retry.getByLabel('Stop retry reference',{exact:true}).fill('Synthetic unavailable original after failed bank stop');await retry.getByRole('checkbox').check()
     stopRetryReadFails=true;await retry.getByRole('button',{name:'Refresh stop retry review',exact:true}).click();await expect(retry.getByRole('alert')).toContainText('Synthetic unavailable');await expect(retry.getByRole('button',{name:retryButton,exact:true})).not.toBeVisible();stopRetryReadFails=false
     await retry.getByRole('button',{name:'Refresh stop retry review',exact:true}).click();await expect(retry.getByRole('button',{name:retryButton,exact:true})).toBeDisabled();await retry.getByRole('checkbox').check();await retry.screenshot({path:'/tmp/payroll-stop-retry-review-mobile.png'});await retry.getByRole('button',{name:retryButton,exact:true}).click()
     await retry.getByText('Stop retry history',{exact:true}).click();await expect(retry).toContainText('Synthetic unavailable original after failed bank stop');expect(stopPosts).toBe(variant==='STOP_CLOSEOUT_RETRY_PREFLIGHT'?1:2);await retry.screenshot({path:'/tmp/payroll-stop-retry-mobile.png'});expect(await retry.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
     if(variant==='STOP_CLOSEOUT_RETRY_RENEW'){await retry.getByText('Original-check continuation history',{exact:true}).click();await expect(retry).toContainText('Synthetic found original before renewed loss');await retry.screenshot({path:'/tmp/payroll-stop-renewal-history-mobile.png'})}
    }
    if(variant.startsWith('STOP_RELEASE')){
     if(stopAction)Object.assign(stopAction,{status:'failed'})
     await view.getByRole('button',{name:'Recover check stop',exact:true}).click();await expect(view).toContainText(variant==='STOP_RELEASE_PREFLIGHT'?'Stop request: NOT FOUND':'Stop request: FAILED')
     if(variant==='STOP_RELEASE_HISTORY'){
      Object.assign(order!,{status:'completed'});await view.getByRole('button',{name:'Recover check stop',exact:true}).click();await expect(view.getByRole('status')).toHaveText('Check status: COMPLETED');Object.assign(order!,{status:'sent'});await view.getByRole('button',{name:'Recover check stop',exact:true}).click();await expect(view.getByRole('status')).toHaveText('Check status: SENT');await expect(view.getByRole('button',{name:'Continue original check',exact:true})).toHaveCount(0);await expect(view).toContainText('Printing and delivery are blocked');await view.getByRole('button',{name:'Refresh stop retry review',exact:true}).click();await expect(view).toContainText('Earlier paid, stopped or conflicting check evidence');await view.screenshot({path:'/tmp/payroll-stop-paid-history-mobile.png'});await h.pool.query("INSERT INTO payroll_check_stop_observation(stop_id,source,result,created_at) SELECT stop_id,source,result,'2026-09-11T00:00:00.123456Z' FROM payroll_check_stop_observation CROSS JOIN generate_series(1,35) WHERE id=(SELECT max(id) FROM payroll_check_stop_observation)");await view.getByText('Retained check evidence',{exact:true}).click();const evidence=view.getByRole('region',{name:'Retained check evidence',exact:true});await expect(evidence).toContainText('Provider reported paid or reconciled.');await expect(evidence).toContainText('Original check');await expect(evidence).toContainText('Bank stop');await evidence.getByRole('button',{name:'Load older check evidence',exact:true}).click();await expect(evidence.locator('ol > li')).toHaveCount(40);evidenceReadFails=true;await evidence.getByRole('button',{name:'Refresh check evidence',exact:true}).click();await expect(evidence.getByRole('alert')).toContainText('Previously loaded observations remain below.');evidenceReadFails=false;await evidence.getByRole('button',{name:'Refresh check evidence',exact:true}).click();await expect(evidence.locator('ol > li')).toHaveCount(20);await evidence.locator('ol > li').filter({hasText:'Provider reported paid or reconciled.'}).first().screenshot({path:'/tmp/payroll-check-evidence-mobile.png'});expect(await evidence.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);expect(stopPosts).toBe(1);expect(errors).toEqual([]);return
     }
     if(variant==='STOP_RELEASE_PREFLIGHT'){
      await expect(view).toContainText('The stop was not transmitted');await view.getByLabel('Original check recovery reference',{exact:true}).fill('Synthetic review before unavailable refresh');await view.getByLabel('I recovered the original check, no replacement was issued, and I authorize continuing that check.',{exact:true}).check()
      stopRetryReadFails=true;await view.getByRole('button',{name:'Review check issuance',exact:true}).click();await expect(view.getByRole('button',{name:'Continue original check',exact:true})).toHaveCount(0);stopRetryReadFails=false;await view.getByRole('button',{name:'Review check issuance',exact:true}).click();await expect(view.getByRole('button',{name:'Continue original check',exact:true})).toBeDisabled()
     }
     await view.getByLabel('Original check recovery reference',{exact:true}).fill('Synthetic original recovered without replacement')
     await view.getByLabel('I recovered the original check, no replacement was issued, and I authorize continuing that check.',{exact:true}).check()
     await view.getByRole('button',{name:'Continue original check',exact:true}).click();await expect(view).toContainText('The reviewed original check may continue')
     await expect(view.getByRole('button',{name:'Download printable check',exact:true})).toBeEnabled()
     await view.screenshot({path:'/tmp/payroll-stop-release-mobile.png'});expect(stopPosts).toBe(variant==='STOP_RELEASE_PREFLIGHT'?0:1)
    }else{
    Object.assign(stopAction!,{status:'acknowledged'});Object.assign(order!,{status:'stopped'})
    expect((await runCheckIssueRecoverySweep(h.pool,{fetcher:providerFetcher,now:()=>new Date(Date.now()+4*86400000)})).checked).toBe(1)
    await page.clock.fastForward(31000);await expect(view).toContainText('Stop request: STOP CONFIRMED');await expect(view.getByRole('status')).toHaveText('Check status: STOPPED');await page.clock.resume()
    if(variant==='STOP_ACH'){
     await h.pool.query("UPDATE payroll_onboarding_task SET response=$2 WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id,{method:'DIRECT_DEPOSIT'}])
     const destination=await api(`/employees/${employee.id}/payment-destination`,{connectionId:c.revision,accountId:uuid(40),reference:'Synthetic employee bank account replacement',confirmed:true,expectedRevision:0},'POST',201)
     const disclosure=await api('/payment-authorization',undefined,'GET',200,true)
     await api('/payment-authorization',{destinationId:destination.revision,expectedRevision:0,decision:'AUTHORIZE',signature:'Monthly Benefits',confirmed:true,fingerprint:disclosure.fingerprint},'POST',201,true)
    }
    const review=view.getByRole('region',{name:'Stopped check replacement review',exact:true})
    await review.getByRole('button',{name:'Review stopped check replacement',exact:true}).click();await expect(review).toContainText('REVIEW REQUIRED')
    await review.getByLabel('Proposed replacement date',{exact:true}).fill('2026-09-22')
    await review.getByRole('combobox',{name:'Check replacement tax treatment',exact:true}).selectOption('ORIGINAL_PAYROLL_RETAINED')
    await review.getByLabel('Unpaid check review reference',{exact:true}).fill('Synthetic full unpaid check review')
    await review.getByLabel('Check tax review reference',{exact:true}).fill('Synthetic confirmed reporting decision')
    await review.getByLabel('I reviewed the full unpaid amount, verified no other payment was made, and confirmed the reporting treatment.',{exact:true}).check()
    await review.getByRole('button',{name:'Save check replacement review',exact:true}).click();await expect(review.getByText('REVIEW RETAINED',{exact:true})).toBeVisible()
    await review.screenshot({path:'/tmp/payroll-check-replacement-review-mobile.png'});expect((await h.pool.query('SELECT * FROM payroll_check_replacement_review')).rowCount).toBe(1)
    const authorization=review.getByRole('region',{name:'Stopped check replacement authorization',exact:true})
    await authorization.getByRole('button',{name:'Review replacement authorization',exact:true}).click()
    await authorization.getByLabel('Replacement authorization or cancellation reference',{exact:true}).fill('Synthetic replacement authorization from admin')
    await authorization.getByRole('checkbox').check()
    await authorization.getByRole('button',{name:'Authorize reviewed replacement',exact:true}).click()
    await expect(authorization.getByText(`AUTHORIZED · 2026-09-22 · ${variant==='STOP_ACH'?'DIRECT_DEPOSIT':'CHECK'}`,{exact:true})).toBeVisible()
    await authorization.screenshot({path:'/tmp/payroll-check-replacement-auth-mobile.png'})
    await authorization.getByLabel('Replacement authorization or cancellation reference',{exact:true}).fill('Synthetic correction before replacement dispatch')
    await authorization.getByRole('checkbox').check()
    await authorization.getByRole('button',{name:'Cancel unstarted replacement',exact:true}).click()
    await expect(authorization.getByText(`CANCELLED · 2026-09-22 · ${variant==='STOP_ACH'?'DIRECT_DEPOSIT':'CHECK'}`,{exact:true})).toBeVisible()
    await authorization.getByLabel('Replacement authorization or cancellation reference',{exact:true}).fill('Synthetic current replacement authorization')
    await authorization.getByRole('checkbox').check();await authorization.getByRole('button',{name:'Authorize reviewed replacement',exact:true}).click()
    await expect(authorization.getByText(`AUTHORIZED · 2026-09-22 · ${variant==='STOP_ACH'?'DIRECT_DEPOSIT':'CHECK'}`,{exact:true})).toBeVisible()
    const replacementId=(await h.pool.query('SELECT id FROM payroll_check_replacement_authorization ORDER BY created_at DESC LIMIT 1')).rows[0].id
    replacementExternal=`vortex_payroll_${variant==='STOP_ACH'?'':'check_'}${replacementId}`
    await authorization.getByRole('checkbox').check();await authorization.getByRole('button',{name:'Send authorized replacement',exact:true}).click()
    await expect(authorization).toContainText('Replacement status: UNCERTAIN')
    expect((await runCheckReplacementRecoverySweep(h.pool,{fetcher:providerFetcher,now:()=>new Date(Date.now()+2*86400000)})).checked).toBe(1)
    const replacementDraft=authorization.getByLabel('Replacement authorization or cancellation reference',{exact:true})
    await replacementDraft.fill('Synthetic unfinished administrator input')
    await page.clock.fastForward(31000);await expect(replacementDraft).toHaveValue('Synthetic unfinished administrator input');await expect(authorization).toContainText('Replacement status: UNCERTAIN')
    await replacementDraft.fill('')
    await page.clock.fastForward(31000)
    await expect(authorization).toContainText('Replacement status: SENT')
    await expect(authorization).toContainText('Replacement status refreshed automatically.');await page.clock.resume()
    await expect(authorization.getByRole('button',{name:'Cancel unstarted replacement',exact:true})).toHaveCount(0)
    if(variant==='STOP_ACH'){
     replacementBank=true;Object.assign(replacementOrder!,{status:'completed',reconciliation_status:'reconciled',transaction_ids:[uuid(20)]})
     expect((await runCheckReplacementRecoverySweep(h.pool,{fetcher:providerFetcher,now:()=>new Date(Date.now()+6*86400000)})).checked).toBe(1)
     const employeePage=await page.context().newPage()
     try{
      await employeePage.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','monthly-benefits-session'))
      await employeePage.route('**/api/payroll/employee/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
      await employeePage.setViewportSize({width:390,height:1000});await employeePage.goto('/tests/support/payroll.html?employee');await employeePage.getByRole('button',{name:'Pay statements',exact:true}).click()
      const receipts=employeePage.getByRole('region',{name:'Replacement payment receipts',exact:true})
      await expect(receipts).toContainText('Direct-deposit replacement of a stopped check');await expect(receipts).toContainText('Bank evidence confirmed');await expect(receipts).toContainText('ending 1234');await expect(receipts).toContainText('2026-09-22')
      const [receiptFile]=await Promise.all([employeePage.waitForEvent('download'),receipts.getByRole('button',{name:'Download replacement receipt',exact:true}).click()])
      expect(receiptFile.suggestedFilename()).toBe(`payroll-replacement-receipt-${replacementId}.html`)
      await receiptFile.saveAs('/tmp/payroll-replacement-receipt.html')
      const preview=await employeePage.context().newPage()
      try{await preview.route('https://receipt.test/**',async route=>route.fulfill({path:'/tmp/payroll-replacement-receipt.html',contentType:'text/html'}));await preview.setViewportSize({width:390,height:1000});await preview.goto('https://receipt.test/');await expect(preview.getByRole('heading',{name:'Replacement payment receipt',exact:true})).toBeVisible();await expect(preview.locator('body')).toContainText('Bank evidence confirmed');await preview.screenshot({path:'/tmp/payroll-receipt-download-mobile.png'});expect(await preview.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)}finally{await preview.unrouteAll({behavior:'wait'});await preview.close()}
      await employeePage.clock.install();Object.assign(replacementOrder!,{status:'returned'})
      expect((await runCheckReplacementRecoverySweep(h.pool,{fetcher:providerFetcher,now:()=>new Date(Date.now()+8*86400000)})).checked).toBe(1)
      await employeePage.clock.fastForward(31000);await expect(receipts).toContainText('Needs review');await employeePage.clock.resume()
      await receipts.screenshot({path:'/tmp/payroll-stopped-ach-receipt-mobile.png'});expect(await receipts.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
     }finally{await employeePage.unrouteAll({behavior:'wait'});await employeePage.close()}
     expect(replacementPosts).toBe(1);expect(errors).toEqual([]);return
    }
    await expect(authorization.getByRole('button',{name:'Refresh replacement document',exact:true})).toBeVisible()
    payrollDate='2026-09-22T12:00:00Z'
    const [replacementFile]=await Promise.all([page.waitForEvent('download'),authorization.getByRole('button',{name:'Download replacement check',exact:true}).click()])
    expect(replacementFile.suggestedFilename()).toBe(`payroll-replacement-check-${replacementId}.pdf`)
    expect((await h.pool.query('SELECT automatic,created_by FROM payroll_check_replacement_document')).rows).toEqual([{automatic:true,created_by:null}])
    await expect(authorization.getByRole('button',{name:'Download replacement check',exact:true})).toBeEnabled()
    await authorization.screenshot({path:'/tmp/payroll-check-replacement-document-mobile.png'})
    const handoff=authorization.getByRole('group',{name:'Confirm replacement check handoff',exact:true})
    await handoff.getByLabel('Replacement check delivery reference',{exact:true}).fill('Synthetic replacement delivered to employee')
    await handoff.getByLabel('I printed this replacement check and handed it to this employee today.',{exact:true}).check()
    await handoff.getByRole('button',{name:'Record replacement handoff',exact:true}).click()
    await expect(authorization).toContainText('Replacement handoff retained · 2026-09-22 · Synthetic replacement delivered to employee')
    await expect(authorization.getByRole('button',{name:'Download replacement check',exact:true})).toHaveCount(0)
    await authorization.screenshot({path:'/tmp/payroll-check-replacement-handoff-mobile.png'})
    const replacementEmployeePage=await page.context().newPage()
    try{
     await replacementEmployeePage.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','monthly-benefits-session'))
     await replacementEmployeePage.route('**/api/payroll/employee/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
     await replacementEmployeePage.setViewportSize({width:390,height:1000});await replacementEmployeePage.goto('/tests/support/payroll.html?employee');await replacementEmployeePage.getByRole('button',{name:'Pay statements',exact:true}).click()
     const replacementReceipts=replacementEmployeePage.getByRole('region',{name:'Check delivery receipts',exact:true})
     await expect(replacementReceipts).toContainText('Replacement check · Original pay date: 2026-09-18')
     await expect(replacementReceipts).toContainText('Awaiting bank clearance')
     await replacementReceipts.getByLabel('I received this check for $59.70 dated 2026-09-22.',{exact:true}).check()
     await replacementReceipts.getByRole('article').filter({hasText:'Replacement check · Original pay date'}).getByRole('button',{name:'Acknowledge check receipt',exact:true}).click();await expect(replacementReceipts).toContainText('Employee acknowledged receipt:')
     const [checkReceiptFile]=await Promise.all([replacementEmployeePage.waitForEvent('download'),replacementReceipts.getByRole('article').filter({hasText:'Replacement check · Original pay date'}).getByRole('button',{name:'Download check receipt',exact:true}).click()])
     expect(checkReceiptFile.suggestedFilename()).toBe(`payroll-check-receipt-${replacementId}.html`);await checkReceiptFile.saveAs('/tmp/payroll-check-receipt.html')
     const receiptPreview=await replacementEmployeePage.context().newPage()
     try{await receiptPreview.route('https://check-receipt.test/**',async route=>route.fulfill({path:'/tmp/payroll-check-receipt.html',contentType:'text/html'}));await receiptPreview.setViewportSize({width:390,height:1000});await receiptPreview.goto('https://check-receipt.test/');await expect(receiptPreview.getByRole('heading',{name:'Check delivery receipt',exact:true})).toBeVisible();await expect(receiptPreview.locator('body')).toContainText('Awaiting bank clearance');await expect(receiptPreview.locator('body')).toContainText('Employee acknowledgment');await receiptPreview.screenshot({path:'/tmp/payroll-check-receipt-download-mobile.png',fullPage:true});expect(await receiptPreview.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)}finally{await receiptPreview.unrouteAll({behavior:'wait'});await receiptPreview.close()}
     await replacementReceipts.screenshot({path:'/tmp/payroll-check-replacement-receipt-mobile.png'})
     await replacementEmployeePage.clock.install();Object.assign(replacementOrder!,{status:'stopped'})
     expect((await runCheckReplacementRecoverySweep(h.pool,{fetcher:providerFetcher,now:()=>new Date(Date.now()+4*86400000)})).checked).toBe(1)
     await replacementEmployeePage.clock.fastForward(31000);await expect(replacementReceipts.getByRole('article').filter({hasText:'Replacement check · Original pay date'})).toContainText('Check evidence needs review');await replacementEmployeePage.clock.resume()
    }finally{await replacementEmployeePage.unrouteAll({behavior:'wait'});await replacementEmployeePage.close()}


    await authorization.screenshot({path:'/tmp/payroll-check-replacement-dispatch-mobile.png'});expect(replacementPosts).toBe(1)

    if(['STOP_ACCOUNTING','STOP_CLOSEOUT','STOP_CLOSEOUT_RETRY_RENEW','STOP_CLOSEOUT_RETRY','STOP_CLOSEOUT_RETRY_PREFLIGHT'].includes(variant)){
     replacementBank=true;Object.assign(replacementOrder!,{status:'completed',reconciliation_status:'reconciled',transaction_ids:[uuid(20)]})
     expect((await runCheckReplacementRecoverySweep(h.pool,{fetcher:providerFetcher,now:()=>new Date(Date.now()+6*86400000)})).checked).toBe(1)
     if(variant.startsWith('STOP_CLOSEOUT')){
      payrollDate='2026-09-22T12:00:00Z';await page.reload();await page.getByRole('button',{name:'Payroll runs',exact:true}).click();await page.getByRole('button',{name:'Open review',exact:true}).click()
      await expect(page.getByText('Confirmed replacement paid on 2026-09-22.',{exact:false})).toBeVisible()
      await page.getByLabel('Payroll closeout reference',{exact:true}).fill('Synthetic original payroll closed after replacement')
      await page.getByLabel('I confirm check deliveries and authorize closeout once bank evidence is verified for the approved payment date.',{exact:true}).check()
      await page.getByRole('button',{name:'Finalize paid payroll',exact:true}).click();await expect(page.getByRole('region',{name:'Authorize payroll payment plan',exact:true})).toContainText('Payroll finalized')
      const retained=(await h.pool.query('SELECT replacement_evidence FROM payroll_payment_closeout')).rows;expect(retained).toHaveLength(1);expect(retained[0].replacement_evidence[0].evidence.replacementDate).toBe('2026-09-22');expect(retained[0].replacement_evidence[0].evidence.wageDate).toBe('2026-09-18')
      await page.getByText('Closeout evidence',{exact:true}).click();await expect(page.getByText('Replacement closeout: original wage date 2026-09-18',{exact:false})).toBeVisible()
      await page.getByText('Closeout evidence',{exact:true}).locator('..').screenshot({path:'/tmp/payroll-check-replacement-closeout-evidence-mobile.png'})
      await page.getByRole('region',{name:'Authorize payroll payment plan',exact:true}).screenshot({path:'/tmp/payroll-check-replacement-closeout-mobile.png'});expect(errors).toEqual([]);expect(replacementPosts).toBe(1);expect(stopPosts).toBe(['STOP_CLOSEOUT_RETRY','STOP_CLOSEOUT_RETRY_RENEW'].includes(variant)?2:1);return
     }
     const accounting=await configureSettlementFixture(h,api,run.id,c.revision,value=>{accountingFetcher=value})
     const journals=page.getByRole('region',{name:'QuickBooks settlement journals',exact:true})
     await journals.getByRole('button',{name:'Review settlement journals',exact:true}).click()
     const automation=journals.getByRole('region',{name:'Automatic settlement posting',exact:true})
     await automation.getByRole('button',{name:'Review automatic posting',exact:true}).click();await expect(automation.getByRole('status')).toHaveText('Automatic posting: DISABLED')
     await automation.getByLabel('Automatic posting review reference',{exact:true}).fill('Synthetic automatic settlement authorization')
     await automation.getByRole('checkbox').check();await automation.getByRole('button',{name:'Enable automatic posting',exact:true}).click();await expect(automation.getByRole('status')).toHaveText('Automatic posting: ENABLED')
     await page.clock.install()
     expect((await runSettlementAutomationSweep(h.pool,{fetcher:accountingFetcher,now:()=>new Date(Date.now()+10*86400000)})).posted).toBe(1)
     const workerHistory=automation.getByRole('region',{name:'Automatic posting execution history',exact:true}),automationReference=automation.getByLabel('Automatic posting review reference',{exact:true})
     await automationReference.fill('Synthetic unfinished automatic posting review');await page.clock.fastForward(31000);await expect(automationReference).toHaveValue('Synthetic unfinished automatic posting review');await expect(workerHistory).toContainText('No worker attempts recorded yet.')
     await automationReference.fill('');await page.clock.fastForward(31000);await expect(workerHistory).toContainText('Worker finished');await expect(workerHistory).toContainText('Current status: UNCERTAIN');await page.clock.resume()

     await journals.getByRole('button',{name:'Review settlement journals',exact:true}).click();await expect(journals).toContainText('UNCERTAIN')
     await automation.getByLabel('Automatic posting review reference',{exact:true}).fill('Synthetic pause of future automatic journals')
     await automation.getByRole('checkbox').check();await automation.getByRole('button',{name:'Disable automatic posting',exact:true}).click();await expect(automation.getByRole('status')).toHaveText('Automatic posting: DISABLED')
     await automation.getByText('Authorization history',{exact:true}).click();await automation.screenshot({path:'/tmp/payroll-settlement-automation-mobile.png'});expect(await automation.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
     await journals.getByRole('button',{name:'Recover replacement withdrawal journal',exact:true}).click();await expect(journals.getByText('Settlement journal: SYNCED.',{exact:true})).toBeVisible();expect(accounting.posts).toBe(1)
     await page.clock.install();await page.clock.fastForward(31000);await expect(workerHistory).toContainText('Current status: SYNCED');await page.clock.resume();await workerHistory.screenshot({path:'/tmp/payroll-settlement-worker-history-mobile.png'})
     const cases=page.getByRole('region',{name:'Stopped-check cases',exact:true})
     await cases.getByRole('button',{name:'Review stopped-check cases',exact:true}).click();await expect(cases.getByRole('status')).toHaveText('Case closed')
     accounting.journals.get('101').TxnDate='2026-09-19'
     await journals.getByRole('button',{name:'Recover replacement withdrawal journal',exact:true}).click();await expect(journals.getByText('Settlement journal: NEEDS REVIEW.',{exact:true})).toBeVisible()
     await cases.getByRole('button',{name:'Review stopped-check cases',exact:true}).click();await expect(cases.getByRole('status')).toHaveText('Case open')
     accounting.journals.get('101').TxnDate='2026-09-22'
     await journals.getByRole('button',{name:'Recover replacement withdrawal journal',exact:true}).click();await expect(journals.getByText('Settlement journal: SYNCED.',{exact:true})).toBeVisible()
     await cases.getByRole('button',{name:'Review stopped-check cases',exact:true}).click();await expect(cases.getByRole('status')).toHaveText('Case closed')
     await cases.getByText('Case history',{exact:true}).click()
     await cases.screenshot({path:'/tmp/payroll-stop-case-mobile.png'})
     await journals.screenshot({path:'/tmp/payroll-check-replacement-accounting-mobile.png'})
    }
    await view.screenshot({path:'/tmp/payroll-check-stop-mobile.png'});expect(stopPosts).toBe(1);expect(posts).toBe(3);expect(errors).toEqual([]);return
    }
   }
   const [file]=await Promise.all([page.waitForEvent('download'),view.getByRole('button',{name:'Download printable check',exact:true}).click()]);expect(file.suggestedFilename()).toMatch(/^payroll-check-\d+-\d+\.pdf$/)
   const handoff='Synthetic printed check handed to Monthly Benefits'
   await view.getByLabel('Printed check delivery reference',{exact:true}).fill(handoff)
   await view.getByLabel('I printed this retained check and handed it to this employee today.',{exact:true}).check();await view.getByRole('button',{name:'Record check delivery',exact:true}).click()
   await expect(view).toContainText(`Printed check delivery retained · ${handoff}`)
   await h.pool.query("INSERT INTO payroll_check_document_check(issue_id,action,status,metadata,created_by,automatic,created_at) SELECT issue_id,'RETAIN','RETAINED',metadata,created_by,automatic,now()-interval '16 minutes' FROM payroll_check_document_check ORDER BY id DESC LIMIT 1")
   await page.getByRole('button',{name:'Refresh payment authorization',exact:true}).click()
   expect((await api(`/runs/${run.id}/payment-authorization`)).check_deliveries[0].ready).toBe(false)
   await Promise.all([page.waitForResponse(r=>r.url().endsWith('/document')&&r.request().method()==='POST'&&r.status()===200),page.waitForResponse(r=>r.url().endsWith(`/runs/${run.id}/payment-authorization`)&&r.request().method()==='GET'&&r.status()===200),view.getByRole('button',{name:'Refresh check document',exact:true}).click()])
   expect((await api(`/runs/${run.id}/payment-authorization`)).check_deliveries[0].ready).toBe(true)
   await expect(view).toHaveAttribute('aria-busy','false')
   await expect(view).toContainText(`Printed check delivery retained · ${handoff}`)
   await expect(view.getByRole('button',{name:'Download printable check',exact:true})).toHaveCount(0)
   const closeout=page.getByLabel(/Check delivery reference for Monthly Benefits/);await expect(closeout).toHaveValue(handoff);await expect(closeout).toHaveAttribute('readonly','')
   await view.screenshot({path:'/tmp/payroll-check-delivery-mobile.png'})
   await page.getByLabel('Payroll closeout reference',{exact:true}).fill('Synthetic completed printed check payroll')
   await page.getByLabel('I confirm check deliveries and authorize closeout once bank evidence is verified for the approved payment date.',{exact:true}).check()
   await page.getByRole('button',{name:'Finalize paid payroll',exact:true}).click();await expect(page.getByRole('region',{name:'Authorize payroll payment plan',exact:true})).toContainText('Payroll finalized')
   expect((await h.pool.query('SELECT status FROM payroll_run WHERE id=$1',[run.id])).rows[0].status).toBe('FINALIZED')
   const qbo=await configureSettlementFixture(h,api,run.id,c.revision,(value:typeof accountingFetcher)=>{accountingFetcher=value})
   Object.assign(order!,{status:'completed',reconciliation_status:'reconciled',transaction_ids:[uuid(20)]})
   await view.getByRole('button',{name:'Recover check status',exact:true}).click();await expect(view.getByRole('status')).toHaveText('Check status: COMPLETED')
   const bank=page.getByRole('region',{name:'Payroll bank reconciliation',exact:true})
   await bank.getByRole('button',{name:'Review bank movements',exact:true}).click();await expect(bank).toContainText('Check · Bank withdrawal · 2026-09-21 · $59.70')
   const posting=bank.getByRole('region',{name:'QuickBooks settlement journals',exact:true})
   await posting.getByRole('button',{name:'Review settlement journals',exact:true}).click()
   await posting.getByLabel('Settlement posting reference',{exact:true}).fill('Synthetic cleared check bank journal')
   await posting.getByLabel('I reviewed these movements and accounts, verified they have not already been recorded manually or by bank rules, and authorize the selected QuickBooks journal.',{exact:true}).check()
   await posting.getByRole('button',{name:'Post check withdrawal journal',exact:true}).click();await expect(posting.getByRole('status')).toContainText('UNCERTAIN')
   await posting.getByRole('button',{name:'Recover check withdrawal journal',exact:true}).click();await expect(posting.getByRole('status')).toContainText('SYNCED')
   await expect(posting.getByText('SYNCED · QuickBooks journal 101',{exact:true})).toBeVisible()
   await posting.screenshot({path:'/tmp/payroll-check-accounting-mobile.png'});expect(await posting.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
   expect(qbo.posts).toBe(1)
   const adminReceipts=bank.getByRole('region',{name:'Check delivery receipts',exact:true})
   await adminReceipts.getByRole('button',{name:'Refresh check receipts',exact:true}).click();await expect(adminReceipts).toContainText('Bank clearance confirmed')
   const employeePage=await page.context().newPage()
   try{
    await employeePage.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','monthly-benefits-session'))
    await employeePage.route('**/api/payroll/employee/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
    await employeePage.setViewportSize({width:390,height:1000});await employeePage.goto('/tests/support/payroll.html?employee');await employeePage.getByRole('button',{name:'Pay statements',exact:true}).click()
    const receipts=employeePage.getByRole('region',{name:'Check delivery receipts',exact:true})
    await expect(receipts).toContainText('Bank clearance confirmed');await expect(receipts).toContainText('$59.70');await expect(receipts).toContainText('2026-09-21')
    await expect(receipts).not.toContainText(handoff)
    await expect(receipts.getByRole('button',{name:'Acknowledge check receipt',exact:true})).toBeDisabled()
    await receipts.getByLabel('I received this check for $59.70 dated 2026-09-18.',{exact:true}).check()
    await receipts.getByRole('button',{name:'Acknowledge check receipt',exact:true}).click()
    await expect(receipts).toContainText('Employee acknowledged receipt:')
    await adminReceipts.getByRole('button',{name:'Refresh check receipts',exact:true}).click();await expect(adminReceipts).toContainText('Employee acknowledged receipt:')
    const [adminCheckReceipt]=await Promise.all([page.waitForEvent('download'),adminReceipts.getByRole('button',{name:'Download check receipt',exact:true}).click()]);expect(adminCheckReceipt.suggestedFilename()).toMatch(/^payroll-check-receipt-.*\.html$/)
    expect((await h.pool.query('SELECT * FROM payroll_check_receipt_acknowledgment')).rowCount).toBe(1)

    await receipts.screenshot({path:'/tmp/payroll-check-employee-receipt-mobile.png'});expect(await receipts.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
    await employeePage.clock.install()
    Object.assign(order!,{status:'stopped'})
    await view.getByRole('button',{name:'Recover check status',exact:true}).click();await expect(view.getByRole('status')).toHaveText('Check status: STOPPED')
    await employeePage.clock.fastForward(31000);await expect(receipts).toContainText('Check evidence needs review')
   }finally{await employeePage.unrouteAll({behavior:'wait'});await employeePage.close()}

   expect(stopPosts).toBe(variant==='STOP_RELEASE'?1:0);expect((await h.pool.query('SELECT * FROM payroll_check_delivery')).rowCount).toBe(1);expect(posts).toBe(3);expect(errors).toEqual([]);return
  }
  await api('/check-configuration',{...setupBody,enabled:false,expectedRevision:setup.revision},'POST',201)
  await view.getByRole('button',{name:'Review check issuance',exact:true}).click();await expect(view.getByRole('status')).toHaveText('NEEDS REVIEW');await expect(view).toContainText('Record digital-check activation')
  expect(posts).toBe(2);expect(errors).toEqual([])
 }finally{tearingDown=true;cancellationDelay.release?.();try{if(!page.isClosed()){
  // Drain trailing UI reads while their proxy is still installed; removing it first races receipt/stop refreshes.
  await expect.poll(()=>pendingPayrollRequests.size===0&&Date.now()-lastPayrollActivity>=500,{timeout:5000}).toBe(true);await page.unrouteAll({behavior:'wait'});await page.close()
 }}finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}
})
