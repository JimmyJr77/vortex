import {test,expect as baseExpect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {employerI9ReviewFixture} from '../../backend/payroll/testing/employerI9ReviewFixture.js'
const expect=baseExpect.configure({timeout:20000})
test('admin resumes encrypted examination findings with fresh signing consent after lost save response',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(120000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='94'.repeat(32)
 const h=await createHarness(),errors:string[]=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Examination page error:',e.message)})
 try{
  await employerI9ReviewFixture(h)
  await page.setViewportSize({width:390,height:950});await page.addInitScript(()=>{if(location.protocol==='http:'||location.protocol==='https:')localStorage.setItem('adminToken','payroll-test-admin')})
  let lose=true
  await page.route('**/api/admin/payroll/**',async route=>{
   const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`,maxRetries:route.request().method()==='GET'?2:0})
   if(lose&&u.pathname.endsWith('/i9/examination-draft')&&route.request().method()==='POST'){expect(response.status()).toBe(200);lose=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic lost examination save response.'})});return}
   await route.fulfill({response})
  })
  const open=async()=>{await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click();await page.locator('summary').filter({hasText:'Employer I-9 review'}).click();await page.getByRole('button',{name:'Prepare employer I-9 preview',exact:true}).click()}
  await open();const exam=page.getByRole('region',{name:'Employer examination and signature',exact:true})
  await exam.getByLabel('Examiner initials',{exact:true}).fill('RA')
  await exam.getByRole('textbox',{name:'Examiner identity and authority evidence',exact:true}).fill('Private unfinished examiner notes')
  await exam.getByRole('checkbox',{name:'Monday',exact:true}).check()
  await exam.getByRole('checkbox',{name:'I read and agree to the employer certification above.',exact:true}).check()
  await exam.getByLabel('Your employer electronic signature',{exact:true}).fill('UNSAVED SIGNATURE')
  await exam.getByRole('button',{name:'Save unfinished examination findings',exact:true}).click()
  await expect(exam.getByRole('alert')).toContainText('Synthetic lost examination save response')
  await exam.getByRole('button',{name:'Save unfinished examination findings',exact:true}).click()
  await expect(exam.getByRole('status')).toContainText('Examination findings saved securely')
  expect((await h.pool.query('SELECT revision FROM payroll_i9_examination_draft')).rows).toEqual([{revision:1}])
  await open()
  await expect(exam.getByRole('textbox',{name:'Examiner identity and authority evidence',exact:true})).toHaveValue('Private unfinished examiner notes')
  await expect(exam.getByLabel('Examiner initials',{exact:true})).toHaveValue('RA')
  await expect(exam.getByRole('checkbox',{name:'Monday',exact:true})).toBeChecked()
  await expect(exam.getByRole('checkbox',{name:'I read and agree to the employer certification above.',exact:true})).not.toBeChecked()
  await expect(exam.getByLabel('Your employer electronic signature',{exact:true})).toHaveValue('')
  const storage=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));expect(storage).not.toContain('Private unfinished');expect(storage).not.toContain('UNSAVED SIGNATURE')
  expect((await h.pool.query('SELECT * FROM payroll_i9_employer_signature')).rowCount).toBe(0)
  await expect(page.getByRole('region',{name:'Official I-9 employer preview page review',exact:true}).getByRole('status')).toContainText('Page 1 of 4 displayed and review visit saved.')
  expect(await exam.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await exam.screenshot({path:'/tmp/payroll-examination-draft-resumed.png'})
  expect(errors).toEqual([])
 }catch(error){await page.screenshot({path:'/tmp/payroll-examination-draft-failure.png',fullPage:true});throw error}finally{try{await page.goto('about:blank');await page.unrouteAll({behavior:'wait'})}finally{try{await h.close()}finally{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}}
})
