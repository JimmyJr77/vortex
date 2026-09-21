import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {retirementPlanFixture} from '../../backend/payroll/testing/retirementPlanFixture.js'

test('admin reviews employer eligibility independently, corrects invalid vesting and recovers a lost save',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(90000);page.setDefaultTimeout(15000)
 const h=await createHarness(),errors:string[]=[];let lose=true
 page.on('pageerror',e=>errors.push(e.message))
 const api=async(path:string,body?:unknown)=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const json=await response.json();expect(response.ok,JSON.stringify(json)).toBe(true);return json.data}
 try{
  const employee=await api('/employees',{employeeNumber:'EMPLOYER-REVIEW',legalFirstName:'Synthetic',legalLastName:'Participant',hireDate:'2026-09-01',hourlyRateCents:2500})
  await api('/retirement-plans',{plan:{...retirementPlanFixture(),employerContributions:'MATCH_AND_NONELECTIVE',employerContributionTerms:'Retained synthetic matching and nonelective funding.',employerFormula:{period:'PER_PAYROLL',matchCatchUp:true,matchTiers:[{upToBps:300,matchBps:10000}],nonelectiveBps:200,compensation:{REGULAR:true,OVERTIME:true,BONUS:false,PAID_LEAVE:true},eligibilityTerms:'Retained actual entry dates and service conditions.',vestingTerms:'Retained actual vesting and service credit schedule.'}},expectedRevision:0,requestKey:randomUUID()})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(u.pathname.includes('/retirement-employer-eligibility/')&&route.request().method()==='POST'&&response.ok()&&lose){lose=false;return route.fulfill({status:503,json:{success:false,message:'Synthetic lost employer eligibility response'}})}await route.fulfill({response})})
  await page.setViewportSize({width:390,height:1100});await page.goto('/tests/support/payroll.html')
  await page.getByRole('button',{name:'People & onboarding',exact:true}).click();await page.getByRole('button',{name:/EMPLOYER-REVIEW/}).click();await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
  const participant=page.getByRole('region',{name:'Retirement participant eligibility',exact:true})
  await participant.getByRole('button',{name:'Load retirement plans',exact:true}).click()
  await participant.getByRole('combobox',{name:'Participant retirement plan',exact:true}).selectOption('standard')
  const panel=page.getByRole('region',{name:'Employer retirement eligibility',exact:true})
  await panel.getByRole('button',{name:'Load employer eligibility',exact:true}).click()
  await panel.getByRole('textbox',{name:'Employer eligibility and vesting evidence',exact:true}).fill('Reviewed actual matching, nonelective service and vesting evidence.')
  await panel.getByLabel('Employer eligibility assessed from',{exact:true}).fill('2026-09-01')
  await panel.getByLabel('Employer eligibility assessed through',{exact:true}).fill('2026-09-11')
  for(const name of ['Matching','Nonelective']){
   await panel.getByRole('combobox',{name:`${name} eligibility`,exact:true}).selectOption('ELIGIBLE')
   await panel.getByLabel(`${name} eligible entry date`,{exact:true}).fill('2026-09-01')
   await panel.getByRole('textbox',{name:`${name} vested percentage (%)`,exact:true}).fill(name==='Matching'?'101':'100')
  }
  await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Retain employer eligibility',exact:true}).click()
  await expect(panel.getByRole('alert')).toContainText('vesting percentage')
  await panel.getByRole('textbox',{name:'Matching vested percentage (%)',exact:true}).fill('0')
  await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Retain employer eligibility',exact:true}).click()
  await expect(panel.getByRole('alert')).toHaveText('Synthetic lost employer eligibility response')
  await panel.getByRole('button',{name:'Retry original employer eligibility review',exact:true}).click()
  await expect(panel.getByRole('status')).toHaveText('Employer eligibility retained. Employee elections are unchanged.')
  await expect(panel).toContainText('Employer eligibility revision 1 · CURRENT')
  await expect(panel).toContainText('Matching: ELIGIBLE from 2026-09-01 · 0% vested')
  const result=await api(`/employees/${employee.id}/retirement-employer-eligibility/standard`);expect(result.history).toHaveLength(1)
  expect((await h.pool.query('SELECT count(*)::int AS n FROM payroll_retirement_eligibility')).rows[0].n).toBe(0)
  await panel.screenshot({path:'/tmp/payroll-employer-eligibility-mobile.png'})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([])
  await page.route('**/retirement-employer-eligibility/standard',async route=>{const response=await route.fetch({url:`${h.url}/api/admin/payroll/employees/${employee.id}/retirement-employer-eligibility/standard`}),body=await response.json();delete body.data.supportedReviewFields;await route.fulfill({json:body})})
  await panel.getByRole('button',{name:'Load employer eligibility',exact:true}).click()
  await expect(panel).toContainText('Employer assessment date ranges require the current payroll backend.')
  await expect(panel.getByRole('button',{name:'Retain employer eligibility',exact:true})).toHaveCount(0)
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close()}}
})
