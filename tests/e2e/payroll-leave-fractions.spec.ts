import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
test('admin reviews and restores historical leave rounding losses without changing paid statements',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated localhost payroll database')
 const h=await createHarness()
 try{
  const response=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'FRACTION-BROWSER',legalFirstName:'Fraction',legalLastName:'Browser',hireDate:'2026-01-01',hourlyRateCents:2500})});expect(response.ok).toBeTruthy();const employee=(await response.json()).data
  for(const [month,minutes] of [[7,1561],[8,1589]]){
   const p=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,make_date(2026,$1,1),make_date(2026,$1,15),make_date(2026,$1,20),'SEMIMONTHLY') RETURNING id",[month])).rows[0]
   const r=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(1,$1,'FINALIZED') RETURNING id",[p.id])).rows[0]
   await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,regular_minutes,sick_leave_accrual_minutes) VALUES($1,$2,$3,52)',[r.id,employee.id,minutes])
  }
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const url=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${url.pathname}${url.search}`})})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
  const panel=page.locator('section').filter({has:page.getByRole('heading',{name:'Recover historical leave fractions',exact:true})})
  await panel.getByRole('button',{name:'Preview historical leave fractions',exact:true}).click()
  await expect(panel.getByText(/Restore 1 whole minute on/)).toBeVisible()
  await expect(panel.getByRole('button',{name:'Apply leave fraction recovery',exact:true})).toBeDisabled()
  await panel.getByLabel('Historical leave review reference',{exact:true}).fill('Verified payroll records and prior restoration ledger')
  await panel.getByLabel('I verified these fractions were not previously restored and approve the recovery shown above.',{exact:true}).check()
  await page.setViewportSize({width:390,height:1200});await panel.scrollIntoViewIfNeeded();await expect(panel).toBeInViewport({ratio:1});await panel.screenshot({path:'/tmp/payroll-leave-fractions-mobile.png'})
  await panel.getByRole('button',{name:'Apply leave fraction recovery',exact:true}).click()
  await expect(panel.getByText('Historical leave fractions reconciled and audited.',{exact:true})).toBeVisible()
  expect((await h.pool.query('SELECT credited_minutes FROM payroll_leave_fraction_reconciliation WHERE employee_id=$1',[employee.id])).rows[0].credited_minutes).toBe(1)
  await panel.getByRole('button',{name:'Preview historical leave fractions',exact:true}).click()
  await expect(panel.getByRole('alert')).toHaveText('No untracked fractional accrual remains to reconcile.')
 }finally{await h.close()}
})
