import {test,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {correctedWeightedFixture} from '../../backend/payroll/testing/correctedWeightedFixture.js'
test('corrected hourly wages carry through weighted payroll finalization',async({page})=>{
 test.setTimeout(90000);page.setDefaultTimeout(15000)
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness();try{
 const {original,period}=await correctedWeightedFixture(h)
 await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
 await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
 await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html')
 await page.getByRole('button',{name:'Payroll runs',exact:true}).click()
 await page.getByRole('combobox',{name:'Pay period',exact:true}).selectOption(String(period.id))
 await page.getByRole('button',{name:'Preview payroll',exact:true}).click()
 const review=page.getByRole('region',{name:'Weighted overtime review',exact:true})
 await expect(review.getByText('Applied to this payroll',{exact:true})).toBeVisible()
 await expect(review.getByText('54.00 hours',{exact:true})).toBeVisible()
 await expect(review.getByText(/Paid correction settlements included in prior hours and premiums/)).toBeVisible()
 await expect(review.getByText('Premium applied this run',{exact:true}).locator('..')).toContainText('$191.85')
 await review.screenshot({path:'/tmp/payroll-corrected-weighted-mobile.png'})
 await page.getByRole('button',{name:'Save draft snapshot',exact:true}).click()
 await page.getByRole('row').filter({hasText:'Sep 18, 2026'}).getByRole('button',{name:'Open review',exact:true}).click()
 await page.getByRole('button',{name:'Send to review',exact:true}).click()
 await page.getByRole('button',{name:'Approve run',exact:true}).click()
 await page.getByRole('textbox',{name:'External payment confirmation',exact:true}).fill('SYNTHETIC-CORRECTED-NATIVE-BROWSER')
 await page.getByRole('button',{name:'Confirm paid & finalize',exact:true}).click()
 await expect(page.getByText('Payroll finalized and employee statements saved.',{exact:true})).toBeVisible()
 const run=(await h.pool.query('SELECT id FROM payroll_run WHERE pay_period_id=$1',[period.id])).rows[0]
 assert.deepEqual((await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id<>$1 ORDER BY id',[run.id])).rows,original)
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})
