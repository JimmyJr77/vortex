import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {retirementDestinationProvider} from '../../backend/payroll/testing/retirementDestinationProvider.js'
import {retirementRemittanceFixture} from '../../backend/payroll/testing/retirementRemittanceFixture.js'
test('retirement timing retains a lost-response retry and refreshes contribution dates and suspension',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(120000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher,retirementNow:()=>new Date('2026-09-11T12:00:00Z')}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 let lose=true
 try{
  await retirementRemittanceFixture(h);await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(lose&&u.pathname.endsWith('/standard/timing')&&route.request().method()==='POST'&&response.ok()){lose=false;await route.fulfill({status:503,json:{success:false,message:'Synthetic lost timing response'}})}else await route.fulfill({response})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const timing=page.getByRole('region',{name:'Retirement contribution timing standard',exact:true}),source=page.getByRole('region',{name:'Retirement contribution reconciliation',exact:true})
  await timing.getByLabel('Timing applies to withholding from',{exact:true}).fill('2026-01-01')
  await timing.getByRole('spinbutton',{name:'Bank business days from withholding to earliest deposit',exact:true}).fill('2');await timing.getByRole('spinbutton',{name:'Provider bank business days before deposit',exact:true}).fill('1')
  await timing.getByLabel('Provider submission cutoff (New York time)',{exact:true}).fill('14:00');await timing.getByRole('textbox',{name:'Employer capacity and provider timing evidence',exact:true}).fill('Actual two-day segregation capacity and trustee one-day processing verified in retained instructions')
  await timing.getByRole('checkbox').check();await timing.getByRole('button',{name:'Retain contribution timing',exact:true}).click();await expect(timing).toContainText('Synthetic lost timing response')
  await timing.getByRole('button',{name:'Retry original timing review',exact:true}).click();await expect(timing).toContainText('Contribution timing review retained')
  expect((await h.pool.query('SELECT count(*)::int AS count FROM payroll_retirement_timing_review')).rows[0].count).toBe(1)
  await expect(source).toContainText('Reviewed deposit target: 2026-09-22',{timeout:40000})
  await page.setViewportSize({width:390,height:1100});await timing.screenshot({path:'/tmp/payroll-retirement-timing-mobile.png'})
  await timing.getByRole('combobox',{name:'Timing disposition',exact:true}).selectOption('SUSPENDED');await timing.getByRole('checkbox').check();await timing.getByRole('button',{name:'Retain contribution timing',exact:true}).click()
  await expect(timing).toContainText('Timing revision 2 · SUSPENDED');await expect(source).toContainText('Contribution timing: SUSPENDED',{timeout:40000});expect(provider.posts()).toBe(0);expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}
})
