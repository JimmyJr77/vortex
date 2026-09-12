import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {retirementPlanFixture} from '../../backend/payroll/testing/retirementPlanFixture.js'
test('admin retains employee retirement eligibility and sees changed plan evidence without losing the draft',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated local payroll database');test.setTimeout(90000);page.setDefaultTimeout(15000)
 const h=await createHarness()
 try{
  const api=async(path:string,body:unknown)=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});expect(response.ok).toBe(true);return (await response.json()).data}
  const employee=await api('/employees',{employeeNumber:'RETIREMENT-BROWSER',legalFirstName:'Synthetic',legalLastName:'Participant',hireDate:'2026-09-01',hourlyRateCents:2500})
  const plan=retirementPlanFixture();await api('/retirement-plans',{plan,expectedRevision:0,requestKey:randomUUID()})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.goto('/tests/support/payroll.html')
  await page.getByRole('button',{name:'People & onboarding',exact:true}).click()
  await page.getByRole('button',{name:/RETIREMENT-BROWSER/}).click()
  await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
  const panel=page.getByRole('region',{name:'Retirement participant eligibility',exact:true})
  await panel.getByRole('button',{name:'Load retirement plans',exact:true}).click()
  await panel.getByRole('combobox',{name:'Participant retirement plan',exact:true}).selectOption('standard')
  await panel.getByRole('button',{name:'Review current eligibility evidence',exact:true}).click()
  await panel.getByRole('combobox',{name:'Eligibility determination',exact:true}).selectOption('ELIGIBLE')
  await panel.getByLabel('Eligible plan entry date',{exact:true}).fill('2026-09-01')
  await panel.getByRole('checkbox',{name:'Percentage of eligible compensation',exact:true}).check()
  await panel.getByRole('textbox',{name:'Eligibility verification reference',exact:true}).fill('Synthetic verified service and entry requirements')
  await panel.getByRole('textbox',{name:'Eligibility explanation for employee',exact:true}).fill('Eligible from September under the reviewed plan terms.')
  await panel.getByRole('checkbox',{name:'I verified this employee',exact:false}).check()
  await panel.getByRole('button',{name:'Retain participant eligibility',exact:true}).click()
  await expect(panel.getByRole('status')).toContainText('Eligibility review retained.',{timeout:15000})
  expect((await h.pool.query('SELECT count(*)::int AS n FROM payroll_retirement_eligibility WHERE employee_id=$1',[employee.id])).rows[0].n).toBe(1)
  await panel.getByRole('textbox',{name:'Eligibility verification reference',exact:true}).fill('An unfinished local review remains visible')
  await api('/retirement-plans',{plan:{...plan,employeeTerms:'New election terms that require participant review.'},expectedRevision:1,requestKey:randomUUID()})
  await expect(panel.getByText('Current review: REVIEW REQUIRED',{exact:false})).toBeVisible({timeout:40000})
  await expect(panel.getByRole('textbox',{name:'Eligibility verification reference',exact:true})).toHaveValue('An unfinished local review remains visible')
  await expect(panel.getByRole('button',{name:'Retain participant eligibility',exact:true})).toBeDisabled()
  await page.setViewportSize({width:390,height:1000});await panel.screenshot({path:'/tmp/payroll-retirement-eligibility-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
 }finally{await page.close();await h.close()}
})
