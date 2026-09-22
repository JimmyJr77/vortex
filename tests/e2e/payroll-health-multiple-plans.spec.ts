import {test,expect} from '@playwright/test'
import {mock} from 'node:test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {healthElectionFixture} from '../../backend/payroll/testing/healthElectionFixture.js'
import {monthlyMultiPlanFixture} from '../../backend/payroll/testing/monthlyMultiPlanFixture.js'

test('employee signs medical and dental separately and retains both disclosures on mobile',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(90000)
 mock.timers.enable({apis:['Date'],now:Date.parse('2026-09-16T16:00:00.000Z')})
 const previous=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='1b'.repeat(32)
 const h=await createHarness({databaseNow:'2026-09-16T16:00:00.000Z'}),errors:string[]=[]
 try{
  const medical=await healthElectionFixture(h,{existingFixture:await monthlyMultiPlanFixture(h,{taxTreatment:'PRETAX',dentalTreatment:'PRETAX'})})
  await healthElectionFixture(h,{existingFixture:medical,planId:'dental'})
  await page.clock.install();page.on('pageerror',error=>errors.push(error.message))
  await page.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','monthly-benefits-session'))
  await page.route('**/api/payroll/employee/**',async route=>{const url=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${url.pathname}${url.search}`})})})
  await page.setViewportSize({width:390,height:1100});await page.goto('/tests/support/payroll.html?employee=1')
  await page.getByRole('button',{name:'Onboarding',exact:true}).click()
  const panel=page.getByRole('region',{name:'My pretax health elections',exact:true})
  for(const [index,name] of ['Medical','Dental'].entries()){
   const plan=panel.getByRole('article',{name:`Health election ${name}`,exact:true})
   await plan.getByRole('button',{name:'Review health election starting 2026-09-18',exact:true}).click()
   await expect(plan.getByText('Page 1 of 1 displayed.',{exact:true})).toBeVisible()
   await plan.getByText('Read page 1 text',{exact:true}).click();await expect(plan).toContainText('Synthetic employee-safe plan disclosure')
   await plan.getByLabel('Health election choice',{exact:true}).selectOption('ELECT')
   await plan.getByLabel('Health election signature',{exact:true}).fill('Monthly Benefits')
   for(const checkbox of await plan.getByRole('checkbox').all())await checkbox.check()
   await plan.getByRole('button',{name:'Sign health election',exact:true}).click()
   await expect(plan).toContainText('Your signed health election was retained.')
   expect((await h.pool.query('SELECT count(*)::int n FROM payroll_health_election')).rows[0].n).toBe(index+1)
   const preview=(await medical.api('/runs/preview',{payPeriodId:medical.periods[0].id})).preview
   expect(preview.canApprove).toBe(index===1)
   if(index===1)expect(preview.employees[0].pretaxDeductionCents).toBe(13500)
  }
  await page.reload();await page.getByRole('button',{name:'Onboarding',exact:true}).click()
  for(const name of ['Medical','Dental']){
   const plan=panel.getByRole('article',{name:`Health election ${name}`,exact:true})
   await expect(plan.getByRole('button',{name:'Review health election starting 2026-09-18',exact:true})).toHaveCount(0)
   await plan.getByText('My signed health election history',{exact:true}).click()
   await plan.getByRole('button',{name:'Read signed disclosure · revision 1 · cycle 1',exact:true}).click()
   await expect(plan.getByText('Page 1 of 1 displayed.',{exact:true})).toBeVisible()
   await expect(plan).toContainText(`I elect salary reduction for ${name}`)
  }
  await expect(panel).not.toContainText('CONFIDENTIAL-ADMIN-REFERENCE')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  expect(errors).toEqual([]);await panel.screenshot({path:'/tmp/payroll-health-multiple-plans-mobile.png'})
 }finally{
  await page.close().catch(()=>{});await h.close();mock.timers.reset()
  if(previous===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=previous
 }
})
