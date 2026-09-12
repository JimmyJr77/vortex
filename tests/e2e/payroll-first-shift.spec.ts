import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
test('admin reviews the current first-shift handoff after arrival instructions change',async({page})=>{
 test.setTimeout(90000);page.setDefaultTimeout(15000)
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness();try{
 const api=async(path:string,body:unknown,status=200,method='POST')=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});expect(r.status).toBe(status);return (await r.json()).data}
 const e=await api('/employees',{employeeNumber:'FIRST-SHIFT-BROWSER',legalFirstName:'First',legalLastName:'Shift',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 const shift=await api('/shifts',{employeeId:e.id,scheduledStart:'2026-08-03T12:00:00Z',scheduledEnd:'2026-08-03T16:00:00Z',location:'Reception',notes:'Meet your supervisor at reception'},201)
 await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
 await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
 await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html')
 await page.getByRole('button',{name:'People & onboarding',exact:true}).click()
 const step=page.locator('details').filter({has:page.getByText('First shift & access ready',{exact:true})})
 await step.locator('summary').first().click()
 await expect(step.getByText('Meet your supervisor at reception',{exact:true})).toBeVisible()
 await step.getByRole('textbox',{name:'Review evidence / instructions',exact:true}).fill('Reviewed supervisor, arrival instructions and assigned shift')
 await step.getByRole('button',{name:'Verify & complete',exact:true}).click()
 await expect(page.getByRole('status')).toHaveText('Step reviewed and completed.')
 await expect(step.locator('summary').first()).toContainText('COMPLETE')
 await step.locator('summary').first().click()
 await expect(step.getByText('First-shift handoff: review matches the current shift',{exact:true})).toBeVisible()
 await api(`/shifts/${shift.id}`,{notes:'Meet your supervisor in the training room'},200,'PATCH')
 await page.reload();await page.getByRole('button',{name:'People & onboarding',exact:true}).click();await step.locator('summary').first().click()
 await expect(step.locator('summary').first()).toContainText('REVIEW REQUIRED')
 await expect(step.getByText('Previously reviewed shift',{exact:true})).toBeVisible()
 await expect(step.getByText('First-shift handoff: updated review required',{exact:true})).toBeVisible()
 await expect(step.getByText('Meet your supervisor in the training room',{exact:true})).toBeVisible()
 await step.screenshot({path:'/tmp/payroll-first-shift-mobile.png'})
 await step.getByRole('textbox',{name:'Review evidence / instructions',exact:true}).fill('Reviewed the revised arrival instructions with the supervisor')
 await step.getByRole('button',{name:'Verify & complete',exact:true}).click()
 await expect(step.getByText('First-shift handoff: review matches the current shift',{exact:true})).toBeVisible()
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})
