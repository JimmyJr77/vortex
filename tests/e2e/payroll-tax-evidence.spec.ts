import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {monthlyBenefitsFixture} from '../../backend/payroll/testing/monthlyBenefitsFixture.js'
test('admin can recover tax reconciliation after incomplete finalized withholding is resolved',async({page})=>{
 test.setTimeout(90000);page.setDefaultTimeout(10000)
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness()
 try{
  const {api,periods}=await monthlyBenefitsFixture(h)
  const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
  await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
  await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-TAX-EVIDENCE-BROWSER'})
  const saved=(await h.pool.query('SELECT federal_income_tax_cents FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0].federal_income_tax_cents
  await h.pool.query('UPDATE payroll_run_employee SET federal_income_tax_cents=NULL WHERE payroll_run_id=$1',[run.id])
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.setViewportSize({width:390,height:1000});await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Compliance',exact:true}).click()
  const panel=page.locator('section').filter({has:page.getByRole('heading',{name:'Tax deposits & filing reconciliation',exact:true})}).last()
  await panel.getByRole('combobox',{name:'Tax year',exact:true}).selectOption('2026')
  await expect(panel.getByRole('alert').first()).toContainText('Finalized payroll tax amounts are incomplete or invalid.')
  await expect(panel.getByText('Loading tax reconciliation…',{exact:true})).toHaveCount(0)
  await expect(panel.getByRole('button',{name:'Record accepted filing',exact:true})).toBeDisabled()
  await h.pool.query('UPDATE payroll_run_employee SET federal_income_tax_cents=$2 WHERE payroll_run_id=$1',[run.id,saved])
  await panel.getByRole('button',{name:'Refresh tax reconciliation',exact:true}).click()
  await expect(panel.getByText('Tax reconciliation refreshed.',{exact:true})).toBeVisible()
  await expect(panel.getByRole('button',{name:'Record accepted filing',exact:true})).toBeEnabled()
  await expect(panel.getByText('Gross wages $200.00 · 1 employees',{exact:true})).toBeVisible()
  await h.pool.query('UPDATE payroll_run_employee SET federal_income_tax_cents=NULL WHERE payroll_run_id=$1',[run.id])
  await panel.getByRole('button',{name:'Refresh tax reconciliation',exact:true}).click()
  await expect(panel.getByText('Gross wages $200.00 · 1 employees',{exact:true})).toHaveCount(0)
  await expect(panel.getByRole('button',{name:'Record accepted filing',exact:true})).toBeDisabled()
  await panel.screenshot({path:'/tmp/payroll-tax-recovery-mobile.png'})
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})
