import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {monthlyBenefitsFixture} from '../../backend/payroll/testing/monthlyBenefitsFixture.js'
test('employee withdraws a benefit deduction authorization and explicitly signs again',async({page})=>{
 test.setTimeout(90000);test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness()
 try{
 const {api,employee,periods}=await monthlyBenefitsFixture(h),invitation=await api(`/employees/${employee.id}/invitations`,{email:'synthetic-withdrawal@example.test',sendEmail:false},'POST',201)
 await page.route('**/api/payroll/employee/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
 await page.setViewportSize({width:390,height:1200});await page.goto(`/employee/payroll?invite=${new URL(invitation.inviteUrl).searchParams.get('invite')}`)
 await page.getByRole('button',{name:'Onboarding',exact:true}).click()
 const step=page.locator('details').filter({has:page.getByText('Pay, classification & benefits review',{exact:true})});await step.locator('summary').first().click()
 const panel=page.getByRole('region',{name:'Benefit deduction authorization',exact:true}),withdraw=panel.getByRole('button',{name:'Withdraw deduction authorization',exact:true})
 await expect(withdraw).toBeDisabled();await panel.getByRole('checkbox').check();await withdraw.click()
 await expect(page.getByRole('status').first()).toContainText('Deduction authorization withdrawn.')
 await expect(panel).toContainText('You withdrew this authorization.')
 expect((await api('/runs/preview',{payPeriodId:periods[0].id})).preview.canApprove).toBe(false)
 await panel.screenshot({path:'/tmp/payroll-benefit-withdrawal-mobile.png'})
 await panel.getByLabel('Deduction authorization signature',{exact:true}).fill('Monthly Benefits')
 await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Sign deduction authorization',exact:true}).click()
 await expect(page.getByRole('status').first()).toContainText('Benefit deduction authorization signed and saved.')
 expect((await api('/runs/preview',{payPeriodId:periods[0].id})).preview.canApprove).toBe(true)
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})

test('admin sees a paid month covered after withdrawal and the next month blocked',async({page})=>{
 test.setTimeout(90000);test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness()
 try{
 const {api,periods}=await monthlyBenefitsFixture(h),first=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 await api(`/runs/${first.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${first.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${first.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-PAID-MONTH-WITHDRAWAL'})
 const packet=await api('/onboarding',undefined,'GET',200,true)
 await api('/benefits-deduction-authorization/withdraw',{confirmed:true,requestKey:'synthetic-browser-paid-withdrawal',authorizationRequestKey:packet.benefitsDeduction.saved.requestKey,onboardingCycle:1},'POST',200,true)
 await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
 await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
 await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Payroll runs',exact:true}).click()
 await page.getByRole('combobox',{name:'Pay period',exact:true}).selectOption(String(periods[1].id));await page.getByRole('button',{name:'Preview payroll',exact:true}).click()
 const collection=page.getByRole('region',{name:'Monthly benefit deductions',exact:true})
 await expect(collection).toContainText('No second deduction this month.');await expect(collection).toContainText('The employee withdrew this authorization.');await collection.screenshot({path:'/tmp/payroll-benefit-paid-withdrawal-mobile.png'})
 await page.getByRole('combobox',{name:'Pay period',exact:true}).selectOption(String(periods[2].id));await page.getByRole('button',{name:'Preview payroll',exact:true}).click()
 await expect(page.getByRole('listitem').filter({hasText:'The employee withdrew this benefit deduction authorization.'}).first()).toBeVisible();await expect(collection).toHaveCount(0)
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})
