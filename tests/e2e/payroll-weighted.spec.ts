import { test, expect } from '@playwright/test'
import { createHarness } from '../../backend/payroll/testing/harness.js'

test('weighted workweek amounts remain visible in preview and saved payroll review', async ({ page }) => {
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL, 'Requires isolated localhost payroll database')
 const h = await createHarness()
 try {
  const api = async (path: string, body: unknown) => {
   const response = await fetch(`${h.url}/api/admin/payroll${path}`, {method:'POST', headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)})
   const json = await response.json(); expect(response.ok, JSON.stringify(json)).toBeTruthy(); return json.data
  }
  const employee = await api('/employees',{employeeNumber:'WEIGHTED-BROWSER',legalFirstName:'Jordan',legalLastName:'Weighted',hireDate:'2026-01-01',hourlyRateCents:2000})
  await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[employee.id])
  await h.pool.query("INSERT INTO payroll_pay_rate(facility_id,employee_id,effective_on,hourly_rate_cents,reason,notice_delivered_on,notice_reference) VALUES(1,$1,'2026-09-03',2600,'Synthetic history','2026-08-01','Synthetic signed notice')",[employee.id])
  for(const day of [1,3]) await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[employee.id,`2026-09-0${day}T04:00:00Z`,`2026-09-0${day+1}T04:00:00Z`])
  const periods = await api('/pay-periods/generate',{year:2026,month:9})
  const period = periods.find((p: {period_start: string}) => p.period_start.startsWith('2026-09-01'))
  await page.addInitScript(() => localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**', async route => {
   const url = new URL(route.request().url())
   const response = await route.fetch({url:`${h.url}${url.pathname}${url.search}`})
   await route.fulfill({response})
  })
  const errors: string[] = []; page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/tests/support/payroll.html')
  await page.getByRole('button',{name:'Payroll runs',exact:true}).click()
  await page.getByRole('combobox',{name:'Pay period',exact:true}).selectOption(String(period.id))
  await page.getByRole('button',{name:'Preview payroll',exact:true}).click()
  const review = page.getByRole('region',{name:'Weighted overtime review'})
  await expect(review).toHaveCount(1)
  await expect(review.getByRole('heading',{name:'Jordan Weighted · week of 2026-08-31'})).toBeVisible()
  for(const [label,value] of Object.entries({'Full workweek hours':'48.00 hours','Weighted hourly rate':'$23.00','Overtime through period':'8.00 hours','Premium earned through period':'$92.00','Premium already paid':'$0.00','Premium applied this run':'$92.00'})) {
   await expect(review.locator('dl > div').filter({has:page.getByText(label,{exact:true})}).locator('dd')).toHaveText(value)
  }
  await page.getByRole('button',{name:'Save draft snapshot'}).click()
  await page.getByRole('button',{name:'Open review'}).click()
  await expect(review.last().getByText('Applied to this payroll',{exact:true})).toBeVisible()
  await expect(review.last().getByText('$92.00',{exact:true})).toHaveCount(2)
  await page.setViewportSize({width:390,height:844})
  await review.last().scrollIntoViewIfNeeded()
  await review.last().screenshot({path:'/tmp/payroll-weighted-review-mobile.png'})
  await h.pool.query("UPDATE payroll_time_entry SET status='UNVERIFIED' WHERE employee_id=$1 AND clock_in='2026-09-03T04:00:00Z'",[employee.id])
  await page.getByRole('button',{name:'Preview payroll',exact:true}).click()
  await expect(review.first().getByText('Review required: context review required',{exact:true})).toBeVisible()
  await expect(review.first().getByText('Not applied',{exact:true})).toBeVisible()
  await expect(review.first().getByText('Complete and approve all workweek time before settling its weighted premium.',{exact:true})).toBeVisible()
  expect(errors).toEqual([])
 } finally { await h.close() }
})
