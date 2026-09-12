import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {correctionPaymentFixture} from '../../backend/payroll/testing/correctionPaymentFixture.js'
test('shared workweek correction includes target overtime in payment review',async({page})=>{
 test.setTimeout(90000);test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness();try{
 await correctionPaymentFixture(h,{sharedWeek:true})
 await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
 await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
 await page.setViewportSize({width:390,height:1400});await page.goto('/tests/support/payroll.html')
 await page.getByRole('button',{name:'Requests & approvals',exact:true}).click()
 const card=page.getByRole('heading',{name:'Split Settlement · TIME CORRECTION',exact:true}).locator('../..')
 await card.getByRole('button',{name:'Review payroll impact',exact:true}).click()
 await card.getByRole('button',{name:'Load retained calculations',exact:true}).click()
 await card.getByRole('button',{name:'Prepare correction payment',exact:true}).click()
 await card.getByLabel('Correction processing payroll',{exact:true}).selectOption({label:'2026-08-07 through 2026-08-09'})
 await expect(card.getByLabel('Correction payment date',{exact:true})).toHaveValue('2026-09-04')
 await card.getByLabel('Correction wage-history source',{exact:true}).fill('Reviewed all synthetic employer and related-employer wage records through payment')
 await card.getByLabel('I verified complete employer and related-employer wage history through this payment date.',{exact:true}).check()
 await card.getByRole('button',{name:'Preview correction taxes',exact:true}).click()
 await expect(card.getByText('Additional take-home pay: $55.80',{exact:true})).toBeVisible()
 await expect(card.getByText('Federal withholding change: $7.50. Maryland withholding change: $5.96.',{exact:true})).toBeVisible()
 await expect(card.getByText('Prior-period correction: $50.00. Target-period wage change: $25.00.',{exact:true})).toBeVisible()
 await expect(card.getByText('Target regular hours: 16.00 → 14.00. Target overtime hours: 10.00 → 12.00.',{exact:true})).toBeVisible()
 await card.screenshot({path:'/tmp/payroll-correction-carry-mobile.png'})
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})
