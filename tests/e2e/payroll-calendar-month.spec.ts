import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
test('admin generates a selected future calendar month without duplicating periods',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness();try{
 await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
 await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
 await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html')
 await page.getByRole('button',{name:'Payroll runs',exact:true}).click()
 await page.getByLabel('Pay calendar month',{exact:true}).fill('2027-10')
 await page.getByRole('button',{name:'Generate pay periods',exact:true}).click()
 await expect(page.getByText('Pay periods generated for 2027-10.',{exact:true})).toBeVisible()
 const count=async()=>Number((await h.pool.query('SELECT count(*) FROM payroll_pay_period')).rows[0].count)
 const original=await count();expect(original).toBeGreaterThan(0)
 await expect(page.getByRole('combobox',{name:'Pay period',exact:true})).toContainText('Oct 15, 2027')
 const response=page.waitForResponse(r=>r.url().includes('/pay-periods/generate')&&r.request().method()==='POST')
 await page.getByRole('button',{name:'Generate pay periods',exact:true}).click();expect((await response).status()).toBe(201)
 expect(await count()).toBe(original)
 await page.getByRole('heading',{name:'Pay calendar',exact:true}).locator('../..').screenshot({path:'/tmp/payroll-calendar-month-mobile.png'})
 await page.getByLabel('Pay calendar month',{exact:true}).fill('')
 await expect(page.getByRole('button',{name:'Generate pay periods',exact:true})).toBeDisabled()
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})
