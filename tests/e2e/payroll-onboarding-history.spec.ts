import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
test('admin can inspect a previous onboarding cycle without treating it as the current submission',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness()
 try{
 const r=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'HISTORY-BROWSER',legalFirstName:'Returning',legalLastName:'Signer',hireDate:'2026-08-03',hourlyRateCents:2500})});expect(r.status).toBe(201);const e=(await r.json()).data
 const task=(await h.pool.query("SELECT id FROM payroll_onboarding_task WHERE employee_id=$1 AND task_key='W4'",[e.id])).rows[0]
 await h.pool.query("UPDATE payroll_onboarding_task SET response=$2,status='COMPLETE',completed_at=now(),review_note='Synthetic prior signed-form review' WHERE id=$1",[task.id,{reference:'Synthetic signed W4 receipt 2026-A'}])
 await h.pool.query("UPDATE payroll_onboarding_task SET onboarding_cycle=2,status='OPEN',response='{}',review_note=NULL,completed_at=NULL,submitted_at=NULL,reviewed_by=NULL WHERE id=$1",[task.id])
 await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
 await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click()
 const step=page.locator('details').filter({has:page.getByText('Federal Form W-4',{exact:true})})
 await step.locator('summary').click()
 await step.getByRole('button',{name:'View saved history',exact:true}).click()
 const history=step.getByRole('region',{name:'Onboarding revision history',exact:true})
 await expect(history.getByText('Cycle 2 · OPEN',{exact:true})).toBeVisible()
 await expect(history.getByText('Cycle 1 · COMPLETE',{exact:true})).toBeVisible()
 await expect(history.getByText('Synthetic signed W4 receipt 2026-A',{exact:true})).toBeVisible()
 await expect(step.getByRole('button',{name:'Verify & complete',exact:true})).toBeDisabled()
 await page.setViewportSize({width:390,height:1400});await history.scrollIntoViewIfNeeded();await expect(history).toBeInViewport({ratio:1});await history.screenshot({path:'/tmp/payroll-onboarding-history-mobile.png'})
 expect(errors).toEqual([])
 }finally{await h.close()}
})
