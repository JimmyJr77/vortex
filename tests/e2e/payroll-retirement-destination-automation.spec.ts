import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {retirementDestinationProvider} from '../../backend/payroll/testing/retirementDestinationProvider.js'
import {retirementRemittanceFixture} from '../../backend/payroll/testing/retirementRemittanceFixture.js'
import {checkRetirementDestinations} from '../../backend/payroll/retirementDestinationAutomation.js'
test('automatic retirement account checks update the admin view and invalidate remittance review',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher,retirementNow:()=>new Date('2026-09-11T12:00:00Z')}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const {run}=await retirementRemittanceFixture(h),now=new Date(Date.now()+25*3600000)
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'));await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const destination=page.getByRole('region',{name:'Retirement remittance destination standard',exact:true}),preview=page.getByRole('region',{name:`Retirement remittance preview ${run.id} standard`,exact:true}),source=page.getByRole('region',{name:'Retirement contribution reconciliation',exact:true})
  await preview.getByRole('button',{name:'Preview remittance for standard',exact:true}).click();await expect(preview).toContainText('Proposed remittance $14.00')
  provider.change(true);expect((await checkRetirementDestinations(h.pool,1,{fetcher:provider.fetcher,now})).needsReview).toBe(1)
  await expect(destination).toContainText('Last automatic account check: CHANGED',{timeout:40000});await expect(source).toContainText('Destination review: ACCOUNT REVIEW REQUIRED');await expect(preview).not.toContainText('Proposed remittance')
  expect((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key='retirement-destination-standard'")).rows[0].status).toBe('OPEN')
  await page.setViewportSize({width:390,height:1100});await destination.screenshot({path:'/tmp/payroll-retirement-destination-automation-mobile.png'})
  provider.change(false);expect((await checkRetirementDestinations(h.pool,1,{fetcher:provider.fetcher,now:new Date(+now+300000)})).verified).toBe(1)
  await expect(destination).toContainText('Last automatic account check: VERIFIED',{timeout:40000});await expect(source).toContainText('Destination review: REVIEWED')
  await preview.getByRole('button',{name:'Preview remittance for standard',exact:true}).click();await expect(preview).toContainText('Proposed remittance $14.00');expect((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key='retirement-destination-standard'")).rows[0].status).toBe('DISMISSED');expect(provider.posts()).toBe(0);expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}
})
