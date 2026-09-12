import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
test('employee acknowledges a schedule change and its cancellation and admin sees both receipts',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated localhost payroll database')
 const h=await createHarness()
 try{
  const api=async(path:string,body:unknown)=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});expect(response.ok).toBeTruthy();return (await response.json()).data}
  const employee=await api('/employees',{employeeNumber:'BROWSER-NOTICE',legalFirstName:'Notice',legalLastName:'Browser',hireDate:'2026-01-01',hourlyRateCents:2500,personalEmail:'schedule-browser@example.test'})
  const invite=await api(`/employees/${employee.id}/invitations`,{email:'schedule-browser@example.test',sendEmail:false})
  const body={frequency:'WEEKLY',effectiveOn:'2097-01-16',anchorStart:'2097-01-16',paymentLagDays:5,noticeDeliveredOn:'2026-09-01',source:'Synthetic employee browser schedule notice',confirmed:true}
  const preview=await api('/pay-schedule/transition-preview',body);await api('/pay-schedule/transition',{...body,previewToken:preview.previewToken})
  const version=(await h.pool.query("SELECT id FROM payroll_schedule_version WHERE notice_delivered_on IS NOT NULL")).rows[0]
  await page.route('**/api/payroll/employee/**',async route=>{const url=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${url.pathname}${url.search}`})})})
  await page.route('**/api/admin/payroll/**',async route=>{const url=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${url.pathname}${url.search}`})})})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto(`/tests/support/payroll.html?employee&invite=${new URL(invite.inviteUrl).searchParams.get('invite')}`)
  await page.getByRole('button',{name:'Pay statements',exact:true}).click()
  await page.getByRole('button',{name:'Acknowledge schedule change',exact:true}).click()
  await expect(page.getByText('Schedule notice receipt recorded.',{exact:true})).toBeVisible()
  const cancellation=await api(`/pay-schedule/${version.id}/cancel-preview`,{});await api(`/pay-schedule/${version.id}/cancel`,{...body,previewToken:cancellation.previewToken})
  await page.goto('/tests/support/payroll.html?employee');await page.getByRole('button',{name:'Pay statements',exact:true}).click()
  await page.getByRole('button',{name:'Acknowledge schedule cancellation',exact:true}).click()
  await expect(page.getByText('Schedule notice receipt recorded.',{exact:true})).toBeVisible()
  await page.setViewportSize({width:390,height:844})
  await page.locator('section').filter({has:page.getByRole('heading',{name:'Pay schedule notices',exact:true})}).screenshot({path:'/tmp/payroll-employee-schedule-notices-mobile.png'})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click()
  await page.getByText('Employee notice receipts',{exact:true}).click()
  await page.getByRole('button',{name:'Refresh notice receipts',exact:true}).click()
  await expect(page.getByText(/Change receipt acknowledged/)).toBeVisible();await expect(page.getByText(/Cancellation receipt acknowledged/)).toBeVisible()
  expect(errors).toEqual([])
 }finally{await h.close()}
})
