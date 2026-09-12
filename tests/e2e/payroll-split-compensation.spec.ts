import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
test('split payroll preserves both agreements from admin preview through employee statement',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness()
 try{
  const api=async(path:string,body:unknown)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});expect(r.ok).toBeTruthy();return(await r.json()).data}
  const e=await api('/employees',{employeeNumber:'SPLIT-BROWSER',legalFirstName:'Split',legalLastName:'Browser',hireDate:'2026-08-03',hourlyRateCents:2500,jobTitle:'Coordinator'})
  await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-08' WHERE id=$1",[e.id])
  await h.pool.query("UPDATE payroll_employee SET employment_status='ONBOARDING',hire_date='2026-08-10',termination_date=NULL,pay_type='SALARY',annual_salary_cents=5200000 WHERE id=$1",[e.id])
  await api(`/employees/${e.id}/salary-review`,{classification:'NONEXEMPT',fixed40Verified:true,minimumWageVerified:true,minimumWageCents:1500,confirmed:true,source:'Synthetic signed current salary agreement'})
  await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
  await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2026-08-03T12:00Z','2026-08-03T20:00Z','ADMIN','APPROVED')",[e.id])
  const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-16','2026-08-21','BIWEEKLY') RETURNING id")).rows[0]
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  for(const prefix of ['admin/payroll','payroll/employee'])await page.route(`**/api/${prefix}/**`,async route=>{const url=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${url.pathname}${url.search}`})})})
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Payroll runs',exact:true}).click()
  await page.getByRole('combobox',{name:'Pay period',exact:true}).selectOption(String(period.id))
  await page.getByRole('button',{name:'Preview payroll',exact:true}).click()
  const review=page.getByRole('region',{name:'Pay by employment agreement',exact:true})
  await expect(review.getByText('Hourly · 2026-08-03 through 2026-08-08',{exact:true})).toBeVisible()
  await expect(review.getByText('Salary · 2026-08-10 through 2026-08-16',{exact:true})).toBeVisible()
  await expect(review.getByText('Regular wages: $2,000.00 · Overtime: $0.00',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Save draft snapshot',exact:true}).click()
  await page.getByRole('button',{name:'Open review',exact:true}).last().click()
  await expect(review.last().getByText('$52,000.00 annually ÷ 26 pay periods. Full scheduled salary is preserved.',{exact:true})).toBeVisible()
  await page.setViewportSize({width:390,height:1000});await review.last().scrollIntoViewIfNeeded()
  const bounds=await review.last().boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(390)
  await review.last().screenshot({path:'/tmp/payroll-split-review-mobile.png'})
  const frozen=(await h.pool.query('SELECT calculation_snapshot FROM payroll_run ORDER BY id DESC LIMIT 1')).rows[0].calculation_snapshot.employees[0]
  expect(frozen.splitCompensation).toHaveLength(2);expect(frozen.grossPayCents).toBe(220000)
  // Complete the saved draft with verified synthetic employer and tax inputs.
  const patch=async(path:string,body:unknown)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'PATCH',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});expect(r.ok).toBeTruthy()}
  await patch('/settings',{legalBusinessName:'Split Employer',businessAddress:'123 Test Street, Bowie MD',businessPhone:'555-010-0000'})
  await patch('/employer-taxes',{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Synthetic verified employer tax notice',confirmed:true})
  await h.pool.query("UPDATE payroll_employee SET w4_status='COMPLETE',state_withholding_status='COMPLETE' WHERE id=$1",[e.id])
  await patch(`/employees/${e.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed tax election forms',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}})
  await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE facility_id=1")
  const oldRun=(await h.pool.query('SELECT id FROM payroll_run ORDER BY id DESC LIMIT 1')).rows[0]
  await patch(`/runs/${oldRun.id}/status`,{status:'VOID'})
  const run=await api('/runs',{payPeriodId:period.id})
  await patch(`/runs/${run.id}/status`,{status:'REVIEW'});await patch(`/runs/${run.id}/status`,{status:'APPROVED'})
  await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-08-21',paymentConfirmationReference:'SYNTHETIC-SPLIT-BROWSER'})
  const invite=await api(`/employees/${e.id}/invitations`,{email:'split-browser@example.test',sendEmail:false})
  await page.goto(`/tests/support/payroll.html?employee&invite=${new URL(invite.inviteUrl).searchParams.get('invite')}`)
  await page.getByRole('button',{name:'Pay statements',exact:true}).click()
  const statement=page.getByRole('region',{name:'Pay by employment agreement',exact:true})
  await expect(statement.getByText('Hourly · 2026-08-03 through 2026-08-08',{exact:true})).toBeVisible()
  await expect(statement.getByText('Salary · 2026-08-10 through 2026-08-16',{exact:true})).toBeVisible()
  await expect(page.getByText('Multiple agreements',{exact:true})).toBeVisible()
  await statement.screenshot({path:'/tmp/payroll-split-employee-mobile.png'})
  expect(errors).toEqual([])
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})
