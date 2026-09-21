import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {regularEmployerRetirementFixture} from '../../backend/payroll/testing/regularEmployerRetirementFixture.js'
test('admin sees employee deductions separately from employer contribution funding',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database')
 const h=await createHarness({databaseNow:'2026-09-16T16:00:00.000Z',retirementNow:()=>new Date('2026-09-16T16:00:00Z')}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const {api,periods}=await regularEmployerRetirementFixture(h)
  const preview=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview
  expect(preview.canApprove).toBe(true)
  const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
  await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
  await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-EMPLOYER-BREAKDOWN'})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const source=page.getByRole('article',{name:`Retirement contributions for payroll ${run.id}`,exact:true})
  await expect(source).toContainText('Combined contributions: $24.00 · Delivery unverified')
  for(const [label,amount] of [['Employee contribution','$14.00'],['Employer matching','$6.00'],['Employer nonelective','$4.00'],['Combined participant total','$24.00']])await expect(source.locator('dl > div').filter({has:page.getByText(label,{exact:true})})).toHaveText(label+amount)
  await expect(source).not.toContainText('Withheld: $24.00')
  await page.setViewportSize({width:390,height:1100});await source.screenshot({path:'/tmp/payroll-employer-contribution-breakdown-mobile.png'})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(errors).toEqual([])
 }finally{try{await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}finally{await h.close()}}
})
