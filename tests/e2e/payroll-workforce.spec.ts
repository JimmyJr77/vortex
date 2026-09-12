import { test as baseTest, expect, type BrowserContext } from '@playwright/test'
import { createHarness } from '../../backend/payroll/testing/harness.js'

async function routePayroll(context: BrowserContext, url: string) {
 for (const pattern of ['**/api/admin/payroll/**', '**/api/payroll/employee/**']) {
  await context.route(pattern, async route => {
   const requestUrl = new URL(route.request().url())
   await route.fulfill({response: await route.fetch({url: `${url}${requestUrl.pathname}${requestUrl.search}`})})
  })
 }
}
const test = baseTest.extend<{payroll: Awaited<ReturnType<typeof createHarness>>}>({
 payroll: async ({context}, runFixture) => {
  const harness = await createHarness()
  try { await routePayroll(context, harness.url); await runFixture(harness) }
  finally { await context.unrouteAll({behavior:'wait'}); await context.close(); await harness.close() }
 },
})
test.skip(!process.env.PAYROLL_TEST_DATABASE_URL, 'Requires isolated payroll database')

// The isolated full hire-to-pay journey is in payroll-complete-journey.spec.ts.
test('QuickBooks return opens payroll accounting inside the actual admin application',async({page,payroll})=>{
 expect(payroll.url).toMatch(/^http:\/\/127\.0\.0\.1:/)
 await page.addInitScript(()=>{localStorage.setItem('adminToken','payroll-test-admin');localStorage.setItem('vortex_admin','true')})
 // Isolate the permission bootstrap; payroll data still comes from the real test API.
 await page.route('**/api/admin/access/me',route=>route.fulfill({json:{success:true,data:{permissions:['payroll.view','payroll.manage'],roles:[],isMasterAdmin:false,user:{id:99}}}}))
 await page.goto('/?payrollQuickbooks=connected')
 await expect(page.getByRole('heading',{name:'QuickBooks Online connection',exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'Reports & QuickBooks',exact:true})).toBeInViewport()
 await expect(page).not.toHaveURL(/payrollQuickbooks=/)
 await page.screenshot({path:'/tmp/payroll-quickbooks-admin-return.png',fullPage:true})
})

test('employee can clock in again after an admin rejects an open clock', async ({page,request,payroll})=>{
 const base=`${payroll.url}/api/admin/payroll`
 const headers={Authorization:'Bearer payroll-test-admin'}
 const number=`CLOCK-${Date.now()}`, email=`${number.toLowerCase()}@example.test`
 const created=await request.post(`${base}/employees`,{headers,data:{employeeNumber:number,legalFirstName:'Clock',legalLastName:'Browser',hireDate:'2026-01-01',hourlyRateCents:2500,personalEmail:email}})
 expect(created.status()).toBe(201);const employee=(await created.json()).data
 const invited=await request.post(`${base}/employees/${employee.id}/invitations`,{headers,data:{email,sendEmail:false}})
 expect(invited.status()).toBe(201);const invite=new URL((await invited.json()).data.inviteUrl).searchParams.get('invite')
 await page.goto(`/employee/payroll?invite=${invite}`)
 await page.getByRole('button',{name:'Home',exact:true}).click()
 await page.getByRole('button',{name:'Clock in',exact:true}).click()
 await expect(page.getByRole('button',{name:'Clock out',exact:true})).toBeVisible()
 const dashboard=(await (await request.get(`${base}/dashboard`,{headers})).json()).data
 const entry=dashboard.timeEntries.find((row:{employee_id:number|string,clock_out:string|null,status:string})=>Number(row.employee_id)===Number(employee.id)&&!row.clock_out&&row.status!=='REJECTED')
 expect(entry).toBeTruthy()
 expect((await request.patch(`${base}/time-entries/${entry.id}/status`,{headers,data:{status:'REJECTED'}})).ok()).toBeTruthy()
 await page.reload()
 await expect(page.getByText('Not clocked in',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Clock in',exact:true}).click()
 await expect(page.getByRole('button',{name:'Clock out',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Clock out',exact:true}).click()
 await expect(page.getByText('Not clocked in',{exact:true})).toBeVisible()
 await page.screenshot({path:'/tmp/payroll-clock-recovery.png',fullPage:true})
})

test('employee expense approval shows the assigned payroll dates in both portals',async({browser,request,payroll})=>{
 const base=`${payroll.url}/api/admin/payroll`,headers={Authorization:'Bearer payroll-test-admin'}
 const number=`EXPENSE-${Date.now()}`,email=`${number.toLowerCase()}@example.test`
 const created=await request.post(`${base}/employees`,{headers,data:{employeeNumber:number,legalFirstName:'Expense',legalLastName:'Browser',hireDate:'2026-01-01',hourlyRateCents:2500,personalEmail:email}})
 expect(created.status()).toBe(201);const employee=(await created.json()).data
 expect((await request.post(`${base}/pay-periods/generate`,{headers,data:{year:2099,month:1}})).ok()).toBeTruthy()
 const invitation=await request.post(`${base}/employees/${employee.id}/invitations`,{headers,data:{email,sendEmail:false}})
 expect(invitation.status()).toBe(201);const invite=new URL((await invitation.json()).data.inviteUrl).searchParams.get('invite')
 const employeeContext=await browser.newContext({viewport:{width:390,height:844}}),adminContext=await browser.newContext({viewport:{width:1440,height:1000}})
 try {
 await routePayroll(employeeContext,payroll.url);await routePayroll(adminContext,payroll.url)
 await adminContext.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
 const portal=await employeeContext.newPage(),admin=await adminContext.newPage(),errors:string[]=[]
 portal.on('pageerror',e=>errors.push(e.message));admin.on('pageerror',e=>errors.push(e.message))
 await portal.goto(`/employee/payroll?invite=${invite}`)
 await portal.getByRole('button',{name:'Leave & requests',exact:true}).click()
 await portal.getByRole('combobox',{name:'Request type',exact:true}).selectOption('EXPENSE')
 await portal.getByLabel('Amount ($)',{exact:true}).fill('12.34')
 await portal.getByLabel('Receipt reference',{exact:true}).fill('BROWSER-EXPENSE-RECEIPT')
 await portal.getByLabel('Details / reason',{exact:true}).fill('Travel supplies for the workshop')
 await portal.getByRole('button',{name:'Submit request',exact:true}).click()
 await expect(portal.getByText('Request submitted to your hiring admin.',{exact:true})).toBeVisible()
 await admin.goto('/tests/support/payroll.html')
 await admin.getByRole('button',{name:'Requests & approvals',exact:true}).click()
 const card=admin.locator('article').filter({hasText:'BROWSER-EXPENSE-RECEIPT'})
 await card.getByLabel('Review note',{exact:true}).fill('Receipt and business purpose verified')
 await card.getByLabel('I verified the receipt and reimbursement tax treatment. Approval adds it once to the next open pay period.').check()
 await card.getByRole('button',{name:'Approve request',exact:true}).click()
 await expect(card).toContainText('APPROVED')
 await expect(card).toContainText('Assigned payroll:')
 const assignment=await card.getByText(/Assigned payroll:/).textContent()
 await portal.reload();await portal.getByRole('button',{name:'Leave & requests',exact:true}).click()
 const employeeCard=portal.locator('article').filter({hasText:'BROWSER-EXPENSE-RECEIPT'})
 await expect(employeeCard).toContainText('APPROVED')
 await expect(employeeCard.getByText(/Assigned payroll:/)).toHaveText(assignment!)
 await expect(employeeCard).toContainText('$12.34')
 await employeeCard.screenshot({path:'/tmp/payroll-expense-assignment-mobile.png'})
 expect(errors).toEqual([])
 } finally { await employeeContext.unrouteAll({behavior:'wait'});await adminContext.unrouteAll({behavior:'wait'});await employeeContext.close();await adminContext.close() }
})

test('payroll reports export the selected date range and reject a reversed range',async({page,payroll})=>{
 expect(payroll.url).toMatch(/^http:\/\/127\.0\.0\.1:/)
 await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
 await page.goto('/tests/support/payroll.html')
 await page.getByRole('button',{name:'Reports & QuickBooks',exact:true}).click()
 await page.getByLabel('Report start date',{exact:true}).fill('2025-04-01')
 await page.getByLabel('Report end date',{exact:true}).fill('2025-06-30')
 for(const [button,path,filename] of [['Download payroll register','payroll-register.csv','vortex-payroll-register-2025-04-01-2025-06-30.csv'],['Download time log','time-log.csv','vortex-time-log-2025-04-01-2025-06-30.csv']]){
  const responseEvent=page.waitForResponse(r=>r.url().includes(`/reports/${path}?`))
  const downloadEvent=page.waitForEvent('download')
  await page.getByRole('button',{name:button,exact:true}).click()
  const response=await responseEvent;expect(response.ok()).toBeTruthy()
  expect(new URL(response.url()).searchParams.get('start')).toBe('2025-04-01')
  expect(new URL(response.url()).searchParams.get('end')).toBe('2025-06-30')
  expect((await downloadEvent).suggestedFilename()).toBe(filename)
 }
 await page.getByLabel('Report end date',{exact:true}).fill('2025-03-31')
 await expect(page.getByRole('button',{name:'Download payroll register',exact:true})).toBeDisabled()
 await expect(page.getByRole('button',{name:'Download time log',exact:true})).toBeDisabled()
 await expect(page.getByText('Choose a start date and an end date on or after it.',{exact:true})).toBeVisible()
 await page.getByRole('heading',{name:'Report date range',exact:true}).locator('..').screenshot({path:'/tmp/payroll-report-date-range.png'})
})
