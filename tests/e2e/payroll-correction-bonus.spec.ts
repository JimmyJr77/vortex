import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {correctionBonusFixture} from '../../backend/payroll/testing/correctionBonusFixture.js'
for(const sharedWeek of [false,true])test(`later bonus includes paid correction evidence: shared week ${sharedWeek}`,async({page})=>{
 test.setTimeout(90000);page.setDefaultTimeout(15000);test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness();try{
  const {bonusPeriod}=await correctionBonusFixture(h,sharedWeek?{sharedWeek:true}:{missingTime:true})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html')
  await page.getByRole('button',{name:'Payroll runs',exact:true}).click()
  await page.getByRole('combobox',{name:'Pay period',exact:true}).selectOption(String(bonusPeriod.id))
  await page.getByRole('button',{name:'Preview payroll',exact:true}).click()
  const review=page.getByRole('region',{name:'Bonus calculation review',exact:true})
  await expect(review.getByText(`Additional bonus overtime: $${sharedWeek?'11.54':'2.38'}`,{exact:true})).toBeVisible()
  await expect(review.getByText('Paid correction settlements included: #1',{exact:true})).toBeVisible()
  await review.screenshot({path:`/tmp/payroll-correction-bonus-${sharedWeek?'shared':'missing'}.png`})
  await page.getByRole('button',{name:'Save draft snapshot',exact:true}).click()
  await page.getByRole('row').filter({hasText:'Sep 18, 2026'}).getByRole('button',{name:'Open review',exact:true}).click()
  await page.getByRole('button',{name:'Send to review',exact:true}).click();await page.getByRole('button',{name:'Approve run',exact:true}).click()
  await page.getByRole('textbox',{name:'External payment confirmation',exact:true}).fill('SYNTHETIC-BONUS-AFTER-CORRECTION')
  await page.getByRole('button',{name:'Confirm paid & finalize',exact:true}).click()
  await expect(page.getByText('Payroll finalized and employee statements saved.',{exact:true})).toBeVisible()
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})
