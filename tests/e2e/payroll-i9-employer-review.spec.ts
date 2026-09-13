import {test,expect as baseExpect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {signedI9Fixture} from '../../backend/payroll/testing/signedI9Fixture.js'
const expect=baseExpect.configure({timeout:20000})
test('admin prepares saved Section 2 and reviews employee and preparer PDFs internally',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='96'.repeat(32)
 const h=await createHarness(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const {api,employee,task,signed}=await signedI9Fixture(h)
  const preparers=`/employees/${employee.id}/onboarding/${task.id}/i9/preparers`
  const invite=await api(preparers,{onboardingCycle:1,submissionId:signed.submissionId,name:'Alice Translator',email:'alice@example.test',evidence:'Synthetic preparer identity and contact verified by admin.',confirmed:true,requestKey:randomUUID()})
  const guest=async(path:string,body:unknown)=>{const r=await fetch(`${h.url}/api/payroll/preparer/${path}`,{method:'POST',headers:{Authorization:`Bearer ${invite.token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});expect(r.status).toBe(200);return (await r.json()).data}
  const p=await guest('preview',{preparer:{firstName:'Alice',lastName:'Translator',address:'20 Example Road',city:'Bowie',state:'MD',postalCode:'20715'}})
  await guest('page',{reviewId:p.reviewId,previewSha256:p.previewSha256,displayed:true})
  await guest('sign',{reviewId:p.reviewId,previewSha256:p.previewSha256,signature:'Alice Translator',attestation:p.attestation,attestationRead:true,reviewed:true,signingAsPreparer:true,requestKey:randomUUID()})
  const roster=await api(preparers+'?onboardingCycle=1')
  await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{onboardingCycle:1,status:'COMPLETE',note:'Reviewed employee Section 1 and all current preparer certifications.',i9PreparerReview:{confirmed:true,fingerprint:roster.fingerprint}})
  await page.setViewportSize({width:390,height:950})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`,maxRetries:route.request().method()==='GET'?2:0})})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click();await page.locator('summary').filter({hasText:'Employer I-9 review'}).click()
  const panel=page.getByRole('region',{name:'Employer I-9 draft',exact:true}),prepare=panel.getByRole('button',{name:'Prepare employer I-9 preview',exact:true})
  await expect(panel.getByRole('button',{name:'Save employer I-9 draft',exact:true})).toBeEnabled()
  await panel.getByRole('combobox',{name:'Employee-chosen document combination',exact:true}).selectOption('LIST_A')
  for(const [label,value] of [['List A document 1: Document title','U.S. Passport'],['List A document 1: Issuing authority','U.S. Department of State'],['List A document 1: Document number (if any)','SYNTHETIC-BROWSER-123'],['List A document 1: Expiration date (if any)','2030-01-01'],['First day of employment (YYYY-MM-DD)','2026-09-01'],['Representative last name, first name and title','Reviewer Alice, Hiring Admin'],['Employer business or organization name','Synthetic Employer'],['Employer business address, city, state and ZIP','20 Example Road, Bowie, MD 20715']])await panel.getByLabel(label,{exact:true}).fill(value)
  await panel.getByRole('combobox',{name:'Examination method',exact:true}).selectOption('PHYSICAL')
  await expect(prepare).toBeDisabled()
  await panel.getByRole('button',{name:'Save employer I-9 draft',exact:true}).click();await expect(panel.getByRole('status')).toContainText('saved securely')
  await prepare.click()
  const main=panel.getByRole('region',{name:'Official I-9 employer preview page review',exact:true}),supplement=panel.getByRole('region',{name:'Official I-9 preparer certificate 1 page review',exact:true})
  for(let n=1;n<=4;n++){await main.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(main.getByRole('status')).toContainText(`Page ${n} of 4 displayed and review visit saved.`)}
  await expect(supplement.getByRole('status')).toContainText('Page 1 of 1 displayed and review visit saved.')
  await supplement.locator('summary').click();await expect(supplement).toContainText('Alice')
  await main.getByRole('button',{name:'Page 1',exact:true}).click();await expect(main.getByRole('status')).toContainText('Page 1 of 4 displayed')
  await main.locator('summary').click();await expect(main).toContainText('SYNTHETIC-BROWSER-123');await expect(main).toContainText('Łukasz')
  expect((await h.pool.query('SELECT count(*)::int AS n FROM payroll_i9_employer_page_visit')).rows[0].n).toBe(5)
  expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await main.locator('summary').click()
  await main.screenshot({path:'/tmp/payroll-i9-employer-review-mobile.png'})
  await panel.getByRole('button',{name:'Read official I-9 instructions here',exact:true}).click()
  const instructions=panel.getByRole('region',{name:'Official I-9 instructions page review',exact:true})
  for(let n=1;n<=8;n++){await instructions.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(instructions.getByRole('status')).toContainText(`Page ${n} of 8 displayed.`)}
  const storage=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));expect(storage).not.toContain('SYNTHETIC-BROWSER-123')
  await panel.getByLabel('Employer business or organization name',{exact:true}).fill('Changed employer')
  await expect(main).toHaveCount(0);await expect(prepare).toBeDisabled()
  expect((await h.pool.query("SELECT status FROM payroll_onboarding_task WHERE employee_id=$1 AND task_key='I9_REVIEW'",[employee.id])).rows[0].status).toBe('OPEN')
  expect(errors).toEqual([])
 }finally{try{await h.close()}finally{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}
})
