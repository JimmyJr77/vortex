import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
test('admin records employer and employee encrypted filing identities and corrects history',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(90000)
 const original=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const h=await createHarness();try{
 const response=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'FILING-BROWSER',legalFirstName:'Filing',legalLastName:'Browser',hireDate:'2026-09-01',hourlyRateCents:2500})});expect(response.status).toBe(201)
 await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
 for(const prefix of ['admin/payroll','payroll/employee'])await page.route(`**/api/${prefix}/**`,async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
 await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html')
 for(const employee of [false,true]){
 await page.getByRole('button',{name:employee?'People & onboarding':'Employer setup',exact:true}).click()
 if(employee)await page.getByRole('button').filter({hasText:'FILING-BROWSER'}).click()
 const form=page.getByRole('region',{name:employee?'Employee filing identity':'Employer filing identity',exact:true})
 await form.getByRole('button',{name:'Open filing identity',exact:true}).click()
 await expect(form.getByText('No filing identity recorded.',{exact:true})).toBeVisible()
 const fill=async(identifier:string)=>{
 await form.getByLabel(employee?'Full SSN':'Full EIN',{exact:true}).fill(identifier)
 if(employee){await form.getByLabel('Legal first name',{exact:true}).fill('Filing');await form.getByLabel('Legal last name',{exact:true}).fill('Browser')}else await form.getByLabel('Legal employer name',{exact:true}).fill('Synthetic Employer LLC')
 if(!employee){const stateId=form.getByLabel(/^Maryland Central Registration Number/);await expect(stateId).toHaveAttribute('type','password');await stateId.fill('01234567')}
 await form.getByLabel('Mailing street address',{exact:true}).fill('123 Test Street');await form.getByLabel('Mailing city',{exact:true}).fill('Bowie');await form.getByLabel('Mailing ZIP code',{exact:true}).fill('20715')
 await form.getByLabel('Identity verification reference',{exact:true}).fill('Synthetic signed identity document reviewed')
 await form.getByRole('checkbox').check()
 }
 await fill('123456789');await expect(form.getByLabel(employee?'Full SSN':'Full EIN',{exact:true})).toHaveAttribute('type','password')
 await form.getByLabel('Mailing city',{exact:true}).fill('Annapolis');await expect(form.getByRole('button',{name:'Save encrypted filing identity',exact:true})).toBeDisabled();await form.getByRole('checkbox').check()
 await form.getByRole('button',{name:'Save encrypted filing identity',exact:true}).click();await expect(form.getByRole('status')).toContainText('Encrypted filing identity saved.')
 await expect(form.getByLabel(employee?'Full SSN':'Full EIN',{exact:true})).toHaveValue('');await expect(form).toContainText('Identifier ending 6789')
 if(!employee)await expect(form.getByLabel(/^Maryland Central Registration Number/)).toHaveValue('')
 await fill('123456788');await form.getByRole('button',{name:'Save encrypted filing identity',exact:true}).click();await expect(form).toContainText('Identifier ending 6788');await expect(form).toContainText('SUPERSEDED')
 await form.screenshot({path:`/tmp/payroll-filing-identity-${employee?'employee':'employer'}.png`})
 }
 const employee=(await h.pool.query('SELECT id FROM payroll_employee WHERE employee_number=$1',['FILING-BROWSER'])).rows[0]
 const inviteResponse=await fetch(`${h.url}/api/admin/payroll/employees/${employee.id}/invitations`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({email:'filing-review@example.test',sendEmail:false})});expect(inviteResponse.ok).toBe(true);const invitation=(await inviteResponse.json()).data
 await page.goto(`/employee/payroll?invite=${new URL(invitation.inviteUrl).searchParams.get('invite')}`);await page.getByRole('button',{name:'Onboarding',exact:true}).click()
 const review=page.getByRole('region',{name:'My filing identity',exact:true});await review.getByRole('button',{name:'Review my filing details',exact:true}).click()
 await expect(review).toContainText('Filing Browser');await expect(review).toContainText('Identifier ending 6788');await expect(review).not.toContainText('123456788')
 await expect(review.getByRole('button',{name:'These details are correct',exact:true})).toBeDisabled();await review.getByRole('checkbox').check();await review.getByRole('button',{name:'These details are correct',exact:true}).click();await expect(review).toContainText('You confirmed the displayed details.')
 await review.getByRole('checkbox').check();await review.getByRole('button',{name:'Request a correction',exact:true}).click();await expect(review).toContainText('You requested a correction. Contact your hiring administrator.')
 await review.screenshot({path:'/tmp/payroll-employee-filing-review-mobile.png'})
 await page.goto('/tests/support/payroll.html');await expect(page.getByText('Employee filing identity needs correction',{exact:true})).toBeVisible();await page.getByRole('button',{name:'People & onboarding',exact:true}).click();await page.getByRole('button').filter({hasText:'FILING-BROWSER'}).click()
 const adminIdentity=page.getByRole('region',{name:'Employee filing identity',exact:true});await adminIdentity.getByRole('button',{name:'Open filing identity',exact:true}).click();await expect(adminIdentity).toContainText('Correction requested — contact employee')
 const rows=(await h.pool.query('SELECT encrypted_identity FROM payroll_filing_identity')).rows;expect(rows).toHaveLength(4);expect(rows.every(row=>!row.encrypted_identity.includes(Buffer.from('12345678')))).toBe(true)
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close();if(original===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=original}
})
