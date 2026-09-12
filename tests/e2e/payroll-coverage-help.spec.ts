import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {monthlyBenefitsFixture} from '../../backend/payroll/testing/monthlyBenefitsFixture.js'
test('coverage question flows internally to admin and back with safe retry and preserved drafts',async({browser})=>{
 test.setTimeout(90000);test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness();await monthlyBenefitsFixture(h)
 const employeeContext=await browser.newContext({viewport:{width:390,height:1000}}),adminContext=await browser.newContext({viewport:{width:1000,height:1000}})
 const employee=await employeeContext.newPage(),admin=await adminContext.newPage();let failNextPacket=false,failedOnce=false
 try{
  await employee.clock.install();await admin.clock.install()
  await employeeContext.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','monthly-benefits-session'));await adminContext.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  for(const context of [employeeContext,adminContext])await context.route('**/api/**',async route=>{const u=new URL(route.request().url());if(!u.pathname.includes('/payroll/'))return route.continue();if(failNextPacket&&u.pathname==='/api/payroll/employee/onboarding'&&route.request().method()==='GET'){failNextPacket=false;failedOnce=true;return route.fulfill({status:503,json:{success:false,message:'Synthetic request reload failure'}})}const response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(!failedOnce&&u.pathname==='/api/payroll/employee/requests'&&route.request().method()==='POST'&&response.ok())failNextPacket=true;await route.fulfill({response})})
  await admin.goto('/tests/support/payroll.html');await admin.getByRole('button',{name:'Requests & approvals',exact:true}).click();await expect(admin.getByText('No requests yet.',{exact:true})).toBeVisible()
  await employee.goto('/tests/support/payroll.html?employee=1');await employee.getByRole('button',{name:'Onboarding',exact:true}).click()
  const coverage=employee.getByRole('region',{name:'My monthly benefit coverage',exact:true});await coverage.getByLabel('My coverage month',{exact:true}).fill('2026-09');await coverage.getByRole('button',{name:'Ask my admin about coverage',exact:true}).click()
  await expect(employee.getByRole('combobox',{name:'Request type',exact:true})).toHaveValue('GENERAL');await expect(employee.getByRole('textbox',{name:'Details / reason',exact:true})).toHaveValue('Benefit coverage question for 2026-09: ')
  const reason='Benefit coverage question for 2026-09: Please verify my carrier enrollment before my first paycheck.'
  await employee.getByRole('textbox',{name:'Details / reason',exact:true}).fill(reason);await employee.getByRole('button',{name:'Submit request',exact:true}).click();await expect(employee.getByRole('alert')).toContainText('Synthetic request reload failure');await employee.getByRole('button',{name:'Submit request',exact:true}).click();await expect(employee.getByRole('status')).toContainText('Request submitted to your hiring admin.')
  expect(Number((await h.pool.query('SELECT count(*) AS count FROM payroll_employee_request')).rows[0].count)).toBe(1)
  await employee.getByRole('textbox',{name:'Details / reason',exact:true}).fill('Draft follow-up question that must survive automatic refresh')
  await admin.clock.fastForward(30001);const request=admin.locator('article').filter({hasText:reason});await expect(request).toBeVisible();await request.getByRole('textbox',{name:'Review note',exact:true}).fill('We are checking the carrier record and will update your monthly coverage review.');await admin.clock.fastForward(30001);await expect(request.getByRole('textbox',{name:'Review note',exact:true})).toHaveValue('We are checking the carrier record and will update your monthly coverage review.');await request.getByRole('button',{name:'Approve request',exact:true}).click();await expect(request).toContainText('APPROVED')
  await employee.clock.fastForward(30001);await expect(employee.locator('article').filter({hasText:reason})).toContainText('We are checking the carrier record');await expect(employee.getByRole('textbox',{name:'Details / reason',exact:true})).toHaveValue('Draft follow-up question that must survive automatic refresh')
  await employee.screenshot({path:'/tmp/payroll-coverage-help-mobile.png',fullPage:true})
 }finally{await employeeContext.close();await adminContext.close();await h.close()}
})
