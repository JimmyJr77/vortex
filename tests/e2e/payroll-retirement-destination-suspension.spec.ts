import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {retirementDestinationProvider} from '../../backend/payroll/testing/retirementDestinationProvider.js'
import {retirementRemittanceFixture} from '../../backend/payroll/testing/retirementRemittanceFixture.js'
test('admin suspends destination offline, retries lost response and clears remittance preview',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher,retirementNow:()=>new Date('2026-09-11T12:00:00Z')}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const {run}=await retirementRemittanceFixture(h)
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  let lose=true
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(lose&&u.pathname.endsWith('/suspend')&&r.ok()){lose=false;await route.fulfill({status:503,json:{success:false,message:'Synthetic lost suspension response'}});return}await route.fulfill({response:r})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const remittance=page.getByRole('region',{name:`Retirement remittance preview ${run.id} standard`,exact:true})
  await remittance.getByRole('button',{name:'Preview remittance for standard',exact:true}).click();await expect(remittance).toContainText('Proposed remittance $14.00')
  const destination=page.getByRole('region',{name:'Retirement remittance destination standard',exact:true}),suspension=destination.getByRole('region',{name:'Retirement destination suspension',exact:true})
  await suspension.getByRole('textbox',{name:'Destination suspension reason',exact:true}).fill('Trustee instructions require investigation before further remittance');await suspension.getByRole('checkbox').check();provider.unavailable(true)
  await suspension.getByRole('button',{name:'Suspend retirement destination',exact:true}).click();await expect(suspension.getByRole('alert')).toContainText('Synthetic lost suspension response');await suspension.getByRole('button',{name:'Retry original destination suspension',exact:true}).click();await expect(suspension.getByRole('status')).toHaveText('Destination suspended')
  expect((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_destination_suspension')).rows[0].n).toBe(1)
  await expect(page.getByRole('region',{name:'Retirement contribution reconciliation',exact:true})).toContainText('Destination review: SUSPENDED',{timeout:40000});await expect(remittance).not.toContainText('Proposed remittance')
  provider.unavailable(false);await remittance.getByRole('button',{name:'Preview remittance for standard',exact:true}).click();await expect(remittance.getByRole('alert')).toContainText('destination is suspended')
  await page.setViewportSize({width:390,height:1100});await suspension.screenshot({path:'/tmp/payroll-retirement-destination-suspension-mobile.png'});expect(provider.posts()).toBe(0);expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}
})
