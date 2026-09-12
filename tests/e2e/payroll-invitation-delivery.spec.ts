import {recordPayrollAutomation} from '../../backend/payroll/automationHistory.js'
import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {monthlyBenefitsFixture} from '../../backend/payroll/testing/monthlyBenefitsFixture.js'
test('suppressed employee invitation shows a warning and retains the one-time link',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 let sends=0
 const h=await createHarness({invitationSender:async()=>{sends++;return {sent:false,suppressed:true}}})
 try{
 await monthlyBenefitsFixture(h)
 await recordPayrollAutomation(h.pool,1,'MANUAL',async()=>({syncs:0}))
 await recordPayrollAutomation(h.pool,1,'SCHEDULED',async()=>{throw new Error('Synthetic check failure')}).catch(()=>{})
 await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
 await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
 await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html')
 await expect(page.getByText('Scheduled payroll checks failed',{exact:true})).toBeVisible()
 await page.getByText('Scheduled payroll checks failed',{exact:true}).locator('..').locator('..').screenshot({path:'/tmp/payroll-check-failure-alert-mobile.png'})
 await page.getByRole('button',{name:'Employer setup',exact:true}).click()
 const services=page.getByRole('region',{name:'Onboarding service setup',exact:true})
 for(const title of ['W-2 availability email','Signed W-2 return verification','Scheduled W-2 return reconciliation','Secure form uploads','Invitation email','Employee invitation links','Scheduled payroll checks'])await expect(services.getByRole('heading',{name:title,exact:true})).toBeVisible()
 await services.getByRole('button',{name:'Refresh service setup',exact:true}).click();await expect(services.getByRole('button',{name:'Refresh service setup',exact:true})).toBeEnabled()
 await expect(services).toContainText('Manual workforce checks · Completed');await expect(services).toContainText('Scheduled payroll checks · Failed')
 await expect(services).toContainText('0 verified returns retained · 0 pending reconciliation');await expect(services).toContainText('No provider-return reconciliation check has been recorded.')
 await services.screenshot({path:'/tmp/payroll-service-readiness-mobile.png'})
 await page.route('**/api/admin/payroll/service-readiness',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic setup check unavailable'})}));await services.getByRole('button',{name:'Refresh service setup',exact:true}).click();await expect(services.getByRole('alert')).toHaveText('Synthetic setup check unavailable');await expect(services.getByRole('heading',{name:'W-2 provider return activity',exact:true})).toHaveCount(0)
 await page.getByRole('button',{name:'People & onboarding',exact:true}).click();await page.getByRole('button',{name:/Monthly Benefits.*MONTHLY-BENEFITS/}).click()
 await page.getByRole('textbox',{name:'Employee invitation email',exact:true}).fill('delivery@example.test')
 await page.getByRole('button',{name:'Create & email',exact:true}).click()
 const warning=page.getByText(/Invitation created, but email was not sent:/)
 await expect(warning).toBeVisible();await expect(page.getByRole('textbox',{name:'One-time employee invitation link',exact:true})).toHaveValue(/\/employee\/payroll\?invite=/)
 await expect(page.getByText('One-time employee payroll invitation sent.',{exact:true})).toHaveCount(0);expect(sends).toBe(1)
 await warning.screenshot({path:'/tmp/payroll-invitation-delivery-warning.png'})
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})
