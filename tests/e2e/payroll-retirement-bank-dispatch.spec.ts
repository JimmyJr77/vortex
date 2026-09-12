import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {retirementBankProvider} from '../../backend/payroll/testing/retirementBankProvider.js'
import {retirementRemittanceAuthorizationFixture} from '../../backend/payroll/testing/retirementRemittanceAuthorizationFixture.js'
import {recoverRetirementRemittances} from '../../backend/payroll/retirementRemittanceRecovery.js'
test('retirement bank payment recovers an uncertain send, refreshes settlement and keeps allocation unverified',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(90000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');let clock=new Date('2026-09-19T12:00:00Z')
 const provider=retirementBankProvider(),h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>clock,retirementNow:()=>new Date('2026-09-11T12:00:00Z')}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const {api,path,body}=await retirementRemittanceAuthorizationFixture(h),a=await api(path,body)
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'));await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const bank=page.getByRole('region',{name:`Retirement bank payment ${a.id}`,exact:true})
  await bank.getByRole('textbox',{name:'Trustee bank-credit and allocation workflow reference',exact:true}).fill('Reviewed trustee CCD credit instructions without addenda and separate allocation workflow with no extra debit')
  await bank.getByRole('checkbox').nth(0).check();await bank.getByRole('checkbox').nth(1).check();provider.loseResponse(true)
  await bank.getByRole('button',{name:'Submit authorized retirement bank payment',exact:true}).click();await expect(bank).toContainText('Provider status: UNCERTAIN');expect(provider.posts()).toBe(1)
  await bank.getByRole('button',{name:'Recover retirement bank payment',exact:true}).click();await expect(bank).toContainText('Provider status: SENT');expect(provider.posts()).toBe(1)
  provider.complete();clock=new Date('2026-09-22T16:00:00Z');expect((await recoverRetirementRemittances(h.pool,1,{fetcher:provider.fetcher,now:clock})).bankPosted).toBe(1)
  await expect(bank).toContainText('Bank settlement: BANK POSTED',{timeout:40000});await expect(bank).toContainText('Review contribution reconciliation')
  await page.setViewportSize({width:390,height:1100});await bank.screenshot({path:'/tmp/payroll-retirement-bank-dispatch-mobile.png'})
  provider.returnedCredit();await bank.getByRole('button',{name:'Recover retirement bank payment',exact:true}).click();await expect(bank).toContainText('Provider status: RETURNED');await expect(bank).toContainText('Bank settlement: EXCEPTION');await expect(bank).toContainText('Verified bank credit: $14.00');provider.creditValid(false);await bank.getByRole('button',{name:'Recover retirement bank payment',exact:true}).click();await expect(bank).toContainText('Returned funds: NEEDS REVIEW');await expect(bank).not.toContainText('Verified bank credit:');expect(provider.posts()).toBe(1);expect(errors).toEqual([])
  await bank.screenshot({path:'/tmp/payroll-retirement-return-credit-mobile.png'})
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}
})
