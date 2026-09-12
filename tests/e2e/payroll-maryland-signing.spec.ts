import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {monthlyBenefitsFixture} from '../../backend/payroll/testing/monthlyBenefitsFixture.js'
test('admin proposes and employee signs Maryland withholding internally with safe response retry and decline',async({page,browser})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const h=await createHarness(),context=await browser.newContext({viewport:{width:390,height:1000}}),employeePage=await context.newPage(),errors:string[]=[]
 employeePage.setDefaultTimeout(15000)
 page.on('pageerror',e=>errors.push(e.message));employeePage.on('pageerror',e=>errors.push(e.message))
 try{
  const {api,employee}=await monthlyBenefitsFixture(h)
  await api(`/employees/${employee.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed Maryland election',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1,extraWithholdingCents:500}},'PATCH')
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
  const admin=page.getByRole('region',{name:'Send Maryland agreement for employee signing',exact:true})
  const propose=async()=>{
   await admin.getByLabel('Proposed agreement effective date',{exact:true}).fill('2026-09-16')
   await admin.getByRole('button',{name:'Review employee agreement terms',exact:true}).click()
   await expect(admin).toContainText('I agree to $5.00 additional Maryland withholding per semimonthly pay-calendar period')
   await admin.getByRole('checkbox',{name:'I approve these exact terms on behalf of the employer for this employee to sign.',exact:true}).check()
   await admin.getByRole('button',{name:'Make proposal available for signing',exact:true}).click()
   await expect(admin.getByRole('status')).toHaveText('Proposal is available in the employee portal.')
  }
  await propose()
  expect((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_maryland_additional_agreement')).rows[0].n).toBe(0)
  let lose=true
  await context.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','monthly-benefits-session'))
  await employeePage.route('**/api/payroll/employee/**',async route=>{
   const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`})
   if(lose&&u.pathname.endsWith('/respond')&&route.request().method()==='POST'){expect(response.status()).toBe(200);lose=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic lost signing response. Retry unchanged.'})});return}
   await route.fulfill({response})
  })
  await employeePage.goto('/tests/support/payroll.html?employee=1');await employeePage.getByRole('button',{name:'Onboarding',exact:true}).click()
  const panel=employeePage.getByRole('region',{name:'Your Maryland withholding agreement',exact:true})
  const payReview=employeePage.locator('details').filter({has:employeePage.locator('summary').filter({hasText:'Pay, classification & benefits review'})})
  await expect(payReview).toContainText('Additional withholding agreement: review required · planned payment 2026-09-18.')
  await expect(panel).toContainText('I agree to $5.00 additional Maryland withholding')
  await panel.getByRole('textbox',{name:'Your signature',exact:true}).fill('Monthly Benefits')
  await panel.getByRole('checkbox',{name:'I reviewed these terms and intend my typed name to sign my selected response.',exact:true}).check()
  const save=panel.getByRole('button',{name:'Save agreement response',exact:true})
  await save.click();await expect(panel.getByRole('alert')).toContainText('Synthetic lost signing response')
  await save.click();await expect(panel.getByRole('status')).toContainText('Your acceptance is saved');await expect(payReview).toContainText('Additional withholding agreement: covers the reviewed payment date · planned payment 2026-09-18.')
  expect((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_maryland_additional_agreement')).rows[0].n).toBe(1)
  expect((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_maryland_agreement_signature')).rows[0].n).toBe(1)
  await panel.getByText('Your agreement responses',{exact:true}).click();await expect(panel).toContainText('Proposal 1 · Accepted');await panel.screenshot({path:'/tmp/payroll-maryland-employee-signing-mobile.png'})
  expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await admin.getByRole('button',{name:'Refresh signing responses',exact:true}).click()
  await expect(page.getByRole('region',{name:'Maryland additional withholding agreement',exact:true})).toContainText('Revision 1: Retained')
  await admin.getByText('Employee signing history',{exact:true}).click();await expect(admin).toContainText('Proposal 1 · Accepted')
  await propose()
  await panel.getByRole('button',{name:'Refresh withholding proposal',exact:true}).click()
  await panel.getByRole('combobox',{name:'Your agreement response',exact:true}).selectOption('DECLINE')
  await panel.getByRole('checkbox',{name:'I reviewed these terms and intend my typed name to sign my selected response.',exact:true}).check()
  await save.click();await expect(panel.getByRole('status')).toContainText('Your decline is saved')
  expect((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_maryland_additional_agreement')).rows[0].n).toBe(1)
  await employeePage.reload();await employeePage.getByRole('button',{name:'Onboarding',exact:true}).click();await panel.getByText('Your agreement responses',{exact:true}).click();await expect(panel).toContainText('Proposal 2 · Declined');expect(errors).toEqual([])
 }catch(error){console.error('Signing browser failure',error);if(!employeePage.isClosed())console.error(await employeePage.locator('body').innerText());throw error}finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}if(!employeePage.isClosed())await employeePage.unrouteAll({behavior:'ignoreErrors'});await context.close()}finally{await h.close()}}
})
