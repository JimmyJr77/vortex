import fs from 'node:fs/promises'
import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {hashPayrollToken} from '../../backend/payroll/employeeAuth.js'
test('employee cannot acknowledge handbook terms changed while the page is open',async({page})=>{
 test.setTimeout(90000);page.setDefaultTimeout(15000)
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness();try{
 const r=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'HANDBOOK-BROWSER',legalFirstName:'Draft',legalLastName:'Employee',hireDate:'2026-08-03',hourlyRateCents:2500})})
 expect(r.status).toBe(201);const e=(await r.json()).data
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[e.id,hashPayrollToken('draft-browser-session')])
 await page.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','draft-browser-session'))
 await page.route('**/api/payroll/employee/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 const setPolicy=async(handbookText:string,benefitsText:string)=>{
  const response=await fetch(`${h.url}/api/admin/payroll/settings`,{method:'PATCH',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({handbookText,benefitsText})})
  expect(response.status).toBe(200)
 }
 await setPolicy('Original handbook policy','Original benefit instructions')
 await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html?employee')
 await page.getByRole('button',{name:'Onboarding',exact:true}).click()
 const step=page.locator('details').filter({has:page.getByText('Handbook & leave policy acknowledgment',{exact:true})})
 await step.locator('summary').click()
 await step.getByRole('textbox',{name:'Your full name',exact:true}).fill('Current Signer')
 await step.getByRole('checkbox').check()
 await setPolicy('Revised handbook policy','Revised benefit instructions')
 await step.getByRole('button',{name:'Submit for review',exact:true}).click()
 await expect(page.getByRole('alert')).toContainText('Handbook or benefits terms changed')
 await page.reload();await page.getByRole('button',{name:'Onboarding',exact:true}).click()
 await step.locator('summary').click()
 await expect(step.getByText(/Revised handbook policy/)).toBeVisible()
 await expect(step.getByRole('checkbox')).not.toBeChecked()
 await step.getByRole('textbox',{name:'Your full name',exact:true}).fill('Current Signer')
 await step.getByRole('checkbox').check()
 await step.getByRole('button',{name:'Submit for review',exact:true}).click()
 await expect(page.getByRole('status')).toHaveText('Step submitted for review.')
 await step.locator('summary').click()
 await step.screenshot({path:'/tmp/payroll-handbook-current-mobile.png'})
 const saved=(await h.pool.query("SELECT response FROM payroll_onboarding_task WHERE employee_id=$1 AND task_key='HANDBOOK'",[e.id])).rows[0].response
 expect(saved.terms).toBe('Revised handbook policy');expect(saved.benefitsTerms).toBe('Revised benefit instructions')
 const task=(await h.pool.query("SELECT id FROM payroll_onboarding_task WHERE employee_id=$1 AND task_key='HANDBOOK'",[e.id])).rows[0]
 const adminReview=async(status:string)=>{
  const response=await fetch(`${h.url}/api/admin/payroll/employees/${e.id}/onboarding/${task.id}/review`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({status,note:'Reviewed policy acknowledgment and requested any necessary renewal'})})
  expect(response.status).toBe(200)
 }
 await adminReview('COMPLETE')
 await setPolicy('Second revised handbook policy','Revised benefit instructions')
 await page.reload();await page.getByRole('button',{name:'Onboarding',exact:true}).click()
 await step.locator('summary').click()
 await expect(step.locator('summary')).toContainText('REVIEW REQUIRED')
 await expect(step.getByText(/Ask your hiring admin to reopen this step/)).toBeVisible()
 await expect(step.getByRole('checkbox')).toHaveCount(0)
 await step.screenshot({path:'/tmp/payroll-ack-renewal-mobile.png'})
 await adminReview('CHANGES_REQUESTED')
 await page.reload();await page.getByRole('button',{name:'Onboarding',exact:true}).click()
 await expect(step.getByRole('checkbox')).not.toBeChecked()
 await step.getByRole('checkbox').check()
 await step.getByRole('button',{name:'Submit for review',exact:true}).click()
 await expect(page.getByRole('status')).toHaveText('Step submitted for review.')
 await adminReview('COMPLETE')
 await page.reload();await page.getByRole('button',{name:'Onboarding',exact:true}).click()
 await step.locator('summary').click()
 await step.getByRole('button',{name:'View my acknowledgments',exact:true}).click()
 const history=step.getByRole('region',{name:'Your saved acknowledgments',exact:true})
 await expect(history.getByLabel('Saved acknowledged terms').first()).toContainText('Second revised handbook policy')
 await expect(history.getByLabel('Saved acknowledged terms').last()).toContainText('Revised handbook policy')
 await history.screenshot({path:'/tmp/payroll-acknowledgment-copies-mobile.png'})
 const pendingDownload=page.waitForEvent('download')
 await history.getByRole('button',{name:'Download acknowledgment copy',exact:true}).first().click()
 const download=await pendingDownload
 await download.saveAs('/tmp/payroll-acknowledgment-copy.txt')
 const copy=await fs.readFile('/tmp/payroll-acknowledgment-copy.txt','utf8')
 expect(copy).toContain('Second revised handbook policy');expect(copy).toContain('Revised benefit instructions');expect(copy).toContain('Acknowledged by: Current Signer')
 expect(copy).not.toContain('requested any necessary renewal')
 expect(errors).toEqual([])
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})
