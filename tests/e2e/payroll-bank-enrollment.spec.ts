import {runBankEnrollmentRecoverySweep} from '../../backend/payroll/bankEnrollmentRecoveryScheduler.js'
import {test,expect} from '@playwright/test'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {monthlyBenefitsFixture} from '../../backend/payroll/testing/monthlyBenefitsFixture.js'
test('employee enrolls a bank, recovers verification, and separately authorizes wages on mobile',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(60000)
 const previous=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 let counterparty:Record<string,unknown>|null=null,account:Record<string,unknown>|null=null,posts=0
 const fetcher=async(url:string,options:{method?:string;body?:string})=>{
  const path=new URL(url).pathname,body=options.body?JSON.parse(options.body):null
  if(options.method==='POST'){
   posts++
   if(path.endsWith('/counterparties')){counterparty={...body,id:randomUUID(),live_mode:false};return {ok:true,json:async()=>counterparty}}
   if(path.endsWith('/external_accounts')){account={...body,id:randomUUID(),live_mode:false,verification_status:'unverified',account_details:[{account_number_safe:'6789'}]};return {ok:true,json:async()=>account}}
   if(account&&path.endsWith('/verify')){account.verification_status='pending_verification';throw new Error('Synthetic lost verification response')}
   if(account&&path.endsWith('/complete_verification')){expect(body.amounts).toEqual([11,22]);account.verification_status='verified';return {ok:true,json:async()=>account}}
   throw new Error('Unexpected synthetic request')
  }
  if(path.includes('/internal_accounts/'))return {ok:true,json:async()=>({id:path.split('/').at(-1),currency:'USD',live_mode:false})}
  return {ok:true,json:async()=>path.endsWith('/counterparties')?(counterparty?[counterparty]:[]):path.endsWith('/external_accounts')?(account?[account]:[]):account}
 }
 const h=await createHarness({paymentFetcher:fetcher})
 try{
  const {api}=await monthlyBenefitsFixture(h)
  await api('/payment-connection',{organizationId:randomUUID(),originatingAccountId:randomUUID(),apiKey:'synthetic-browser-bank-key',mode:'TEST',reference:'Synthetic browser bank enrollment',confirmed:true,expectedRevision:0},'POST',201)
  await page.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','monthly-benefits-session'))
  await page.route('**/api/payroll/employee/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.clock.install();await page.setViewportSize({width:390,height:1000});await page.goto('/tests/support/payroll.html?employee');await page.getByRole('button',{name:'Onboarding',exact:true}).click()
  const view=page.getByRole('region',{name:'Enroll your bank account',exact:true})
  await view.getByRole('button',{name:'Review bank enrollment',exact:true}).click();await view.getByText('Enter your bank account',{exact:true}).click()
  await view.getByLabel('Account holder name',{exact:true}).fill('Monthly Benefits')
  await view.getByLabel('Nine-digit routing number',{exact:true}).fill('021000021')
  await view.getByLabel('Account number',{exact:true}).fill('000123456789');await view.getByLabel('Confirm account number',{exact:true}).fill('000123456780')
  await view.getByLabel('Verification consent signature',{exact:true}).fill('Monthly Benefits')
  await view.getByLabel('I agree to the verification deposits and recovery debits described above.',{exact:true}).check()
  await expect(view.getByRole('button',{name:'Save bank enrollment',exact:true})).toBeDisabled()
  await view.getByLabel('Confirm account number',{exact:true}).fill('000123456789');await view.getByLabel('I agree to the verification deposits and recovery debits described above.',{exact:true}).check()
  await view.getByRole('button',{name:'Save bank enrollment',exact:true}).click();await expect(view).toContainText('checking ending 6789');await expect(view.getByLabel('Account number',{exact:true})).toHaveValue('')
  await view.getByRole('button',{name:'Continue account verification',exact:true}).click();await expect(view.getByRole('button',{name:'Review bank enrollment',exact:true})).toBeEnabled()
  await expect(view).toContainText('Bank verification: UNCERTAIN');expect(posts).toBe(3)
  expect((await runBankEnrollmentRecoverySweep(h.pool,{fetcher,now:()=>new Date('2052-01-01T12:00:00Z')})).checked).toBe(1)
  await page.clock.fastForward(31000);await expect(view).toContainText('Bank verification: AWAITING AMOUNTS');expect(posts).toBe(3)
  await view.getByText('Restart verification for this account',{exact:true}).click()
  await view.getByLabel('New verification signature',{exact:true}).fill('Monthly Benefits')
  const restartConsent=view.getByLabel('I authorize a new verification cycle for this saved account, including new small deposits and their recovery debits.',{exact:true})
  await expect(view.getByRole('button',{name:'Prepare new verification',exact:true})).toBeDisabled();await restartConsent.check()
  await view.getByRole('button',{name:'Prepare new verification',exact:true}).click();await expect(view.getByRole('alert')).toContainText('provider has not confirmed')
  if(account)account.verification_status='unverified'
  await restartConsent.check();await view.getByRole('button',{name:'Prepare new verification',exact:true}).click();await expect(view).toContainText('New verification cycle prepared');expect(posts).toBe(3)
  await view.getByRole('button',{name:'Continue account verification',exact:true}).click();await expect(view).toContainText('Bank verification: UNCERTAIN');expect(posts).toBe(4)
  await view.getByRole('button',{name:'Refresh verification status',exact:true}).click();await expect(view).toContainText('Bank verification: AWAITING AMOUNTS');expect(posts).toBe(4)
  await view.getByLabel('First deposit in cents',{exact:true}).fill('11');await view.getByLabel('Second deposit in cents',{exact:true}).fill('22');await view.getByRole('button',{name:'Verify deposit amounts',exact:true}).click()
  await expect(view).toContainText('Bank verification: VERIFIED');expect(posts).toBe(5)
  await view.getByLabel(/Use this verified account for the separate wage authorization below/).check();await view.getByRole('button',{name:'Link verified account',exact:true}).click();await expect(view).toContainText('Account linked for wage authorization.')
  const authorization=page.getByRole('region',{name:'Your direct deposit authorization',exact:true})
  await authorization.getByRole('button',{name:'Review direct deposit account',exact:true}).click();await expect(authorization).toContainText('AUTHORIZATION REQUIRED')
  await authorization.getByLabel('Your name as signature',{exact:true}).fill('Monthly Benefits');await authorization.getByLabel('I reviewed this account and agree to the authorization above.',{exact:true}).check();await authorization.getByRole('button',{name:'Authorize direct deposit',exact:true}).click();await expect(authorization).toContainText('Direct-deposit authorization recorded.')
  await page.reload();await page.getByRole('button',{name:'Onboarding',exact:true}).click();await view.getByRole('button',{name:'Review bank enrollment',exact:true}).click();await expect(view).toContainText('Bank verification: VERIFIED');await view.screenshot({path:'/tmp/payroll-bank-enrollment-mobile.png'})
  await view.getByText('Enter a replacement bank account',{exact:true}).click()
  await view.getByLabel('Account holder name',{exact:true}).fill('Monthly Benefits')
  await view.getByLabel('Nine-digit routing number',{exact:true}).fill('021000021')
  await view.getByLabel('Account number',{exact:true}).fill('000987654321');await view.getByLabel('Confirm account number',{exact:true}).fill('000987654321')
  await view.getByLabel('Verification consent signature',{exact:true}).fill('Monthly Benefits')
  await view.getByLabel('I agree to the verification deposits and recovery debits described above.',{exact:true}).check();await view.getByRole('button',{name:'Save bank enrollment',exact:true}).click()
  await expect(view).toContainText('Bank verification: SAVED')
  const history=view.getByRole('region',{name:'Bank enrollment history',exact:true})
  await history.getByRole('button',{name:'Review enrollment history',exact:true}).click();await expect(history).toContainText('Previous enrollment');await expect(history).toContainText('checking ending 4321')
  await history.getByRole('button',{name:'Check verification deposits status',exact:true}).first().click();await expect(history.getByRole('status')).toContainText('Status checked: verified');expect(posts).toBe(5)
  await history.screenshot({path:'/tmp/payroll-bank-enrollment-history-employee-mobile.png'})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click()
  const adminHistory=page.getByRole('region',{name:'Employee direct deposit account',exact:true}).getByRole('region',{name:'Bank enrollment history',exact:true})
  await adminHistory.getByRole('button',{name:'Review enrollment history',exact:true}).click();await expect(adminHistory).toContainText('Previous enrollment')
  await adminHistory.getByRole('button',{name:'Check bank account status',exact:true}).first().click();await expect(adminHistory.getByRole('status')).toContainText('Status checked: verified')
  await adminHistory.getByRole('button',{name:'Check account holder status',exact:true}).first().click();await expect(adminHistory.getByRole('status')).toContainText('Status checked: RECORDED');await expect(adminHistory).toContainText('VERIFIED · 1 verification attempts')
  await adminHistory.screenshot({path:'/tmp/payroll-bank-enrollment-history-admin-mobile.png'})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(errors).toEqual([]);expect(posts).toBe(5)
 }finally{await page.unrouteAll({behavior:'wait'});await h.close();if(previous===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=previous}
})
