import {runSettlementAutomationSweep} from '../../backend/payroll/settlementAutomationScheduler.js'
import {runReplacementRecoverySweep} from '../../backend/payroll/paymentReplacementRecoveryScheduler.js'
import {runSettlementRecoverySweep} from '../../backend/payroll/settlementRecoveryScheduler.js'
import {configureSettlementFixture} from '../../backend/payroll/testing/settlementFixture.js'
import {runPaymentSubmissionSweep} from '../../backend/payroll/paymentSubmissionSchedule.js'
import {dispatchPayrollInstruction} from '../../backend/payroll/paymentDispatch.js'
import {loadRunPreview,payrollFingerprint} from '../../backend/payroll/registerRoutes.js'
import {runPaymentRecoverySweep} from '../../backend/payroll/paymentRecoveryScheduler.js'
import {addMixedPaymentEmployees} from '../../backend/payroll/testing/mixedPaymentEmployees.js'
import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {monthlyBenefitsFixture} from '../../backend/payroll/testing/monthlyBenefitsFixture.js'
for(const variant of ['UNCERTAIN','PREFLIGHT_BLOCKED','BANK_SETTLEMENT','REPEAT_REPLACEMENT','SCHEDULE'])test(`admin resolves provider evidence without payroll being marked paid (${variant})`,async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(60000);page.setDefaultTimeout(10000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
 const replacementOrders=new Map<string,Record<string,unknown>>()
 let replacementOrder:Record<string,unknown>|null=null,replacementPosts=0
 let order:Record<string,unknown>|null=null,posts=0,executing=false
 const fetcher=async(url:string,options:{method?:string;body?:string})=>{
  if(url.includes('/returns/')&&url.endsWith(id(95)))return {ok:true,status:200,json:async()=>({id:id(95),returnable_type:'payment_order',returnable_id:id(91),type:'ach',amount:replacementOrder?.amount,currency:'USD',live_mode:true,internal_account_id:id(2),status:'completed',reconciliation_status:'reconciled',transaction_id:id(96),transaction_line_item_id:id(97),code:'R03'})}
  if(url.includes('/transactions/')&&url.endsWith(id(96)))return {ok:true,status:200,json:async()=>({id:id(96),amount:replacementOrder?.amount,currency:'USD',live_mode:true,internal_account_id:id(2),direction:'credit',posted:true,as_of_date:'2026-09-22'})}
  if(url.includes('/transaction_line_items?')&&url.includes(id(97)))return {ok:true,status:200,json:async()=>[{id:id(97),amount:replacementOrder?.amount,live_mode:true,transaction_id:id(96),transactable_type:'return',transactable_id:id(95)}]}
  if(url.includes('/transactions/')&&url.endsWith(id(102)))return {ok:true,status:200,json:async()=>({id:id(102),live_mode:true,internal_account_id:id(2),currency:'USD',direction:'debit',posted:true,as_of_date:'2026-09-23',amount:replacementOrder?.amount})}
  if(url.includes('/transaction_line_items?')&&url.includes(id(102)))return {ok:true,status:200,json:async()=>[{id:id(103),transaction_id:id(102),transactable_type:'payment_order',transactable_id:id(101),live_mode:true,type:'originating',amount:replacementOrder?.amount}]}

  if(url.includes('/transactions/')&&url.endsWith(id(92)))return {ok:true,status:200,json:async()=>({id:id(92),live_mode:true,internal_account_id:id(2),currency:'USD',direction:'debit',posted:true,as_of_date:'2026-09-21',amount:replacementOrder?.amount})}
  if(url.includes('/transaction_line_items?')&&url.includes(id(92)))return {ok:true,status:200,json:async()=>[{id:id(93),transaction_id:id(92),transactable_type:'payment_order',transactable_id:id(91),live_mode:true,type:'originating',amount:replacementOrder?.amount}]}

  if(url.includes('/returns/'))return {ok:true,status:200,json:async()=>({id:id(10),returnable_type:'payment_order',returnable_id:id(5),type:'ach',amount:order?.amount,currency:'USD',live_mode:true,internal_account_id:id(2),status:'completed',reconciliation_status:'reconciled',transaction_id:id(8),transaction_line_item_id:id(9),code:'R03'})}
  if(url.includes('/transactions/')&&url.endsWith(id(8)))return {ok:true,status:200,json:async()=>({id:id(8),amount:Number(order?.amount)+10000,currency:'USD',live_mode:true,internal_account_id:id(2),direction:'credit',posted:true,as_of_date:'2026-09-20'})}
  if(url.includes('/transaction_line_items?')&&url.includes('id%5B%5D'))return {ok:true,status:200,json:async()=>[{id:id(9),amount:order?.amount,live_mode:true,transaction_id:id(8),transactable_type:'return',transactable_id:id(10)}]}
  if(url.includes('/transactions/'))return {ok:true,status:200,json:async()=>({id:id(6),live_mode:true,internal_account_id:id(2),currency:'USD',direction:'debit',posted:true,as_of_date:'2026-09-18',amount:Number(order?.amount)+10000})}
  if(url.includes('/transaction_line_items?'))return {ok:true,status:200,json:async()=>[{id:id(7),transaction_id:id(6),transactable_type:'payment_order',transactable_id:id(5),live_mode:true,type:'originating',amount:order?.amount}]}
  if(executing&&variant==='PREFLIGHT_BLOCKED'&&url.includes('/internal_accounts/'))return {ok:true,status:200,json:async()=>({id:id(2),currency:'USD',live_mode:false})}
  if(options.method==='POST'&&order){replacementPosts++;replacementOrder={...JSON.parse(options.body||'{}'),id:id(replacementPosts===1?91:101),live_mode:true,status:'processing',reconciliation_status:'unreconciled',transaction_ids:[]};replacementOrders.set(String(replacementOrder.external_id),replacementOrder);throw new Error('Synthetic replacement lost response')}
  if(url.includes('/payment_orders/')&&order&&!url.endsWith(String(order.external_id))){const found=replacementOrders.get(new URL(url).pathname.split('/').at(-1)!);return {ok:!!found,status:found?200:404,json:async()=>found}}
  if(options.method==='POST'){posts++;order={...JSON.parse(options.body||'{}'),id:id(5),live_mode:true,status:'processing',reconciliation_status:'unreconciled',transaction_ids:[]};throw new Error('Synthetic lost submission response')}
  if(url.includes('/payment_orders/'))return {ok:!!order,status:order?200:404,json:async()=>order}
  return {ok:true,status:200,json:async()=>url.includes('/internal_accounts/')?{id:id(2),currency:'USD',live_mode:true}:{id:id(3),counterparty_id:id(4),party_name:'Monthly Benefits',party_type:'individual',account_type:'checking',live_mode:true,verification_status:'verified',account_details:[{account_number_safe:'1234'}]}}
 }
 let quickbooksFetcher:((url:string,options:Record<string,unknown>)=>Promise<unknown>)|undefined
 let payrollClock=['SCHEDULE','BANK_SETTLEMENT','REPEAT_REPLACEMENT'].includes(variant)?'2026-09-10T12:00:00Z':'2051-01-01T12:00:00Z'
 const h=await createHarness({quickbooksFetcher:async(...args:Parameters<NonNullable<typeof quickbooksFetcher>>)=>{if(!quickbooksFetcher)throw new Error('Synthetic QuickBooks unavailable');return quickbooksFetcher(...args)},paymentFetcher:fetcher,payrollNow:()=>new Date(payrollClock)})
 try{
  const {api,employee,periods}=await monthlyBenefitsFixture(h)
  const connection=await api('/payment-connection',{organizationId:id(1),originatingAccountId:id(2),apiKey:'synthetic-browser-dispatch-key',mode:'LIVE',reference:'Synthetic employer payment account review',confirmed:true,expectedRevision:0},'POST',201);await api('/payment-connection/verify',{expectedRevision:connection.revision})
  const destination=await api(`/employees/${employee.id}/payment-destination`,{connectionId:connection.revision,accountId:id(3),reference:'Synthetic employee bank evidence',confirmed:true,expectedRevision:0},'POST',201),disclosure=await api('/payment-authorization',undefined,'GET',200,true)
  await api('/payment-authorization',{destinationId:destination.revision,expectedRevision:0,decision:'AUTHORIZE',signature:'Monthly Benefits',confirmed:true,fingerprint:disclosure.fingerprint},'POST',201,true)
  await h.pool.query("UPDATE payroll_onboarding_task SET response='{\"method\":\"DIRECT_DEPOSIT\"}' WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id])
  const mixed=['BANK_SETTLEMENT','REPEAT_REPLACEMENT'].includes(variant)?await addMixedPaymentEmployees(h,api):null
  const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
  const plan=await api(`/runs/${run.id}/payment-plan`);await api(`/runs/${run.id}/payment-authorization`,{fingerprint:plan.fingerprint,reference:'Synthetic approved browser payment plan',confirmed:true},'POST',201)
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'));await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Payroll runs',exact:true}).click();await page.getByRole('button',{name:'Open review',exact:true}).click()
  const view=page.getByRole('region',{name:'Authorize payroll payment plan',exact:true})
  await expect(view).toContainText('NOT STARTED')
  executing=true
  const submit=view.getByRole('button',{name:'Submit employee payment',exact:true})
  await expect(submit).toBeDisabled()
  if(['SCHEDULE','BANK_SETTLEMENT','REPEAT_REPLACEMENT'].includes(variant)){
   await view.getByText('Schedule this employee payment',{exact:true}).click();await view.getByLabel('Submission time (your device time)',{exact:true}).fill('2026-09-17T08:00')
   await view.getByLabel('Scheduling reference',{exact:true}).fill('Synthetic scheduled browser payment')
   await view.getByLabel('I authorize this employee’s displayed amount to be submitted at the selected time.',{exact:true}).check();await view.getByRole('button',{name:'Schedule employee payment',exact:true}).click()
   await expect(view).toContainText('Submission schedule: SCHEDULED');await expect(submit).toBeDisabled()
   await view.screenshot({path:'/tmp/payroll-submission-schedule-mobile.png'})
   const dependencies={dispatch:dispatchPayrollInstruction,fetcher,loadRunPreview,payrollFingerprint}
   expect((await runPaymentSubmissionSweep(h.pool,{...dependencies,now:()=>new Date('2026-09-16T23:00:00Z')})).attempted).toBe(0)
   expect((await runPaymentSubmissionSweep(h.pool,{...dependencies,now:()=>new Date('2026-09-17T23:00:00Z')})).attempted).toBe(1)
   await view.getByRole('button',{name:'Refresh payment authorization',exact:true}).click()
  }else{await view.getByLabel('I authorize sending the selected employee’s displayed amount on the retained payment date.',{exact:true}).check();await submit.click()}

  if(variant==='PREFLIGHT_BLOCKED'){
   await expect(view).toContainText('BLOCKED ACCOUNT VERIFICATION')
   await view.getByLabel('Payment decision reference',{exact:true}).fill('Synthetic cancellation after verified preflight block');await view.getByLabel('I confirm this authorization should be cancelled before payment submission.',{exact:true}).check();await view.getByRole('button',{name:'Cancel payment authorization',exact:true}).click();await expect(view.getByRole('status')).toContainText('Payment authorization cancelled')
   expect(posts).toBe(0);expect((await h.pool.query('SELECT * FROM payroll_payment_batch_cancellation')).rowCount).toBe(1);expect((await h.pool.query('SELECT * FROM payroll_payment_dispatch_attempt')).rowCount).toBe(1)
   await view.screenshot({path:'/tmp/payroll-payment-preflight-release-mobile.png'});return
  }
  await expect(view).toContainText('UNCERTAIN');await expect(view.getByRole('button',{name:'Cancel payment authorization',exact:true})).toHaveCount(0)
  if(['BANK_SETTLEMENT','REPEAT_REPLACEMENT'].includes(variant)&&order){
   payrollClock='2026-09-18T12:00:00Z'
   await expect(view.getByRole('button',{name:'Finalize paid payroll',exact:true})).toBeDisabled()
   await view.getByLabel(/Check delivery reference for Check Employee/).fill('Synthetic check 2001 delivered in person')
   await view.getByLabel('Payroll closeout reference',{exact:true}).fill('Synthetic bank backed payroll closeout')
   await view.getByLabel('I confirm check deliveries and authorize closeout once bank evidence is verified for the approved payment date.',{exact:true}).check()
   await view.getByRole('button',{name:'Close automatically when ready',exact:true}).click();await expect(view).toContainText('Automatic closeout is scheduled.')
   const pending=await runPaymentRecoverySweep(h.pool,{fetcher,now:()=>new Date(payrollClock)});expect(pending.checked).toBe(1);expect(pending.closeout.finalized).toBe(0)
   expect((await h.pool.query('SELECT status FROM payroll_run WHERE id=$1',[run.id])).rows[0].status).toBe('APPROVED')
   order.status='completed';order.reconciliation_status='reconciled';order.transaction_ids=[id(6)]
   await h.pool.query("INSERT INTO payroll_payment_recovery_check(attempt_id,created_at) SELECT id,clock_timestamp()-interval '11 minutes' FROM payroll_payment_dispatch_attempt")
   const paid=await runPaymentRecoverySweep(h.pool,{fetcher,now:()=>new Date(payrollClock)});expect(paid.checked).toBe(1);expect(paid.closeout.finalized).toBe(1);expect(posts).toBe(1)
   await view.getByRole('button',{name:'Refresh payment authorization',exact:true}).click();await expect(view).toContainText('Payroll finalized. Employee statements and leave entries are retained.')
   expect(mixed).toBeTruthy();const statements=(await h.pool.query('SELECT net_pay_cents,statement_snapshot FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows;expect(statements).toHaveLength(3);expect(statements.every(r=>r.statement_snapshot.employeeName)).toBe(true);expect(statements.some(r=>Number(r.net_pay_cents)===0)).toBe(true)
   await view.getByText('Closeout evidence',{exact:true}).click();await expect(view).toContainText('Synthetic check 2001 delivered in person')
   await view.screenshot({path:'/tmp/payroll-mixed-closeout-mobile.png'})
   await page.reload();await page.getByRole('button',{name:'Payroll runs',exact:true}).click();await page.getByRole('button',{name:'Open review',exact:true}).click();await expect(view).toContainText('Payroll finalized.')
   order.status='returned';order.current_return={id:id(10)}
   await h.pool.query("INSERT INTO payroll_payment_recovery_check(attempt_id,created_at) SELECT id,clock_timestamp()-interval '2 days' FROM payroll_payment_dispatch_attempt")
   expect((await runPaymentRecoverySweep(h.pool,{fetcher})).checked).toBe(1)
   await view.getByRole('button',{name:'Refresh payment authorization',exact:true}).click();await expect(view).toContainText('Bank evidence: EXCEPTION');await expect(view).toContainText('Returned funds: BANK CREDIT POSTED');await view.screenshot({path:'/tmp/payroll-return-credit-mobile.png'});await expect(view).not.toContainText('BANK POSTED');expect(posts).toBe(1)
   const accounting=view.getByRole('region',{name:'Payroll bank reconciliation',exact:true});await accounting.getByRole('button',{name:'Review bank movements',exact:true}).click();await expect(accounting).toContainText('EVIDENCE READY');await expect(accounting).toContainText('Net bank outflow: $0.00');await expect(accounting.getByRole('listitem')).toHaveCount(2);await accounting.screenshot({path:'/tmp/payroll-bank-accounting-mobile.png'})
   const crossScope=await fetch(`${h.url}/api/admin/payroll/runs/${run.id}/payment-accounting`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});expect(crossScope.status).toBe(404)
   const replacements=view.getByRole('region',{name:'Returned-payment replacement review',exact:true})
   await replacements.getByRole('button',{name:'Review returned payments',exact:true}).click()
   const replacement=replacements.getByRole('article',{name:'Replacement review for Monthly Benefits',exact:true})
   await expect(replacement).toContainText('$59.70');await expect(replacement.getByRole('button',{name:'Retain replacement review',exact:true})).toBeDisabled()
   await replacement.getByLabel('Proposed replacement date',{exact:true}).fill('2026-09-21')
   await replacement.getByRole('combobox',{name:'Wage and tax reporting review',exact:true}).selectOption('CORRECTION_REQUIRED')
   await replacement.getByLabel('Unpaid-wage review reference',{exact:true}).fill('Synthetic employee confirms returned net amount remains owed')
   await replacement.getByRole('textbox',{name:'Tax-date review reference',exact:true}).fill('Synthetic wage date requires tax reporting review')
   await replacement.getByLabel('I confirmed this net amount remains owed and no other replacement payment has been made.',{exact:true}).check()
   await replacement.getByLabel('I reviewed the proposed date, payment choice and wage/tax treatment with the retained evidence.',{exact:true}).check()
   await replacement.getByRole('button',{name:'Retain replacement review',exact:true}).click();await expect(replacement.getByRole('status')).toContainText('TAX CORRECTION REQUIRED')
   await replacement.getByText('Replacement review history',{exact:true}).click();await expect(replacement).toContainText('Synthetic wage date requires tax reporting review')
   expect((await h.pool.query('SELECT * FROM payroll_payment_replacement_review')).rowCount).toBe(1);expect(posts).toBe(1)
   await replacements.screenshot({path:'/tmp/payroll-replacement-review-mobile.png'})
   const replacementAuthorization=replacement.getByRole('region',{name:'Replacement payment authorization',exact:true})
   await replacementAuthorization.getByRole('button',{name:'Review replacement authorization',exact:true}).click();await expect(replacementAuthorization).toContainText('Resolve the current replacement review')
   await replacement.getByRole('combobox',{name:'Wage and tax reporting review',exact:true}).selectOption('ORIGINAL_PAYROLL_RETAINED')
   await replacement.getByRole('textbox',{name:'Tax-date review reference',exact:true}).fill('Synthetic reviewed evidence confirms original wage reporting remains valid')
   await replacement.getByLabel('I confirmed this net amount remains owed and no other replacement payment has been made.',{exact:true}).check()
   await replacement.getByLabel('I reviewed the proposed date, payment choice and wage/tax treatment with the retained evidence.',{exact:true}).check()
   await replacement.getByRole('button',{name:'Retain replacement review',exact:true}).click();await expect(replacement.getByRole('status')).toContainText('REVIEW RETAINED')
   await replacementAuthorization.getByRole('button',{name:'Review replacement authorization',exact:true}).click()
   await replacementAuthorization.getByLabel('Replacement authorization reference',{exact:true}).fill('Synthetic reviewed exact replacement amount and date')
   await replacementAuthorization.getByLabel('Return resolution reference',{exact:true}).fill('Synthetic recipient account and return cause reviewed')
   await replacementAuthorization.getByLabel('I reviewed how the return was resolved and authorize the exact replacement amount, date and current payment destination.',{exact:true}).check()
   await replacementAuthorization.getByRole('button',{name:'Authorize replacement payment',exact:true}).click();await expect(replacementAuthorization.getByRole('status')).toHaveText('AUTHORIZED');await expect(replacementAuthorization).toContainText('checking ending 1234');expect(posts).toBe(1)
   await replacementAuthorization.getByLabel('Replacement cancellation reference',{exact:true}).fill('Synthetic cancellation before replacement dispatch')
   await replacementAuthorization.getByLabel('Cancel this replacement authorization before payment execution.',{exact:true}).check()
   await replacementAuthorization.getByRole('button',{name:'Cancel replacement authorization',exact:true}).click();await expect(replacementAuthorization.getByRole('status')).toHaveText('CANCELLED');expect(posts).toBe(1)
   expect((await h.pool.query('SELECT * FROM payroll_payment_replacement_attempt')).rowCount).toBe(0)
   await replacementAuthorization.screenshot({path:'/tmp/payroll-replacement-authorization-mobile.png'})
   await replacementAuthorization.getByLabel('I reviewed how the return was resolved and authorize the exact replacement amount, date and current payment destination.',{exact:true}).check()
   await replacementAuthorization.getByRole('button',{name:'Authorize replacement payment',exact:true}).click();await expect(replacementAuthorization.getByText('AUTHORIZED',{exact:true})).toBeVisible()
   await replacementAuthorization.getByLabel('I confirm the retained replacement amount, date and destination and authorize sending this payment.',{exact:true}).check()
   await replacementAuthorization.getByRole('button',{name:'Send replacement payment',exact:true}).click();await expect(replacementAuthorization).toContainText('Provider: UNCERTAIN');expect(replacementPosts).toBe(1)
   expect((await runReplacementRecoverySweep(h.pool,{fetcher,now:()=>new Date('2052-01-01T12:00:00Z')})).checked).toBe(1)
   await replacementAuthorization.getByRole('button',{name:'Review replacement authorization',exact:true}).click();await expect(replacementAuthorization).toContainText('Provider: PROCESSING');expect(replacementPosts).toBe(1);expect(posts).toBe(1)
   await replacementAuthorization.getByRole('button',{name:'Recover replacement payment status',exact:true}).click();expect(replacementPosts).toBe(1)
   await expect(replacementAuthorization.getByRole('button',{name:'Cancel replacement authorization',exact:true})).toHaveCount(0)
   await replacementAuthorization.screenshot({path:'/tmp/payroll-replacement-dispatch-mobile.png'})
   Object.assign(replacementOrder!,{status:'completed',reconciliation_status:'reconciled',transaction_ids:[id(92)]})
   expect((await runReplacementRecoverySweep(h.pool,{fetcher,now:()=>new Date('2052-01-01T12:11:00Z')})).checked).toBe(1)
   const receipts=view.getByRole('region',{name:'Replacement payment receipts',exact:true})
   await receipts.getByRole('button',{name:'Refresh replacement receipts',exact:true}).click();await expect(receipts).toContainText('Bank evidence confirmed');await expect(receipts).toContainText('checking ending 1234');await receipts.screenshot({path:'/tmp/payroll-replacement-receipt-admin.png'})
   const [adminReceiptFile]=await Promise.all([page.waitForEvent('download'),receipts.getByRole('button',{name:'Download replacement receipt',exact:true}).click()]);expect(adminReceiptFile.suggestedFilename()).toMatch(/^payroll-replacement-receipt-.*\.html$/)
   const employeePage=await page.context().newPage()
   try{
    await employeePage.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','monthly-benefits-session'))
    await employeePage.route('**/api/payroll/employee/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
    await employeePage.setViewportSize({width:390,height:1000});await employeePage.goto('/tests/support/payroll.html?employee');await employeePage.getByRole('button',{name:'Pay statements',exact:true}).click()
    const employeeReceipts=employeePage.getByRole('region',{name:'Replacement payment receipts',exact:true});await expect(employeeReceipts).toContainText('Bank evidence confirmed');await expect(employeeReceipts).toContainText('$59.70');await employeeReceipts.screenshot({path:'/tmp/payroll-replacement-receipt-employee.png'})
   }finally{await employeePage.close()}



   const qbo=await configureSettlementFixture(h,api,run.id,connection.revision,(value:NonNullable<typeof quickbooksFetcher>)=>{quickbooksFetcher=value})
   const posting=view.getByRole('region',{name:'QuickBooks settlement journals',exact:true});await posting.getByRole('button',{name:'Review settlement journals',exact:true}).click()
   await expect(posting.getByRole('button',{name:'Post returned-credit journal',exact:true})).toBeDisabled()
   await expect(posting.getByRole('button',{name:'Post replacement withdrawal journal',exact:true})).toBeDisabled()
   await posting.getByLabel('Settlement posting reference',{exact:true}).fill('Synthetic reviewed bank journals and returns')
   if(variant==='BANK_SETTLEMENT'){
    const automationPath=`/runs/${run.id}/payment-accounting/automation`,state=await api(automationPath),body={enabled:true,expectedRevision:state.revision,fingerprint:state.fingerprint,reference:'Synthetic ordinary payroll automatic accounting',confirmed:true,noOtherPostingConfirmed:true}
    await api(automationPath,body)
    expect((await runSettlementAutomationSweep(h.pool,{fetcher:quickbooksFetcher,now:()=>new Date('2051-01-01T12:00:00Z')})).posted).toBe(1)
    const enabled=await api(automationPath);await api(automationPath,{...body,enabled:false,expectedRevision:enabled.revision,fingerprint:enabled.fingerprint})
    await posting.getByRole('button',{name:'Review settlement journals',exact:true}).click();await expect(posting).toContainText('UNCERTAIN')
   }else{await posting.getByLabel('I reviewed these movements and accounts, verified they have not already been recorded manually or by bank rules, and authorize the selected QuickBooks journal.',{exact:true}).check();await posting.getByRole('button',{name:'Post withdrawal journal',exact:true}).click();await expect(posting.getByRole('status')).toContainText('UNCERTAIN')}
   expect(qbo.posts).toBe(1)
   expect((await runSettlementRecoverySweep(h.pool,{fetcher:quickbooksFetcher,now:()=>new Date('2052-01-01T12:00:00Z')})).checked).toBe(1)
   await posting.getByRole('button',{name:'Review settlement journals',exact:true}).click();await expect(posting.getByText('SYNCED · QuickBooks journal 101',{exact:true})).toBeVisible();expect(qbo.posts).toBe(1)
   await posting.getByLabel('I reviewed these movements and accounts, verified they have not already been recorded manually or by bank rules, and authorize the selected QuickBooks journal.',{exact:true}).check();await posting.getByRole('button',{name:'Post returned-credit journal',exact:true}).click();await expect(posting.getByRole('status')).toContainText('SYNCED');expect(qbo.posts).toBe(2)
   await posting.getByRole('button',{name:'Recover withdrawal journal',exact:true}).click();await expect(posting.getByRole('status')).toContainText('SYNCED');expect(qbo.posts).toBe(2)
   expect((await h.pool.query('SELECT * FROM payroll_settlement_journal')).rowCount).toBe(2);expect((await h.pool.query('SELECT * FROM payroll_settlement_journal_claim')).rowCount).toBe(2);await posting.screenshot({path:'/tmp/payroll-settlement-posting-mobile.png'})
   await posting.getByLabel('I reviewed these movements and accounts, verified they have not already been recorded manually or by bank rules, and authorize the selected QuickBooks journal.',{exact:true}).check()
   await posting.getByRole('button',{name:'Post replacement withdrawal journal',exact:true}).click();await expect(posting.getByText('SYNCED · QuickBooks journal 103',{exact:true})).toBeVisible();expect(qbo.posts).toBe(3)
   await Promise.all([page.waitForResponse(response=>response.request().method()==='GET'&&new URL(response.url()).pathname.endsWith('/payment-accounting/posting')),posting.getByRole('button',{name:'Recover replacement withdrawal journal',exact:true}).click()]);await expect(posting.getByText('SYNCED · QuickBooks journal 103',{exact:true})).toBeVisible();expect(qbo.posts).toBe(3);await posting.screenshot({path:'/tmp/payroll-replacement-accounting-mobile.png'})


   const cases=view.getByRole('region',{name:'Returned-payment cases',exact:true})
   await cases.getByRole('button',{name:'Review returned-payment cases',exact:true}).click();await expect(cases.getByRole('status')).toHaveText('Case closed')
   await cases.screenshot({path:'/tmp/payroll-return-case-closed.png'})
   if(variant==='REPEAT_REPLACEMENT'){
    Object.assign(replacementOrder!,{status:'returned',current_return:{id:id(95)}})
    expect((await runReplacementRecoverySweep(h.pool,{fetcher,now:()=>new Date('2052-01-02T12:12:00Z')})).checked).toBe(1)
    await view.getByRole('button',{name:'Review returned payments',exact:true}).click()
    await expect(replacement).toContainText('Returned again: 2026-09-22')
    await replacement.getByRole('textbox',{name:'Proposed replacement date',exact:true}).fill('2026-09-23')
    await replacement.getByRole('textbox',{name:'Tax-date review reference',exact:true}).fill('Synthetic second returned payment wage reporting review')
    await replacement.getByLabel('I confirmed this net amount remains owed and no other replacement payment has been made.',{exact:true}).check()
    await replacement.getByLabel('I reviewed the proposed date, payment choice and wage/tax treatment with the retained evidence.',{exact:true}).check()
    await replacement.getByRole('button',{name:'Retain replacement review',exact:true}).click();await expect(replacement.getByRole('status')).toContainText('REVIEW RETAINED')
    await replacementAuthorization.getByRole('button',{name:'Review replacement authorization',exact:true}).click()
    await replacementAuthorization.getByLabel('Replacement authorization reference',{exact:true}).fill('Synthetic second replacement authorization')
    await replacementAuthorization.getByLabel('Return resolution reference',{exact:true}).fill('Synthetic repeated return resolution and employee account review')
    await replacementAuthorization.getByLabel('I reviewed how the return was resolved and authorize the exact replacement amount, date and current payment destination.',{exact:true}).check()
    await replacementAuthorization.getByRole('button',{name:'Authorize next replacement payment',exact:true}).click();await expect(replacementAuthorization.getByText('AUTHORIZED',{exact:true})).toBeVisible()
    await replacementAuthorization.getByLabel('I confirm the retained replacement amount, date and destination and authorize sending this payment.',{exact:true}).check()
    await replacementAuthorization.getByRole('button',{name:'Send replacement payment',exact:true}).click();await expect(replacementAuthorization).toContainText('Provider: UNCERTAIN');expect(replacementPosts).toBe(2)
    Object.assign(replacementOrder!,{status:'completed',reconciliation_status:'reconciled',transaction_ids:[id(102)]})
    await Promise.all([page.waitForResponse(response=>response.request().method()==='GET'&&new URL(response.url()).pathname.endsWith('/authorization')),replacementAuthorization.getByRole('button',{name:'Recover replacement payment status',exact:true}).click()]);await expect(replacementAuthorization).toContainText('BANK_POSTED');expect(replacementPosts).toBe(2)
    await posting.getByRole('button',{name:'Review settlement journals',exact:true}).click();await expect(posting.getByRole('button',{name:'Post replacement withdrawal journal',exact:true})).toBeDisabled()
    await posting.getByLabel('I reviewed these movements and accounts, verified they have not already been recorded manually or by bank rules, and authorize the selected QuickBooks journal.',{exact:true}).check()
    await posting.getByRole('button',{name:'Post replacement returned-credit journal',exact:true}).click();await expect(posting.getByText('SYNCED · QuickBooks journal 104',{exact:true})).toBeVisible()
    await posting.getByLabel('I reviewed these movements and accounts, verified they have not already been recorded manually or by bank rules, and authorize the selected QuickBooks journal.',{exact:true}).check()
    await posting.getByRole('button',{name:'Post replacement withdrawal journal',exact:true}).click();await expect(posting.getByText('SYNCED · QuickBooks journal 105',{exact:true})).toBeVisible();expect(qbo.posts).toBe(5)
    await cases.getByRole('button',{name:'Review returned-payment cases',exact:true}).click();await expect(cases.getByRole('status')).toHaveText('Case closed')
    await replacementAuthorization.screenshot({path:'/tmp/payroll-repeat-replacement-mobile.png'})
    return
   }
   Object.assign(replacementOrder!,{effective_date:'2026-09-22'})
   expect((await runReplacementRecoverySweep(h.pool,{fetcher,now:()=>new Date('2052-01-02T12:12:00Z')})).checked).toBe(1)
   await cases.getByRole('button',{name:'Review returned-payment cases',exact:true}).click();await expect(cases.getByRole('status')).toHaveText('Case open');await cases.screenshot({path:'/tmp/payroll-return-case-open.png'})
   expect((await h.pool.query('SELECT status FROM payroll_run WHERE id=$1',[run.id])).rows[0].status).toBe('FINALIZED');await page.reload();await page.getByRole('button',{name:'Overview',exact:true}).click();await expect(page.getByText('Payroll payment needs review',{exact:true})).toBeVisible();await expect(page.getByText(/Returned-payment case:/)).toBeVisible();return
  }
  if(order)order.effective_date='2026-09-19'
  await view.getByRole('button',{name:'Recover provider status',exact:true}).click();await expect(view).toContainText('PROCESSING');await expect(view).toContainText('recovery');expect(posts).toBe(1);await expect(view).toContainText('Provider payment date differs from the approved date');await expect(view).toContainText('Provider reconciliation: unreconciled')
  expect((await h.pool.query('SELECT status FROM payroll_run WHERE id=$1',[run.id])).rows[0].status).toBe('APPROVED');await view.screenshot({path:'/tmp/payroll-payment-dispatch-mobile.png'})
 }finally{await page.unrouteAll({behavior:'wait'}).catch(()=>{});await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
