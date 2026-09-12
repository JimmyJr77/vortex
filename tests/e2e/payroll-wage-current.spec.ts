import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {hashPayrollToken} from '../../backend/payroll/employeeAuth.js'
test('employee acknowledges only the hiring pay terms shown',async({page})=>{
 test.setTimeout(90000);page.setDefaultTimeout(15000)
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness();try{
 const r=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'WAGE-BROWSER',legalFirstName:'Draft',legalLastName:'Employee',hireDate:'2026-08-03',hourlyRateCents:2500})})
 expect(r.status).toBe(201);const e=(await r.json()).data
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[e.id,hashPayrollToken('draft-browser-session')])
 await page.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','draft-browser-session'))
 await page.route('**/api/payroll/employee/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 const setRole=async(role:string)=>{await h.pool.query('UPDATE payroll_employee SET job_title=$1 WHERE id=$2',[role,e.id])}
 await setRole('Original role')
 await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html?employee')
 await page.getByRole('button',{name:'Onboarding',exact:true}).click()
 const step=page.locator('details').filter({has:page.getByText('Offer & wage notice acknowledgment',{exact:true})})
 await step.locator('summary').click()
 await step.getByRole('textbox',{name:'Your full name',exact:true}).fill('Current Signer')
 await step.getByRole('checkbox').check()
 await setRole('Revised role')
 await step.getByRole('button',{name:'Submit for review',exact:true}).click()
 await expect(page.getByRole('alert')).toContainText('Hiring terms changed')
 await page.reload();await page.getByRole('button',{name:'Onboarding',exact:true}).click()
 await step.locator('summary').click()
 await expect(step.getByText(/Revised role/)).toBeVisible()
 await expect(step.getByRole('checkbox')).not.toBeChecked()
 await step.getByRole('textbox',{name:'Your full name',exact:true}).fill('Current Signer')
 await step.getByRole('checkbox').check()
 await step.getByRole('button',{name:'Submit for review',exact:true}).click()
 await expect(page.getByRole('status')).toHaveText('Step submitted for review.')
 await step.locator('summary').click()
 await step.screenshot({path:'/tmp/payroll-wage-current-mobile.png'})
 const saved=(await h.pool.query("SELECT response FROM payroll_onboarding_task WHERE employee_id=$1 AND task_key='WAGE_NOTICE'",[e.id])).rows[0].response
 expect(saved.terms.jobTitle).toBe('Revised role')
 await setRole('Second revised role')
 await page.reload();await page.getByRole('button',{name:'Onboarding',exact:true}).click()
 await step.locator('summary').click()
 await expect(step.getByRole('checkbox')).not.toBeChecked()
 await step.getByRole('button',{name:'View my acknowledgments',exact:true}).click()
 const history=step.getByRole('region',{name:'Your saved acknowledgments',exact:true})
 await expect(history.getByLabel('Saved acknowledged terms').first()).toContainText('Role: Revised role')
 await expect(history.getByLabel('Saved acknowledged terms').first()).toContainText('Hourly rate: $25.00')
 await history.screenshot({path:'/tmp/payroll-wage-copies-mobile.png'})
 expect(errors).toEqual([])
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})
