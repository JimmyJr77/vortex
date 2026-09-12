import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
test('admin records and disables check activation from payroll setup on mobile',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(60000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const account='00000000-0000-4000-8000-000000000002';let calls=0
 const h=await createHarness({paymentFetcher:async()=>{calls++;return {ok:true,status:200,json:async()=>({id:account,currency:'USD',live_mode:false})}}})
 try{
  const headers={Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'}
  const connection=await fetch(`${h.url}/api/admin/payroll/payment-connection`,{method:'POST',headers,body:JSON.stringify({organizationId:'00000000-0000-4000-8000-000000000001',originatingAccountId:account,apiKey:'synthetic-check-key',mode:'TEST',reference:'Synthetic browser check connection',expectedRevision:0,confirmed:true})});expect(connection.status).toBe(201)
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click()
  const view=page.getByRole('region',{name:'Payroll check configuration',exact:true})
  await expect(view).toContainText('NOT CONFIGURED')
  const save=view.getByRole('button',{name:'Save check setup',exact:true});await expect(save).toBeDisabled()
  await view.getByLabel('Digital checks are enabled for this funding account',{exact:true}).check()
  await view.getByLabel('Check activation or disablement reference',{exact:true}).fill('Synthetic browser provider activation')
  await view.getByLabel('I confirm this check setup applies to the current employer funding account.',{exact:true}).check();await save.click()
  await expect(view.getByRole('alert')).toContainText('Verify the current funding account')
  await page.getByRole('region',{name:'Payroll payment connection',exact:true}).getByRole('button',{name:'Verify funding account',exact:true}).click()
  await expect(page.getByRole('region',{name:'Payroll payment connection',exact:true})).toContainText('Funding account matched')
  await view.getByLabel('I confirm this check setup applies to the current employer funding account.',{exact:true}).check();await save.click()
  await expect(view).toContainText('ACTIVATION RECORDED');await expect(view.getByRole('status')).toContainText('No check has been issued')
  await view.getByText('Check setup history',{exact:true}).click();await expect(view).toContainText('Synthetic browser provider activation')
  await view.screenshot({path:'/tmp/payroll-check-configuration-mobile.png'})
  expect(await view.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
  await view.getByLabel('Digital checks are enabled for this funding account',{exact:true}).uncheck()
  await view.getByLabel('Check activation or disablement reference',{exact:true}).fill('Synthetic browser check disablement')
  await view.getByLabel('I confirm this check setup applies to the current employer funding account.',{exact:true}).check();await save.click()
  await expect(view).toContainText('DISABLED');expect(calls).toBe(1)
  expect((await h.pool.query('SELECT * FROM payroll_check_configuration')).rowCount).toBe(2)
 }finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
