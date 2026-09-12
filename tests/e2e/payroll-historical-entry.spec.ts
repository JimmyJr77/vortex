import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
test('admin records prior wages with evidence and recovers a lost response without duplication',async({page})=>{
 test.setTimeout(90000)
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness()
 try{
  const created=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'HIST-BROWSER',legalFirstName:'Historical',legalLastName:'Browser',hireDate:'2026-01-01',hourlyRateCents:2500})})
  expect(created.status).toBe(201);const employee=(await created.json()).data
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  let loseResponse=true
  await page.route('**/api/admin/payroll/**',async route=>{const url=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${url.pathname}${url.search}`});if(url.pathname.endsWith('/historical-payments')&&response.status()===201&&loseResponse){loseResponse=false;await route.abort('failed')}else await route.fulfill({response})})
  await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html')
  await page.getByText('Record prior wage payment',{exact:true}).click()
  const form=page.getByText('Record prior wage payment',{exact:true}).locator('..')
  await form.getByLabel('Employee for historical payment',{exact:true}).selectOption(String(employee.id),{timeout:10000})
  for(const [label,value] of [['Work period starts','2026-08-03'],['Work period ends','2026-08-05'],['Actual prior payment date','2026-08-14'],['Prior payment reference','SYNTHETIC-BROWSER-001'],['Gross wages ($)','600'],['Taxes withheld ($)','120'],['Net paid ($)','481'],['Historical payment source evidence','Synthetic register matched to the cleared prior wage payment']])await form.getByLabel(label,{exact:true}).fill(value)
  await form.getByRole('checkbox').nth(0).check();await form.getByRole('checkbox').nth(1).check()
  await form.getByRole('button',{name:'Save prior wage payment',exact:true}).click();await expect(form.getByRole('alert')).toContainText('Gross wages minus withheld taxes')
  await form.getByLabel('Net paid ($)',{exact:true}).fill('480');await form.getByRole('checkbox').nth(1).check()
  await form.screenshot({path:'/tmp/payroll-historical-entry-mobile.png'})
  await form.getByRole('button',{name:'Save prior wage payment',exact:true}).click();await expect(form.getByRole('alert')).toBeVisible()
  await form.getByRole('button',{name:'Save prior wage payment',exact:true}).click();await expect(form.getByRole('status')).toContainText('Historical payment recorded.')
  expect((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_historical_payment')).rows[0].n).toBe(1)
  expect((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_audit_log WHERE action='HISTORICAL_PAYMENT_RECORDED'")).rows[0].n).toBe(1)
  await expect(page.getByRole('cell',{name:'CHECK · SYNTHETIC-BROWSER-001',exact:true})).toBeVisible()
  await page.getByText('Payment evidence',{exact:true}).click()
  await expect(page.getByText('Synthetic register matched to the cleared prior wage payment',{exact:true})).toBeVisible()
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})
