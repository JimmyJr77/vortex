import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
test('admin records a single annual bonus with discretion evidence and sees it in payroll review',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated local payroll database')
 const h=await createHarness()
 try{
  const r=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'BONUS-BROWSER',legalFirstName:'Bonus',legalLastName:'Browser',hireDate:'2026-08-03',hourlyRateCents:2500})});expect(r.ok).toBeTruthy();const employee=(await r.json()).data
  await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[employee.id])
  const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const url=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${url.pathname}${url.search}`})})})
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
  await page.getByRole('combobox',{name:'Bonus pay period',exact:true}).selectOption(String(period.id))
  await page.getByLabel('Bonus amount ($)',{exact:true}).fill('1000')
  await page.getByRole('combobox',{name:'Bonus classification',exact:true}).selectOption('DISCRETIONARY')
  for(const label of ['The employer retained discretion whether to pay until at or near the end of the bonus period.','The employer retained discretion over the amount until at or near the end of the bonus period.','There was no prior promise, agreement or expectation of this bonus.'])await page.getByLabel(label,{exact:true}).check()
  await page.getByLabel('Bonus review evidence',{exact:true}).fill('Synthetic annual bonus decision and verified payroll treatment')
  await page.getByLabel('I verified the annual bonus classification and payroll tax treatment.',{exact:true}).check()
  await page.getByRole('button',{name:'Record annual bonus',exact:true}).click()
  await expect(page.getByText(/Annual bonus recorded for the selected period/)).toBeVisible()
  await page.getByRole('button',{name:'Payroll runs',exact:true}).click();await page.getByRole('combobox',{name:'Pay period',exact:true}).selectOption(String(period.id));await page.getByRole('button',{name:'Preview payroll',exact:true}).click()
  const review=page.getByRole('region',{name:'Bonus calculation review'})
  await expect(review.getByText('Annual bonus · $1,000.00 · verified discretionary bonus',{exact:true})).toBeVisible()
  await page.setViewportSize({width:390,height:844});await review.scrollIntoViewIfNeeded();await expect(review).toBeInViewport({ratio:1});await review.screenshot({path:'/tmp/payroll-annual-bonus-mobile.png'})
  expect(errors).toEqual([])
 }finally{await h.close()}
})
test('earned bonus saves reviewed workweeks and resets when the bonus amount changes',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated local payroll database')
 const h=await createHarness()
 try{
  const r=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'EARNED-BROWSER',legalFirstName:'Earned',legalLastName:'Browser',hireDate:'2026-08-03',hourlyRateCents:2500})});expect(r.ok).toBeTruthy();const employee=(await r.json()).data
  await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[employee.id])
  const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
  for(let i=3;i<=8;i++)await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[employee.id,`2026-08-0${i}T12:00:00Z`,`2026-08-0${i}T22:00:00Z`])
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const url=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${url.pathname}${url.search}`})})})
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
  await page.getByLabel('Bonus amount ($)',{exact:true}).fill('100')
  await page.getByRole('combobox',{name:'Bonus classification',exact:true}).selectOption('NONDISCRETIONARY')
  const preview=page.getByRole('region',{name:'Earned bonus overtime allocation'})
  await preview.getByLabel('Bonus earning start',{exact:true}).fill('2026-08-03');await preview.getByLabel('Bonus earning end',{exact:true}).fill('2026-08-03')
  await preview.getByRole('checkbox').check();await preview.getByRole('button',{name:'Calculate bonus overtime',exact:true}).click()
  await expect(preview.getByText('Additional bonus overtime: $16.67',{exact:true})).toBeVisible()
  await expect(preview.getByText('10 earned hours · 60 full-week hours · 20 overtime hours',{exact:true})).toBeVisible()
  await page.setViewportSize({width:390,height:1000});await preview.scrollIntoViewIfNeeded();await expect(preview).toBeInViewport({ratio:1});await preview.screenshot({path:'/tmp/payroll-earned-bonus-mobile.png'})
  await page.getByRole('combobox',{name:'Bonus pay period',exact:true}).selectOption(String(period.id))
  await page.getByLabel('Bonus review evidence',{exact:true}).fill('Synthetic earned-hours agreement and reviewed overtime allocation')
  await page.getByLabel('I verified the annual bonus classification and payroll tax treatment.',{exact:true}).check()
  await page.getByRole('button',{name:'Record annual bonus',exact:true}).click()
  await expect(page.getByText(/Annual bonus recorded for the selected period/)).toBeVisible()
  const saved=(await h.pool.query("SELECT bonus_review FROM payroll_recurring_adjustment WHERE employee_id=$1",[employee.id])).rows[0].bonus_review
  expect(saved.earnedStart).toBe('2026-08-03');expect(saved.allocation.additionalOvertimeCents).toBe(1667);expect(saved.allocation.evidence).toHaveLength(6)
  await page.getByLabel('Bonus amount ($)',{exact:true}).fill('200');await expect(preview.getByRole('status')).toHaveCount(0);await expect(preview.getByRole('checkbox')).not.toBeChecked()
  await page.getByRole('button',{name:'Payroll runs',exact:true}).click();await page.getByRole('combobox',{name:'Pay period',exact:true}).selectOption(String(period.id));await page.getByRole('button',{name:'Preview payroll',exact:true}).click()
  const paymentReview=page.getByRole('region',{name:'Bonus calculation review'})
  await expect(paymentReview.getByText('Additional bonus overtime: $16.67',{exact:true})).toBeVisible()
  await expect(paymentReview.getByText('Earned 2026-08-03 through 2026-08-03',{exact:true})).toBeVisible()
  await paymentReview.scrollIntoViewIfNeeded();await expect(paymentReview).toBeInViewport({ratio:1});await paymentReview.screenshot({path:'/tmp/payroll-earned-bonus-payment-mobile.png'})
  expect(errors).toEqual([])
 }finally{await h.close()}
})
