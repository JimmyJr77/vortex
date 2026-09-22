import {test,expect} from '@playwright/test'
import {mock} from 'node:test'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {healthElectionFixture} from '../../backend/payroll/testing/healthElectionFixture.js'
for(const scenario of ['ELECT','DECLINE','STALE'])test(`employee health election stays internal: ${scenario}`,async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(90000);page.setDefaultTimeout(15000)
 mock.timers.enable({apis:['Date'],now:Date.parse('2026-09-16T16:00:00.000Z')});const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='1a'.repeat(32)
 const h=await createHarness({databaseNow:'2026-09-16T16:00:00.000Z'});let lose=true;const errors:string[]=[]
 try{
  const {api,periods,disclosurePath,disclosureBody}=await healthElectionFixture(h)
  await page.clock.install();page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{sessionStorage.setItem('vortex_payroll_employee_session_v1','monthly-benefits-session');localStorage.setItem('adminToken','payroll-test-admin')})
  await page.route('**/api/payroll/employee/**',async route=>{const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(lose&&route.request().method()==='POST'&&u.pathname.endsWith('/election')&&response.ok()){lose=false;return route.fulfill({status:503,json:{success:false,message:'Synthetic lost health election response'}})}await route.fulfill({response})})
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.setViewportSize({width:390,height:1100});await page.goto('/tests/support/payroll.html?employee=1');await page.getByRole('button',{name:'Onboarding',exact:true}).click()
  const panel=page.getByRole('region',{name:'My pretax health elections',exact:true})
  await panel.getByRole('button',{name:'Review health election starting 2026-09-18',exact:true}).click()
  await expect(panel.getByText('Page 1 of 1 displayed.',{exact:true})).toBeVisible();await panel.getByText('Read page 1 text',{exact:true}).click();await expect(panel).toContainText('Synthetic employee-safe plan disclosure')
  await expect(panel).not.toContainText('CONFIDENTIAL-ADMIN-REFERENCE')
  await panel.getByLabel('Health election choice',{exact:true}).selectOption(scenario==='DECLINE'?'DECLINE':'ELECT');await panel.getByLabel('Health election signature',{exact:true}).fill('Monthly Benefits')
  for(const check of await panel.getByRole('checkbox').all())await check.check()
  if(scenario==='STALE'){
   await api(disclosurePath,{...disclosureBody,requestKey:randomUUID(),expectedRevision:1,employeeTerms:'Changed employee plan terms require review before a new employee signature.'})
   await page.clock.fastForward(30001);await expect(panel).toContainText('Your health election terms or history changed. Your draft is preserved.')
   await expect(panel.getByLabel('Health election signature',{exact:true})).toHaveValue('Monthly Benefits');await expect(panel.getByRole('button',{name:'Sign health election',exact:true})).toBeDisabled()
   expect((await h.pool.query('SELECT count(*)::int n FROM payroll_health_election')).rows[0].n).toBe(0)
  }else{
   await panel.getByRole('button',{name:'Sign health election',exact:true}).click();await expect(panel.getByText('Synthetic lost health election response',{exact:true})).toBeVisible()
   await panel.getByRole('button',{name:'Refresh health elections',exact:true}).click();await panel.getByRole('button',{name:'Retry original health election',exact:true}).click();await expect(panel).toContainText('Your signed health election was retained.')
   const retained=(await h.pool.query('SELECT election FROM payroll_health_election')).rows;expect(retained.length).toBe(1);expect(retained[0].election.action).toBe(scenario)
   await panel.getByText('My signed health election history',{exact:true}).click();await panel.getByRole('button',{name:'Read signed disclosure · revision 1 · cycle 1',exact:true}).click();await expect(panel.getByText('Your retained health plan disclosure',{exact:true})).toBeVisible();await expect(panel.getByText('Page 1 of 1 displayed.',{exact:true})).toBeVisible()
  }
  await panel.screenshot({path:`/tmp/payroll-employee-health-${scenario.toLowerCase()}.png`});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([])
  if(scenario==='ELECT'){
   await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Payroll runs',exact:true}).click()
   await page.getByRole('combobox',{name:'Pay period',exact:true}).selectOption(String(periods[0].id));await page.getByRole('button',{name:'Preview payroll',exact:true}).click()
   const collection=page.getByRole('region',{name:'Monthly benefit deductions',exact:true})
   await expect(collection.getByText('$125.00 deducted in this payroll.',{exact:true})).toBeVisible();await expect(collection).toContainText('Pretax contribution')
   await collection.screenshot({path:'/tmp/payroll-health-admin-collection-mobile.png'})
   await page.getByRole('button',{name:'Save draft snapshot',exact:true}).click()
   await page.getByRole('row').filter({hasText:'Sep 18, 2026'}).getByRole('button',{name:'Open review',exact:true}).click()
   await page.getByRole('button',{name:'Send to review',exact:true}).click();await page.getByRole('button',{name:'Approve run',exact:true}).click()
   await page.getByRole('textbox',{name:'External payment confirmation',exact:true}).fill('SYNTHETIC-HEALTH-BROWSER-PAYMENT')
   await page.getByRole('button',{name:'Confirm paid & finalize',exact:true}).click();await expect(page.getByText('Payroll finalized and employee statements saved.',{exact:true})).toBeVisible()
   await page.getByRole('button',{name:'Reports & QuickBooks',exact:true}).click();await page.getByRole('button',{name:'Review retained wage bases',exact:true}).click()
   const wages=page.getByRole('region',{name:'Retained payroll wage bases',exact:true})
   await expect(wages.getByText('Finalized wage bases reconcile.',{exact:true})).toBeVisible()
   for(const label of ['Social Security taxable wages: $75.00','Federal wage input: $75.00','Maryland wage input: $75.00'])await expect(wages.getByText(label,{exact:true})).toBeVisible()
   await wages.screenshot({path:'/tmp/payroll-health-wage-bases-mobile.png'})
   await page.goto('/tests/support/payroll.html?employee=1');await page.getByRole('button',{name:'Pay statements',exact:true}).click()
   const history=page.getByRole('region',{name:'My benefit contributions',exact:true});await history.getByLabel('Contribution payment year').fill('2026')
   await expect(history.getByText('Collected in 2026: $125.00',{exact:true})).toBeVisible();await expect(history.getByText('Pretax contribution',{exact:true})).toBeVisible()
   const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download itemized pay statement (PDF)',exact:true}).click();await (await download).saveAs('/tmp/payroll-health-browser-statement.pdf')
   await history.screenshot({path:'/tmp/payroll-health-contribution-history-mobile.png'})
   await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Payroll runs',exact:true}).click()
   await page.getByRole('combobox',{name:'Pay period',exact:true}).selectOption(String(periods[1].id));await page.getByRole('button',{name:'Preview payroll',exact:true}).click()
   await expect(collection).toContainText('No second deduction this month.')
   expect((await h.pool.query("SELECT count(*)::int n FROM payroll_run WHERE status='FINALIZED'")).rows[0].n).toBe(1)
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([])
  }
 }finally{await page.unrouteAll({behavior:'wait'}).catch(()=>{});await page.close().catch(()=>{});await h.close();mock.timers.reset();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
