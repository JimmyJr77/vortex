import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {carrierInvoiceHistoryFixture} from '../../backend/payroll/testing/carrierInvoiceHistoryFixture.js'
test('admin reads older invoice assessments and failures with stable pages and retry',async({page})=>{
 test.setTimeout(90000);page.setDefaultTimeout(15000);test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness();let unavailable=false
 try{
  const {append}=await carrierInvoiceHistoryFixture(h),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'));await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());if(unavailable&&u.pathname.endsWith('/reconciliation-history'))return route.fulfill({status:503,json:{success:false,message:'Synthetic history page unavailable'}});await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Reports & QuickBooks',exact:true}).click()
  const invoices=page.getByRole('region',{name:'Carrier invoice reconciliation',exact:true});await invoices.getByLabel('Carrier coverage month',{exact:true}).fill('2026-09');await invoices.getByRole('button',{name:'Load carrier invoices',exact:true}).click();await invoices.getByText('Prepare carrier payment',{exact:true}).click();await invoices.getByText('All evidence for this invoice revision',{exact:true}).click()
  const history=invoices.getByRole('region',{name:'Full invoice evidence history',exact:true});await history.getByRole('button',{name:'Load invoice evidence history',exact:true}).click();await expect(history.locator('article')).toHaveCount(20);await expect(history).toContainText('Synthetic historical review 25');await expect(history).toContainText('Synthetic retained invoice failure')
  await append(26,'2020-01-01T00:00:00.000001Z');unavailable=true;await history.getByRole('button',{name:'Load older invoice evidence',exact:true}).click();await expect(history.getByRole('alert')).toContainText('Synthetic history page unavailable');await expect(history.locator('article')).toHaveCount(20)
  unavailable=false;await history.getByRole('button',{name:'Load older invoice evidence',exact:true}).click();await expect(history.locator('article')).toHaveCount(26);await expect(history).toContainText('All entries in this snapshot are shown.');await expect(history).not.toContainText('Synthetic historical review 26')
  await history.getByRole('button',{name:'Refresh invoice evidence history',exact:true}).click();await expect(history.locator('article')).toHaveCount(20);await history.getByRole('button',{name:'Load older invoice evidence',exact:true}).click();await expect(history.locator('article')).toHaveCount(27);await expect(history).toContainText('Synthetic historical review 26');await expect(history.getByRole('button',{name:'Load older invoice evidence',exact:true})).toHaveCount(0)
  await history.locator('article').last().screenshot({path:'/tmp/payroll-carrier-history-oldest-mobile.png'});expect(errors).toEqual([])
 }finally{await page.unrouteAll({behavior:'wait'}).catch(()=>{});await page.close().catch(()=>{});await h.close()}
})
