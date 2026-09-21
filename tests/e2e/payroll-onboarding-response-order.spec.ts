import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {hashPayrollToken} from '../../backend/payroll/employeeAuth.js'

test('an older checklist response cannot undo a submitted payment election',async({page})=>{
 test.setTimeout(90000)
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness()
 let release=()=>{}
 const gate=new Promise<void>(resolve=>{release=resolve})
 let held=false,holdNext=false
 try{
  const created=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'RESPONSE-ORDER',legalFirstName:'Response',legalLastName:'Order',hireDate:'2026-09-01',hourlyRateCents:2500})})
  expect(created.status).toBe(201)
  const employee=(await created.json()).data
  await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[employee.id,hashPayrollToken('response-order-session')])
  await page.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','response-order-session'))
  await page.route('**/api/payroll/employee/**',async route=>{
   const url=new URL(route.request().url())
   const delay=holdNext&&url.pathname==='/api/payroll/employee/onboarding'&&route.request().method()==='GET'
   if(delay)holdNext=false
   const response=await route.fetch({url:`${h.url}${url.pathname}${url.search}`})
   if(delay){held=true;await gate}
   await route.fulfill({response,headers:{...response.headers(),...(delay?{'x-test-delayed-packet':'true'}:{})}})
  })
  await page.goto('/tests/support/payroll.html?checklist-race')
  const step=page.locator('details').filter({has:page.locator('summary',{hasText:'Payment election'})})
  await expect(step.locator('summary')).toContainText('OPEN')
  holdNext=true
  await page.getByRole('button',{name:'Refresh from parent',exact:true}).click()
  await expect.poll(()=>held).toBe(true)
  await step.locator('summary').click()
  await step.getByLabel('Payment method').selectOption('CHECK')
  await step.getByRole('button',{name:'Submit for review',exact:true}).click()
  await expect(step.locator('summary')).toContainText('SUBMITTED')
  const delayed=page.waitForResponse(response=>response.headers()['x-test-delayed-packet']==='true')
  release()
  await (await delayed).finished()
  // Let the released response and React's resulting render run before checking retention.
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))))
  await expect(step.locator('summary')).toContainText('SUBMITTED')
  await step.locator('summary').click()
  await expect(step.getByRole('button',{name:'Update submission',exact:true})).toBeVisible()
  await expect(step.getByLabel('Payment method')).toHaveValue('CHECK')
 }finally{release();await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})
