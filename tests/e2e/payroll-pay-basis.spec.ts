import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
test('admin revises hiring basis both ways and retains reopened reviews',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness()
 try{
  const r=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'BASIS-BROWSER',legalFirstName:'Offer',legalLastName:'Browser',jobTitle:'Office coordinator',hireDate:'2099-09-07',hourlyRateCents:2500})});expect(r.status).toBe(201);const employee=(await r.json()).data
  await h.pool.query("UPDATE payroll_onboarding_task SET status='COMPLETE',response='{\"acknowledged\":true}' WHERE employee_id=$1 AND task_key IN ('PAY_REVIEW','WAGE_NOTICE')",[employee.id])
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  let loseResponse=true
  await page.route('**/api/admin/payroll/**',async route=>{const url=new URL(route.request().url());const response=await route.fetch({url:`${h.url}${url.pathname}${url.search}`});if(url.pathname.endsWith('/pay-basis')&&loseResponse){loseResponse=false;await route.abort('failed')}else await route.fulfill({response})})
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
  await page.getByRole('button',{name:'Revise offer to salary',exact:true}).click()
  await page.getByLabel('Pay basis change reason',{exact:true}).fill('Renegotiated initial offer with a fixed salary agreement')
  await page.getByLabel('Reviewed annual salary ($)',{exact:true}).fill('62400')
  await page.getByLabel('Classification evidence reference',{exact:true}).fill('Synthetic signed fixed hours salary agreement reviewed')
  await page.getByLabel('I verified the salary agreement covers a fixed 40-hour workweek.',{exact:true}).check()
  await page.getByLabel('I verified the applicable state and local minimum wage for this employee.',{exact:true}).check()
  await page.getByLabel('I confirm this classification and its supporting evidence.',{exact:true}).check()
  await page.getByLabel('I confirm the revised hiring offer and understand that fresh pay review and wage acknowledgment are required.',{exact:true}).check()
  await page.getByRole('button',{name:'Change offer to salary',exact:true}).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByRole('button',{name:'Change offer to salary',exact:true}).click()
  await expect(page.getByRole('button',{name:'Revise offer to hourly',exact:true})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Salary classification review',exact:true})).toBeVisible()
  expect((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_audit_log WHERE action='PAY_BASIS_CHANGED'",[])).rows[0].n).toBe(1)
  await page.reload();await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
  await expect(page.getByLabel('Reviewed annual salary ($)',{exact:true})).toHaveValue('62400')
  await page.getByRole('button',{name:'Revise offer to hourly',exact:true}).click()
  await page.getByLabel('Pay basis change reason',{exact:true}).fill('Final negotiated offer returns to hourly compensation')
  await page.getByLabel('New hourly offer ($/hour)',{exact:true}).fill('32')
  await page.getByLabel('I confirm the revised hiring offer and understand that fresh pay review and wage acknowledgment are required.',{exact:true}).check()
  await page.setViewportSize({width:390,height:1200})
  const card=page.locator('section').filter({has:page.getByRole('heading',{name:'Hiring pay basis',exact:true})})
  await card.screenshot({path:'/tmp/payroll-pay-basis-mobile.png'})
  await page.getByRole('button',{name:'Change offer to hourly',exact:true}).click()
  await expect(page.getByRole('button',{name:'Revise offer to salary',exact:true})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Salary classification review',exact:true})).toHaveCount(0)
  const row=(await h.pool.query('SELECT pay_type,hourly_rate_cents FROM payroll_employee WHERE id=$1',[employee.id])).rows[0]
  expect(row.pay_type).toBe('HOURLY');expect(Number(row.hourly_rate_cents)).toBe(3200)
  const tasks=(await h.pool.query("SELECT status,response FROM payroll_onboarding_task WHERE employee_id=$1 AND task_key IN ('PAY_REVIEW','WAGE_NOTICE')",[employee.id])).rows
  expect(tasks).toHaveLength(2);expect(tasks.every(t=>t.status==='OPEN'&&Object.keys(t.response).length===0)).toBe(true)
  expect(errors).toEqual([])
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})
