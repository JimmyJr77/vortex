import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {retirementPlanFixture} from '../../backend/payroll/testing/retirementPlanFixture.js'
import {retirementAnnualFixture} from '../../backend/payroll/testing/retirementAnnualFixture.js'
test('admin retains annual sources with exact retry and preserves a draft when another review arrives',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated local payroll database');test.setTimeout(100000);page.setDefaultTimeout(15000)
 const h=await createHarness({payrollNow:()=>new Date('2026-09-11T12:00:00Z')});let lose=true
 try{
  const api=async(path:string,body?:unknown)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();expect(r.ok,JSON.stringify(data)).toBe(true);return data.data}
  const e=await api('/employees',{employeeNumber:'ANNUAL-SOURCES',legalFirstName:'Synthetic',legalLastName:'Participant',hireDate:'2026-09-01',hourlyRateCents:2500})
  await api('/retirement-plans',{plan:retirementPlanFixture(),expectedRevision:0,requestKey:randomUUID()})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(u.pathname.includes('/retirement-annual-sources/')&&route.request().method()==='POST'&&lose){lose=false;expect(response.ok()).toBe(true);return route.fulfill({status:503,json:{success:false,message:'Synthetic lost annual review response'}})}await route.fulfill({response})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click();await page.getByRole('button',{name:/ANNUAL-SOURCES/}).click();await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
  const panel=page.getByRole('region',{name:'Retirement annual sources',exact:true})
  await panel.getByRole('button',{name:'Load annual-source plans',exact:true}).click();await panel.getByRole('combobox',{name:'Annual-source retirement plan',exact:true}).selectOption('standard');await panel.getByRole('button',{name:'Review current annual-source basis',exact:true}).click()
  await panel.getByLabel('Annual evidence as-of date',{exact:true}).fill('2026-09-11');await panel.getByRole('spinbutton',{name:'Age attained at year end',exact:true}).fill('45')
  for(const label of ['Prior-year plan-sponsor FICA wages','All aggregated external ordinary deferrals','All aggregated external catch-up deferrals','This plan’s external ordinary deferrals','This plan’s external catch-up deferrals','External annual additions for the employer limit group','External compensation under this plan’s definition','External compensation under the annual-additions definition'])await panel.getByRole('textbox',{name:`${label} ($)`,exact:true}).fill('0')
  for(const label of ['Additional participant ordinary cap','Additional participant catch-up cap'])await panel.getByRole('combobox',{name:label,exact:true}).selectOption('NONE')
  await panel.getByRole('combobox',{name:'Plan treatment after annual compensation limit',exact:true}).selectOption('DEFERRALS_CONTINUE')
  for(const label of ['Age verification reference','Employer and plan aggregation review','External balance evidence','Participant-specific limit review','Compensation definitions and cap review'])await panel.getByRole('textbox',{name:label,exact:true}).fill('Reviewed external evidence, excluding all application payroll amounts.')
  await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Retain annual retirement sources',exact:true}).click();await expect(panel.getByText('Synthetic lost annual review response',{exact:true})).toBeVisible({timeout:15000})
  await panel.getByRole('button',{name:'Retry original annual-source review',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Annual source review retained.')
  expect((await h.pool.query('SELECT count(*)::int AS n FROM payroll_retirement_annual_source')).rows[0].n).toBe(1)
  await panel.getByRole('textbox',{name:'External balance evidence',exact:true}).fill('Unfinished local source review must stay visible')
  const path=`/employees/${e.id}/retirement-annual-sources/standard`,current=await api(path)
  await api(path,{planRevisionId:current.planRevisionId,expectedRevision:1,requestKey:randomUUID(),facts:{...retirementAnnualFixture(),externalOrdinaryDeferralsCents:100000}})
  await expect(panel.getByText('Annual source revision 2',{exact:false})).toBeVisible({timeout:40000})
  await expect(panel.getByRole('textbox',{name:'External balance evidence',exact:true})).toHaveValue('Unfinished local source review must stay visible')
  await expect(panel.getByRole('button',{name:'Retain annual retirement sources',exact:true})).toBeDisabled()
  await page.setViewportSize({width:390,height:1000});await panel.screenshot({path:'/tmp/payroll-retirement-annual-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
 }finally{await page.unrouteAll({behavior:'ignoreErrors'});await page.close();await h.close()}
})
