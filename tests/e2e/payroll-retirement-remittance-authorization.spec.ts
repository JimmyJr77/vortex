import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {retirementDestinationProvider} from '../../backend/payroll/testing/retirementDestinationProvider.js'
import {retirementRemittanceAuthorizationFixture} from '../../backend/payroll/testing/retirementRemittanceAuthorizationFixture.js'
test('admin recovers a lost remittance authorization and cancels its reservation without provider access',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(90000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>new Date('2026-09-19T12:00:00Z'),retirementNow:()=>new Date('2026-09-11T12:00:00Z')}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let lose=true,loseCancel=true
 try{
  const {run}=await retirementRemittanceAuthorizationFixture(h);await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(lose&&u.pathname.endsWith('/retirement-remittance-authorizations')&&route.request().method()==='POST'&&r.ok()){lose=false;await route.fulfill({status:503,json:{success:false,message:'Synthetic lost authorization response'}})}else if(loseCancel&&u.pathname.includes('/retirement-remittance-authorizations/')&&u.pathname.endsWith('/cancel')&&r.ok()){loseCancel=false;await route.fulfill({status:503,json:{success:false,message:'Synthetic lost cancellation response'}})}else await route.fulfill({response:r})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const file=page.getByRole('region',{name:`Recordkeeper allocation file ${run.id} standard`,exact:true}),authorization=page.getByRole('region',{name:`Retirement remittance authorization ${run.id} standard`,exact:true})
  await file.getByRole('button',{name:'Prepare allocation file for standard',exact:true}).click();await expect(file).toContainText('Allocation file: 1 employee · $14.00')
  await authorization.getByRole('textbox',{name:'Outside activity and authorization review reference',exact:true}).fill('Reviewed exact contribution sources, outside payments and previously downloaded allocation files')
  await authorization.getByRole('checkbox',{name:'I verified that these exact payroll deductions have no outside contributions, pending funds instructions or duplicate allocation submissions, including any downloaded files.',exact:true}).check();await authorization.getByRole('checkbox',{name:'I authorize this exact contribution amount, destination, allocation file and reviewed timing.',exact:true}).check()
  await authorization.getByRole('button',{name:'Authorize contribution remittance',exact:true}).click();await expect(authorization).toContainText('Synthetic lost authorization response')
  await authorization.getByRole('button',{name:'Retry original remittance authorization',exact:true}).click();await expect(authorization).toContainText('$14.00 · RESERVED NOT SENT')
  expect((await h.pool.query('SELECT count(*)::int AS count FROM payroll_retirement_remittance_authorization')).rows[0].count).toBe(1)
  await page.setViewportSize({width:390,height:1100});await authorization.screenshot({path:'/tmp/payroll-retirement-remittance-authorization-mobile.png'})
  provider.unavailable(true);delete process.env.PAYROLL_DOCUMENT_KEY
  await authorization.getByRole('textbox',{name:'Remittance cancellation reference',exact:true}).fill('Cancel the unsubmitted reservation while trustee instructions are reviewed')
  await authorization.getByRole('checkbox',{name:'I reviewed cancellation of this unsubmitted contribution authorization.',exact:true}).check()
  const reads=provider.reads();await authorization.getByRole('button',{name:'Cancel remittance authorization',exact:true}).click();await expect(authorization).toContainText('Synthetic lost cancellation response')
  await authorization.getByRole('button',{name:'Retry original remittance cancellation',exact:true}).click();await expect(authorization).toContainText('$14.00 · CANCELLED')
  expect((await h.pool.query('SELECT count(*)::int AS count FROM payroll_retirement_remittance_cancellation')).rows[0].count).toBe(1);expect(provider.reads()).toBe(reads);expect(provider.posts()).toBe(0);expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}
})
