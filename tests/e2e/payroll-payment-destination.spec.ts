import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {hashPayrollToken} from '../../backend/payroll/employeeAuth.js'
test('admin links a verified employee account while preserving employee authorization requirement',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(60000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
 const h=await createHarness({paymentFetcher:async()=>({ok:true,json:async()=>({id:id(3),counterparty_id:id(4),account_type:'checking',party_type:'individual',party_name:'Synthetic Employee',live_mode:false,verification_status:'verified',account_details:[{account_number_safe:'1234'}]})})})
 try{
  await h.pool.query(`INSERT INTO payroll_employee(facility_id,employee_number,legal_first_name,legal_last_name,job_title,hire_date,work_state,residence_state) VALUES(1,'BANK_UI','Synthetic','Employee','Test','2026-01-01','MD','MD')`)
  const response=await fetch(`${h.url}/api/admin/payroll/payment-connection`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({organizationId:id(1),originatingAccountId:id(2),apiKey:'synthetic-ui-key',mode:'TEST',reference:'Synthetic employer payment setup',expectedRevision:0,confirmed:true})});expect(response.status).toBe(201)
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click()
  const view=page.getByRole('region',{name:'Employee direct deposit account',exact:true}),save=view.getByRole('button',{name:'Link employee payment account',exact:true})
  await expect(view).toContainText('No provider account linked.');await expect(save).toBeDisabled()
  await view.getByLabel('Employee provider account ID',{exact:true}).fill(id(3));const reference=view.getByLabel('Account ownership review reference',{exact:true});await reference.fill('Synthetic employee account evidence');await view.getByRole('checkbox').check();await reference.fill('Synthetic updated employee account evidence');await expect(save).toBeDisabled();await view.getByRole('checkbox').check();await save.click()
  await expect(view.getByRole('status')).toContainText('Employee authorization is still required');await expect(view).toContainText('checking ending 1234');await expect(view.getByLabel('Employee provider account ID',{exact:true})).toHaveValue('');await expect(view.getByRole('checkbox')).not.toBeChecked()
  await view.screenshot({path:'/tmp/payroll-payment-destination-mobile.png'})
  await h.pool.query("UPDATE payroll_settings SET legal_business_name='Synthetic Employer' WHERE facility_id=1")
  const employee=(await h.pool.query("SELECT id FROM payroll_employee WHERE employee_number='BANK_UI'")).rows[0]
  await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[employee.id,hashPayrollToken('synthetic-bank-authorization')])
  await page.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','synthetic-bank-authorization'))
  await page.route('**/api/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.goto('/tests/support/payroll.html?employee=1');await page.getByRole('button',{name:'Onboarding',exact:true}).click()
  const authorization=page.getByRole('region',{name:'Your direct deposit authorization',exact:true})
  await authorization.getByRole('button',{name:'Review direct deposit account',exact:true}).click();await expect(authorization).toContainText('checking ending 1234')
  const signature=authorization.getByLabel('Your name as signature',{exact:true}),authorize=authorization.getByRole('button',{name:'Authorize direct deposit',exact:true})
  await signature.fill('Synthetic Employee');await authorization.getByRole('checkbox').first().check();await signature.fill('Synthetic Employee Name');await expect(authorize).toBeDisabled();await authorization.getByRole('checkbox').first().check();await authorize.click()
  await expect(authorization.getByRole('status')).toContainText('Direct-deposit authorization recorded')
  const download=page.waitForEvent('download');await authorization.getByRole('button',{name:/Download confirmation/}).first().click();expect((await download).suggestedFilename()).toMatch(/^direct-deposit-authorization-/)
  await authorization.screenshot({path:'/tmp/payroll-payment-authorization-mobile.png'})
  await authorization.getByRole('checkbox').last().check();await authorization.getByRole('button',{name:'Withdraw direct deposit authorization',exact:true}).click();await expect(authorization.getByRole('status')).toContainText('Authorization withdrawn')
  expect((await h.pool.query('SELECT decision FROM payroll_payment_authorization ORDER BY id')).rows.map(r=>r.decision)).toEqual(['AUTHORIZE','WITHDRAW'])
  await h.pool.query("UPDATE payroll_employee SET direct_deposit_status='ACTIVE' WHERE id=$1",[employee.id])
  await h.pool.query("UPDATE payroll_onboarding_task SET status='COMPLETE',response='{\"method\":\"DIRECT_DEPOSIT\"}' WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id])
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click()
  const payReview=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Pay, classification & benefits review'})})
  await payReview.locator(':scope > summary').click();await expect(payReview).toContainText('The employee must authorize the current direct-deposit account.');await expect(payReview.getByRole('button',{name:'Verify & complete',exact:true})).toBeDisabled()
 }finally{await page.unrouteAll({behavior:'wait'});await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
