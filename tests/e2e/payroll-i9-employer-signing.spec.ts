import {test,expect as baseExpect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {employerI9ReviewFixture,syntheticI9CopyPdf} from '../../backend/payroll/testing/employerI9ReviewFixture.js'
const expect=baseExpect.configure({timeout:20000})
for(const alternative of [false,true])test(`admin certifies the current I-9 packet and recovers a lost signing response; alternative=${alternative}`,async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='98'.repeat(32)
 const h=await createHarness(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const {employee}=await employerI9ReviewFixture(h,{alternative}),pdf=await syntheticI9CopyPdf()
  await page.setViewportSize({width:390,height:950})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  let lose=true
  await page.route('**/api/admin/payroll/**',async route=>{
   const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`,maxRetries:route.request().method()==='GET'?2:0})
   if(lose&&u.pathname.endsWith('/i9/employer-sign')&&route.request().method()==='POST'){expect(response.status()).toBe(200);lose=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic lost signing response. Retry unchanged.'})});return}
   await route.fulfill({response})
  })
  const open=async()=>{await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click();await page.locator('summary').filter({hasText:'Employer I-9 review'}).click();await page.getByRole('button',{name:'Prepare employer I-9 preview',exact:true}).click()}
  await open();const copies=page.getByRole('region',{name:'I-9 document copies',exact:true}),file=copies.getByLabel('List A document 1: copy file (PDF, PNG or JPEG, up to 5 MB)',{exact:true}),retain=copies.getByRole('button',{name:'Retain list a document 1 copy',exact:true})
  await file.setInputFiles({name:'SENSITIVE-ORIGINAL-NAME.pdf',mimeType:'application/pdf',buffer:pdf})
  await retain.click();await expect(copies.getByRole('status')).toContainText('Document copy retained securely')
  await copies.getByRole('button',{name:'View list a document 1 copy 1',exact:true}).click()
  const viewer=copies.getByRole('region',{name:'Official I-9 document copy page review',exact:true})
  for(let n=1;n<=2;n++){await viewer.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(viewer.getByRole('status')).toContainText(`Page ${n} of 2 displayed and review visit saved.`)}
  await viewer.locator('summary').click();await expect(viewer).toContainText('SYNTHETIC ID BACK')
  const main=page.getByRole('region',{name:'Official I-9 employer preview page review',exact:true})
  for(let n=1;n<=4;n++){await main.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(main.getByRole('status')).toContainText(`Page ${n} of 4 displayed and review visit saved.`)}
  const exam=page.getByRole('region',{name:'Employer examination and signature',exact:true})
  await exam.getByRole('button',{name:'Refresh copies available for certification',exact:true}).click()
  await exam.getByLabel('Actual examination date',{exact:true}).fill('2026-09-01')
  await exam.getByLabel('Examiner initials',{exact:true}).fill('RA')
  await exam.getByLabel('Examiner identity and authority evidence',{exact:true}).fill('Authenticated hiring administrator personally performed examination.')
  for(const name of ['Monday','Tuesday','Wednesday','Thursday','Friday'])await exam.getByRole('checkbox',{name,exact:true}).check()
  await exam.getByRole('combobox',{name:'Employment lasts fewer than three business days',exact:true}).selectOption('no')
  await exam.getByLabel('Late-completion explanation (required if signing after the deadline)',{exact:true}).fill('Synthetic historical fixture is being certified at the actual current time.')
  await exam.getByRole('combobox',{name:'Acceptance basis',exact:true}).selectOption('STANDARD')
  await exam.getByRole('combobox',{name:'Required document follow-up',exact:true}).selectOption('NONE')
  for(const name of ['I confirm these are the actual business days and relevant closure dates.','The employee chose the acceptable document combination.','I reviewed the current employee Section 1 and every required preparer certification.','The documents reasonably appear genuine and relate to this employee.','Use list a document 1 copy 1 (2 page(s))','The selected copies are clear and include every required side/page.','I determined this document is acceptable for the chosen list or combination.','I verified that this document requires no follow-up.','I read and agree to the employer certification above.','I am the named representative who performed this examination.','I confirm my identity and authority as the representative named on the reviewed form.','I reviewed all four form pages, every preparer certificate and every selected document-copy page.'])await exam.getByRole('checkbox',{name,exact:true}).check()
  if(alternative){
   for(const name of ['The employer is currently an E-Verify participant in good standing.','Every hiring site using this procedure is enrolled.','I completed the required E-Verify training.','The procedure is applied consistently and without discrimination.','I received and examined all required document copies before live video.','The employee presented these same original documents during live video on the examination date.'])await exam.getByRole('checkbox',{name,exact:true}).check()
   await exam.getByLabel('Eligibility, site enrollment and training evidence',{exact:true}).fill('Verified synthetic site enrollment and completed examiner training.')
   await exam.getByLabel('Live video examination evidence',{exact:true}).fill('Examiner reviewed these same originals during the synthetic live-video session.')
  }else await exam.getByRole('checkbox',{name:'I physically examined the original documents in the employee’s presence.',exact:true}).check()
  await exam.getByLabel('Your employer electronic signature',{exact:true}).fill('Reviewer Alice')
  expect(await exam.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await exam.screenshot({path:`/tmp/payroll-i9-employer-examination-${alternative?'alternative':'physical'}-mobile.png`})
  await exam.getByRole('button',{name:'Sign and complete employer I-9',exact:true}).click()
  await expect(exam.getByRole('alert')).toContainText('Synthetic lost signing response')
  await exam.getByRole('button',{name:'Sign and complete employer I-9',exact:true}).click()
  await expect(page.getByRole('status').filter({hasText:'Employer I-9 signed and completed.'})).toBeVisible()
  expect((await h.pool.query('SELECT count(*)::int AS n FROM payroll_i9_employer_signature')).rows[0].n).toBe(1)
  expect((await h.pool.query("SELECT status FROM payroll_onboarding_task WHERE employee_id=$1 AND task_key='I9_REVIEW'",[employee.id])).rows[0].status).toBe('COMPLETE')
  const cases=(await h.pool.query("SELECT status FROM payroll_compliance_task WHERE employee_id=$1 AND task_key LIKE 'I9_EVERIFY_CASE:%'",[employee.id])).rows;expect(cases).toEqual(alternative?[{status:'OPEN'}]:[])
  await expect(exam).toHaveCount(0)
  await page.reload();await page.getByRole('button',{name:'People & onboarding',exact:true}).click()
  const summary=page.locator('summary').filter({hasText:'Employer I-9 review'});await expect(summary).toContainText('COMPLETE')
  const storage=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));expect(storage).not.toContain('Reviewer Alice');expect(storage).not.toContain('Authenticated hiring')
  expect(errors).toEqual([])
 }finally{try{await page.goto('about:blank');await page.unrouteAll({behavior:'wait'})}finally{try{await h.close()}finally{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}}
})
