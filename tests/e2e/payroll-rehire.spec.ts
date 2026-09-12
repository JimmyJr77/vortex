import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
for(const salary of [false,true])test(`admin reopens a former employee with fresh onboarding: salary=${salary}`,async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 test.setTimeout(60000)
 const h=await createHarness()
 try{
  const response=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'BROWSER-REHIRE',legalFirstName:'Returning',legalLastName:'Browser',personalEmail:'returning@example.test',hireDate:salary?'2026-08-03':'2026-07-27',hourlyRateCents:2500,...(salary?{payType:'SALARY',annualSalaryCents:5200000}:{})})})
  expect(response.status).toBe(201);const e=(await response.json()).data
  if(salary){const saved=await fetch(`${h.url}/api/admin/payroll/employees/${e.id}/salary-review`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({classification:'NONEXEMPT',fixed40Verified:true,minimumWageVerified:true,minimumWageCents:1500,source:'Synthetic prior salary classification agreement',confirmed:true})});expect(saved.status).toBe(200)}
  await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-08' WHERE id=$1",[e.id])
  await h.pool.query("UPDATE payroll_onboarding_task SET status='COMPLETE',response='{\"reference\":\"Synthetic prior provider record\"}',completed_at=now() WHERE employee_id=$1",[e.id])
  const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
  const run=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status,payment_date,payment_confirmation_reference) VALUES(1,$1,'FINALIZED','2026-08-14','SYNTHETIC-PAID') RETURNING id",[period.id])).rows[0]
  await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,net_pay_cents) VALUES($1,$2,17000)',[run.id,e.id])
  let earlierPeriodId:string|undefined
  if(!salary){
   earlierPeriodId=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-07-27','2026-08-02','2026-08-07','WEEKLY') RETURNING id")).rows[0].id
   await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-07-28',180,'Synthetic retained vacation')",[e.id])
  }
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const url=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${url.pathname}${url.search}`})})})
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click()
  const review=page.getByRole('region',{name:'Rehire preparation',exact:true})
  await review.getByLabel('Proposed rehire date',{exact:true}).fill('2099-09-07')
  await review.getByRole('button',{name:'Review rehire records',exact:true}).click()
  await expect(review.getByRole('button',{name:'Reopen onboarding',exact:true})).toBeDisabled()
  await review.getByLabel('Rehire reason',{exact:true}).fill('Returning to the same reviewed position')
  await review.getByLabel('Prior obligations and leave policy review reference',{exact:true}).fill('Synthetic review of prior wages, expenses, corrections and retained leave')
  await review.getByLabel('I confirm the displayed start date, role and compensation terms.',{exact:true}).check()
  await review.getByLabel('I reviewed prior wages, corrections, expenses and leave policy, including retaining the displayed balances.',{exact:true}).check()
  await page.setViewportSize({width:390,height:1700});await review.scrollIntoViewIfNeeded();await expect(review).toBeInViewport({ratio:1});await review.screenshot({path:'/tmp/payroll-rehire-action-mobile.png'})
  await review.getByRole('button',{name:'Reopen onboarding',exact:true}).click()
  await expect(page.getByText('Rehire onboarding opened. Complete fresh submissions and reviews before activation.',{exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Complete onboarding & activate employee',exact:true})).toBeDisabled()
  await expect(page.getByText('0 of 13 steps complete',{exact:true})).toBeVisible()
  const safety=page.locator('details').filter({has:page.getByText('Role training & safeguarding',{exact:true})})
  await safety.locator('summary').first().click()
  await safety.getByLabel('Review evidence / instructions',{exact:true}).fill('Synthetic fresh role orientation and safeguarding review')
  await safety.getByRole('button',{name:'Verify & complete',exact:true}).click()
  await expect(page.getByText('1 of 13 steps complete',{exact:true})).toBeVisible()
  await expect(page.getByRole('region',{name:'Employment history',exact:true}).getByText('2099-09-07 through no end recorded',{exact:true})).toBeVisible()
  expect((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_employee')).rows[0].n).toBe(1)
  expect((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_onboarding_task WHERE employee_id=$1 AND onboarding_cycle=2',[e.id])).rows[0].n).toBe(13)
  if(!salary){
   const payout=page.getByRole('region',{name:'Unused PTO payout',exact:true})
   await expect(payout.getByText('During rehire onboarding, payouts may be reserved only against eligible earlier regular payroll periods. New-period and standalone payouts require activation.',{exact:true})).toBeVisible()
   await payout.getByLabel('PTO minutes to pay out',{exact:true}).fill('60')
   await payout.getByLabel('Reviewed PTO payout rate ($/hour)',{exact:true}).fill('25')
   await payout.getByLabel('PTO payout policy evidence',{exact:true}).fill('Synthetic communicated vacation payout policy')
   await payout.getByLabel('I verified the communicated payout policy and applicable rate.',{exact:true}).check()
   await payout.getByLabel('This pays unused vacation/PTO and is not an attendance bonus.',{exact:true}).check()
   await payout.getByRole('button',{name:'Calculate PTO payout',exact:true}).click()
   await expect(payout.getByText('PTO payout: $25.00',{exact:true})).toBeVisible()
   await expect(payout.getByRole('option',{name:'Separate payment, including after payroll closes',exact:true})).toHaveJSProperty('disabled',true)
   await payout.getByRole('combobox',{name:'PTO payout payroll period',exact:true}).selectOption(String(earlierPeriodId))
   await payout.scrollIntoViewIfNeeded();await expect(payout).toBeInViewport({ratio:1});await payout.screenshot({path:'/tmp/payroll-rehire-earlier-payout-mobile.png'})
   await payout.getByRole('button',{name:'Reserve PTO payout',exact:true}).click()
   await expect(payout.getByText('1 hours · RESERVED',{exact:true})).toBeVisible()
  }
  if(salary){
   await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
   const salaryPanel=page.locator('section').filter({has:page.getByRole('heading',{name:'Salary classification review',exact:true})})
   await salaryPanel.getByLabel('Reviewed annual salary ($)',{exact:true}).fill('65000')
   await salaryPanel.getByLabel('Reviewed job title',{exact:true}).fill('Operations coordinator')
   await salaryPanel.getByLabel('I verified the salary agreement covers a fixed 40-hour workweek.',{exact:true}).check()
   await salaryPanel.getByLabel('I verified the applicable state and local minimum wage for this employee.',{exact:true}).check()
   await salaryPanel.getByRole('textbox',{name:'Classification evidence reference',exact:true}).fill('Synthetic new rehire salary and role agreement')
   await salaryPanel.getByLabel('I confirm this classification and its supporting evidence.',{exact:true}).check()
   await salaryPanel.getByRole('button',{name:'Save salary classification',exact:true}).click()
   await expect(salaryPanel.getByText('Salary classification saved and audited. Complete the remaining pay setup review in onboarding.',{exact:true})).toBeVisible()
   await expect(salaryPanel.getByText('2099-09-07 · $65,000.00 annually',{exact:true})).toBeVisible()
   const packetResponse=await fetch(`${h.url}/api/admin/payroll/employees/${e.id}/onboarding`,{headers:{Authorization:'Bearer payroll-test-admin'}})
   const packet=(await packetResponse.json()).data
   expect(packet.wageTerms.annualSalaryCents).toBe(6500000)
   expect(packet.wageTerms.jobTitle).toBe('Operations coordinator')
  }
  expect(errors).toEqual([])
 }finally{await h.close()}
})
