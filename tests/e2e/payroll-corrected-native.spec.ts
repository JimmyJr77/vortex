import {test,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {correctedNativeFixture} from '../../backend/payroll/testing/correctedNativeFixture.js'
const expectEqual=assert.equal,expectTruthy=assert.ok
test('corrected hourly wages carry through admin salary payroll finalization',async({page})=>{
 test.setTimeout(90000);page.setDefaultTimeout(15000)
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness();try{
 const {api,e,original,period}=await correctedNativeFixture(h)
 const allocationInput={payPeriodId:period.id,week:'2026-08-03',salaryAllocations:[{employmentStart:'2026-08-07',earningsCents:120000,source:'Synthetic reviewed salary allocation for the full workweek'}]}
 const allocation=await api(`/employees/${e.id}/workweek-allocation-preview`,allocationInput)
 await api(`/employees/${e.id}/workweek-allocations`,{...allocationInput,fingerprint:allocation.fingerprint,requestId:'corrected-native-allocation',reason:'Review corrected hourly pay and the later salary agreement',confirmed:true},'POST',201)
 const review=(await api('/runs/preview',{payPeriodId:period.id})).preview.employees[0].employmentWeekReviews[0]
 expectEqual(review.paymentReconciliation.status,'EVIDENCE_RECONCILED',JSON.stringify(review.paymentReconciliation.issues))
 expectEqual(review.paymentReconciliation.totals.workedMinutes,1680)
 expectEqual(review.paymentReconciliation.totals.straightTimePayCents,70000)
 expectEqual(review.paymentReconciliation.totals.premiumCents,0)
 expectTruthy(review.paymentReconciliation.paid.some(p=>p.coverageSource==='CORRECTED_NATIVE_HOURLY'))
 await api(`/employees/${e.id}/workweek-settlement-authorizations`,{payPeriodId:period.id,week:allocationInput.week,fingerprint:review.paymentReconciliation.fingerprint,requestId:'corrected-native-payment',reason:'Confirm original and correction wage payments before salary settlement',historyComplete:true,confirmed:true},'POST',201)
 const preview=(await api('/runs/preview',{payPeriodId:period.id})).preview
 expectEqual(preview.canApprove,true,JSON.stringify(preview.warnings))
 expectEqual(preview.employees[0].grossPayCents,120000+allocation.calculation.overtimePremiumCents)
 await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
 await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
 await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html')
 await page.getByRole('button',{name:'Payroll runs',exact:true}).click()
 await page.getByRole('combobox',{name:'Pay period',exact:true}).selectOption(String(period.id))
 await page.getByRole('button',{name:'Preview payroll',exact:true}).click()
 const credit=page.getByText(/corrected dated wages include paid settlement/)
 await expect(credit).toBeVisible()
 await expect(page.getByText(/correction payment is credited to its original work dates/)).toBeVisible()
 await credit.locator('..').screenshot({path:'/tmp/payroll-corrected-native-mobile.png'})
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
