import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
test('payroll review explains and preserves leave eligibility from the preceding schedule',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated localhost payroll database')
 const h=await createHarness()
 try{
  const response=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'LEAVE-BROWSER',legalFirstName:'Leave',legalLastName:'Browser',hireDate:'2026-01-01',hourlyRateCents:2500})})
  expect(response.ok).toBeTruthy();const employee=(await response.json()).data
  await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[employee.id])
  const current=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-16','2026-08-22','2026-08-27','WEEKLY') RETURNING id")).rows[0]
  const prior=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-01','2026-08-15','2026-08-20','SEMIMONTHLY') RETURNING id")).rows[0]
  const run=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(1,$1,'FINALIZED') RETURNING id",[prior.id])).rows[0]
  await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,regular_minutes) VALUES($1,$2,720)',[run.id,employee.id])
  await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2026-08-16T12:00:00Z','2026-08-17T00:01:00Z','ADMIN','APPROVED')",[employee.id])
  await h.pool.query(`INSERT INTO payroll_schedule_version(facility_id,effective_on,schedule_settings,source) VALUES(1,'2000-01-01',$1,'Synthetic original'),(1,'2026-08-16',$2,'Synthetic transition')`,[{pay_frequency:'SEMIMONTHLY'},{pay_frequency:'WEEKLY',pay_period_anchor_start:'2026-08-16',pay_period_payment_lag_days:5}])
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const url=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${url.pathname}${url.search}`})})})
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Payroll runs',exact:true}).click()
  await page.getByRole('combobox',{name:'Pay period',exact:true}).selectOption(String(current.id))
  await page.getByRole('button',{name:'Preview payroll',exact:true}).click()
  const review=page.getByRole('region',{name:'Sick leave accrual review'})
  await expect(review.getByText(/24 minutes accrued/)).toBeVisible()
  await expect(review.getByText('Fraction carried into this run: 0/30 minute · carried forward: 1/30 minute.',{exact:true})).toBeVisible()
  await expect(review.getByText(/Prior semimonthly period: 2026-08-01 through 2026-08-15/)).toBeVisible()
  await page.getByRole('button',{name:'Save draft snapshot',exact:true}).click()
  await page.getByRole('button',{name:'Open review',exact:true}).last().click()
  await expect(review.last().getByText(/24 minutes accrued/)).toBeVisible()
  await page.setViewportSize({width:390,height:844});await review.last().scrollIntoViewIfNeeded();await expect(review.last()).toBeInViewport({ratio:1});await review.last().screenshot({path:'/tmp/payroll-transition-leave-mobile.png'})
  await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
  const ledger=page.locator('section').filter({has:page.getByRole('heading',{name:'Time off balances & ledger',exact:true})})
  await ledger.getByRole('combobox',{name:'Employee',exact:true}).selectOption(String(employee.id))
  await ledger.getByRole('combobox',{name:'Leave entry type',exact:true}).selectOption('OPENING_BALANCE')
  await ledger.getByLabel('Transaction date',{exact:true}).fill('2026-01-01')
  await ledger.getByLabel('Minutes',{exact:true}).fill('2400')
  await ledger.getByLabel('Reason',{exact:true}).fill('Verified opening ledger from prior records')
  await ledger.getByRole('button',{name:'Record leave entry',exact:true}).click()
  await expect(page.getByText('Leave ledger entry recorded and audited.',{exact:true})).toBeVisible()
  expect((await h.pool.query("SELECT transaction_kind FROM payroll_leave_transaction WHERE employee_id=$1 AND reason='Verified opening ledger from prior records'",[employee.id])).rows[0].transaction_kind).toBe('OPENING_BALANCE')
  await page.setViewportSize({width:390,height:1200});await ledger.scrollIntoViewIfNeeded();await expect(ledger).toBeInViewport({ratio:1});await ledger.screenshot({path:'/tmp/payroll-leave-entry-mobile.png'})
  expect(errors).toEqual([])
 }finally{await h.close()}
})
