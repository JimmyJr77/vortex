import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {monthlyBenefitsFixture} from '../../backend/payroll/testing/monthlyBenefitsFixture.js'
test('employee coverage refreshes retained admin changes without exposing internal references',async({page})=>{
 test.setTimeout(90000);test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness(),{api}=await monthlyBenefitsFixture(h);let failRead=true
 try{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.clock.install()
  await page.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','monthly-benefits-session'))
  await page.route('**/api/payroll/employee/**',async route=>{const u=new URL(route.request().url());if(failRead&&u.pathname.endsWith('/benefit-coverage')){failRead=false;return route.fulfill({status:503,json:{success:false,message:'Synthetic coverage read failure'}})}await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.setViewportSize({width:390,height:1100});await page.goto('/tests/support/payroll.html?employee=1');await page.getByRole('button',{name:'Onboarding',exact:true}).click()
  const coverage=page.getByRole('region',{name:'My monthly benefit coverage',exact:true});await coverage.getByLabel('My coverage month',{exact:true}).fill('2026-09');await expect(coverage.getByRole('alert')).toContainText('Synthetic coverage read failure')
  await page.clock.fastForward(30001);await expect(coverage).toContainText('Admin coverage review required.');await expect(coverage.getByRole('alert')).toHaveCount(0)
  const row=(await api('/benefit-coverage?month=2026-09')).rows[0],review={month:row.month,employeeId:row.employeeId,onboardingCycle:row.onboardingCycle,planId:row.planId,sourceFingerprint:row.sourceFingerprint,expectedRevision:0,disposition:'COVERED',carrier:'Synthetic Carrier',coverageStart:'2026-09-01',coverageEnd:'2026-09-30',reference:'PRIVATE ADMIN COVERAGE INVESTIGATION',confirmed:true,requestKey:randomUUID()}
  await api('/benefit-coverage',review);await page.clock.fastForward(30001);await expect(coverage).toContainText('Admin verified carrier coverage with Synthetic Carrier.');await expect(coverage).toContainText('Covered dates: 2026-09-01 through 2026-09-30.');await expect(coverage).not.toContainText('PRIVATE')
  await api('/benefit-coverage',{...review,expectedRevision:1,disposition:'NOT_COVERED',requestKey:randomUUID()});await page.clock.fastForward(30001);await expect(coverage).toContainText('Admin recorded no carrier coverage for this month');await expect(coverage).not.toContainText('Covered dates:')
  await api('/benefit-coverage',{...review,expectedRevision:2,disposition:'RETRACTED',requestKey:randomUUID()});await page.clock.fastForward(30001);await expect(coverage).toContainText('Admin coverage review required.');await expect(coverage).not.toContainText('Admin recorded no carrier coverage')
  await coverage.getByLabel('My coverage month',{exact:true}).fill('2026-08');await expect(coverage).toContainText('No retained plan coverage records for this month.')
  await page.getByRole('button',{name:'Pay statements',exact:true}).click();await coverage.getByLabel('My coverage month',{exact:true}).fill('2026-09');await expect(coverage).toContainText('Admin coverage review required.');await coverage.screenshot({path:'/tmp/payroll-employee-coverage-mobile.png'});expect(errors).toEqual([])
 }finally{await page.unrouteAll({behavior:'wait'}).catch(()=>{});await page.close().catch(()=>{});await h.close()}
})
