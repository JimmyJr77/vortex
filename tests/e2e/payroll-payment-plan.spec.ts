import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {monthlyBenefitsFixture} from '../../backend/payroll/testing/monthlyBenefitsFixture.js'
test('approved payroll displays its payment plan and clears stale totals after inputs change',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(60000)
 const h=await createHarness()
 try{
  const {api,employee,periods}=await monthlyBenefitsFixture(h),run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
  await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Payroll runs',exact:true}).click();await page.getByRole('button',{name:'Open review',exact:true}).click()
  const plan=page.getByRole('region',{name:'Payroll payment plan',exact:true}),prepare=plan.getByRole('button',{name:'Prepare payment plan',exact:true})
  await prepare.click();await expect(plan).toContainText('Ready for payment review.');await expect(plan).toContainText('Monthly Benefits · CHECK');await expect(plan).toContainText('Approved date: 2026-09-18');await plan.screenshot({path:'/tmp/payroll-payment-plan-mobile.png'})
  const authorization=plan.getByRole('region',{name:'Authorize payroll payment plan',exact:true}),reference=authorization.getByLabel('Payment decision reference',{exact:true}),authorize=authorization.getByRole('button',{name:'Authorize payment plan',exact:true})
  await reference.fill('Synthetic reviewed payroll payment plan');await authorization.getByRole('checkbox').check();await reference.fill('Synthetic updated payroll payment decision');await expect(authorize).toBeDisabled();await authorization.getByRole('checkbox').check();await authorize.click();await expect(authorization.getByRole('status')).toContainText('Payment plan authorized and retained')
  await authorization.screenshot({path:'/tmp/payroll-payment-batch-mobile.png'})
  await reference.fill('Synthetic cancellation before dispatch');await authorization.getByLabel('I confirm this authorization should be cancelled before payment submission.',{exact:true}).check();await authorization.getByRole('button',{name:'Cancel payment authorization',exact:true}).click();await expect(authorization.getByRole('status')).toContainText('Payment authorization cancelled');await expect(authorization).toContainText('CANCELLED')
  await h.pool.query("UPDATE payroll_onboarding_task SET response='{\"method\":\"DIRECT_DEPOSIT\"}' WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id]);await prepare.click();await expect(plan).toContainText('Configure the employer payment connection.');await expect(plan).toContainText('Resolve payment setup issues.')
  await h.pool.query("UPDATE payroll_employee SET work_state='VA' WHERE id=$1",[employee.id]);await prepare.click();await expect(plan.getByRole('alert')).toContainText('Payroll inputs changed');await expect(plan).not.toContainText('Total net pay:')
 }finally{await page.unrouteAll({behavior:'wait'});await h.close()}
})
