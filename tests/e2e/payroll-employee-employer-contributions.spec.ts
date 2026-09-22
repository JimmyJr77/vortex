import {test,expect,createHarness} from '../support/historicalPayrollTest'
import {regularEmployerRetirementFixture} from '../../backend/payroll/testing/regularEmployerRetirementFixture.js'
test.use({historicalPayrollReferenceTime:'2026-09-16T16:00:00.000Z'})
for(const declined of [false,true])test(`employee sees ${declined?'employer-only':'combined'} funding separately from payroll deductions`,async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database')
 const h=await createHarness({databaseNow:'2026-09-16T16:00:00.000Z',retirementNow:()=>new Date('2026-09-16T16:00:00Z')}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const {api,periods}=await regularEmployerRetirementFixture(h,{declined})
  const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
  await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
  await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-EMPLOYEE-EMPLOYER-HISTORY'})
  await page.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','monthly-benefits-session'))
  await page.route('**/api/payroll/employee/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.goto('/tests/support/payroll.html?employee=1');await page.getByRole('button',{name:'Pay statements',exact:true}).click()
  const panel=page.getByRole('region',{name:'My retirement contributions',exact:true})
  await expect(panel).toContainText(`Deducted ${declined?'$0.00':'$14.00'}`)
  await expect(panel).toContainText(`Employer matching: ${declined?'$0.00':'$6.00'}`)
  await expect(panel).toContainText('Employer nonelective: $4.00')
  await expect(panel).toContainText(`Combined contribution: ${declined?'$4.00':'$24.00'}`)
  await expect(panel).not.toContainText(`Deducted ${declined?'$4.00':'$24.00'}`)
  await expect(panel).toContainText('Receipt status: RECEIPT UNVERIFIED')
  await page.setViewportSize({width:390,height:1100});await panel.screenshot({path:`/tmp/payroll-employee-${declined?'employer-only':'combined'}-contributions-mobile.png`})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(errors).toEqual([])
 }finally{try{await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}finally{await h.close()}}
})
