import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
test('admin pays a former employee expense through off-cycle review and confirmation',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness()
 try{
  const api=async(path:string,body:unknown,method='POST')=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});expect(r.ok).toBeTruthy();return (await r.json()).data}
  await api('/settings',{legalBusinessName:'Expense Browser',businessAddress:'123 Test Street',businessPhone:'5550100000'},'PATCH')
  const e=await api('/employees',{employeeNumber:'OFFCYCLE-BROWSER',legalFirstName:'Former',legalLastName:'Employee',hireDate:'2026-08-03',hourlyRateCents:2500})
  await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-08' WHERE id=$1",[e.id])
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
  const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,$1::date,$1::date+6,$1::date+10,'WEEKLY') RETURNING id",[today])).rows[0]
  const request=(await h.pool.query("INSERT INTO payroll_employee_request(facility_id,employee_id,kind,payload) VALUES(1,$1,'EXPENSE',$2) RETURNING id",[e.id,{reason:'Synthetic supplies',amountCents:12345,receiptReference:'SYNTHETIC-RECEIPT'}])).rows[0]
  await api(`/requests/${request.id}/review`,{status:'APPROVED',note:'Synthetic accountable expense verification',taxTreatmentVerified:true})
  const a=(await h.pool.query('SELECT id FROM payroll_recurring_adjustment WHERE source_request_id=$1',[request.id])).rows[0]
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Payroll runs',exact:true}).click()
  const form=page.getByRole('region',{name:'Off-cycle reimbursement',exact:true})
  await form.getByRole('combobox',{name:'Approved expense',exact:true}).selectOption(String(a.id))
  await form.getByLabel('Off-cycle payment date',{exact:true}).fill(today)
  await form.getByRole('button',{name:'Preview reimbursement',exact:true}).click()
  await expect(form.getByText('Reimbursement to pay: $123.45',{exact:true})).toBeVisible()
  await page.setViewportSize({width:390,height:1000});await form.scrollIntoViewIfNeeded();await expect(form).toBeInViewport({ratio:1});await form.screenshot({path:'/tmp/payroll-offcycle-mobile.png'})
  await form.getByRole('button',{name:'Save reimbursement draft',exact:true}).click()
  await expect(form.getByRole('status')).toContainText('saved')
  await page.getByRole('button',{name:'Open review',exact:true}).click()
  await page.getByRole('button',{name:'Send to review',exact:true}).click()
  await page.getByRole('button',{name:'Approve run',exact:true}).click()
  await expect(page.getByLabel('Actual payment date',{exact:true})).toBeVisible()
  const run=(await h.pool.query("SELECT id,status FROM payroll_run WHERE run_kind='OFF_CYCLE_REIMBURSEMENT'")).rows[0]
  expect(run.status).toBe('APPROVED')
  await page.getByLabel('Actual payment date',{exact:true}).fill(today)
  await page.getByLabel('External payment confirmation',{exact:true}).fill('SYNTHETIC-BROWSER-EXPENSE-PAYMENT')
  await page.getByRole('button',{name:'Confirm paid & finalize',exact:true}).click()
  await expect(page.getByText('Payroll finalized and employee statements saved.',{exact:true})).toBeVisible()
  expect((await h.pool.query('SELECT status FROM payroll_run WHERE id=$1',[run.id])).rows[0].status).toBe('FINALIZED')
  expect((await h.pool.query('SELECT status FROM payroll_pay_period WHERE id=$1',[period.id])).rows[0].status).toBe('OPEN')
  expect(errors).toEqual([])
 }finally{await h.close()}
})
