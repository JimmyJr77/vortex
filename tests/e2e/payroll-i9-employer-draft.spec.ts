import {test,expect as baseExpect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {signedI9Fixture} from '../../backend/payroll/testing/signedI9Fixture.js'
const expect=baseExpect.configure({timeout:20000})
test('admin resumes private employer I-9 rows after a lost save and context invalidation',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='94'.repeat(32)
 const h=await createHarness(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const {api,employee,task}=await signedI9Fixture(h,{assisted:false})
  await page.setViewportSize({width:390,height:950})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  let lose=true
  await page.route('**/api/admin/payroll/**',async route=>{
   const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`,maxRetries:route.request().method()==='GET'?2:0})
   if(lose&&u.pathname.endsWith('/i9/employer-draft')&&route.request().method()==='POST'){expect(response.status()).toBe(200);lose=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic lost employer draft response. Retry unchanged.'})});return}
   await route.fulfill({response})
  })
  const open=async()=>{await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click();await page.locator('summary').filter({hasText:'Employer I-9 review'}).click()}
  await open();const panel=page.getByRole('region',{name:'Employer I-9 draft',exact:true}),save=panel.getByRole('button',{name:'Save employer I-9 draft',exact:true})
  await expect(save).toBeEnabled()
  await expect(panel.getByLabel('Employee-chosen document combination')).toHaveValue('')
  await panel.getByLabel('Employee-chosen document combination').selectOption('LIST_A')
  await panel.getByLabel('List A document 1: Document number (if any)',{exact:true}).fill('SYNTHETIC-PRIVATE-DOC')
  await panel.getByRole('button',{name:'Add another List A document'}).click()
  await panel.getByLabel('List A document 2: Document title',{exact:true}).fill('Synthetic second document')
  await save.click();await expect(panel.getByRole('alert')).toContainText('Synthetic lost employer draft response')
  await save.click();await expect(panel.getByRole('status')).toContainText('saved securely')
  expect((await h.pool.query('SELECT revision FROM payroll_i9_employer_draft WHERE employee_id=$1',[employee.id])).rows[0].revision).toBe(1)
  await open();await expect(panel.getByLabel('List A document 1: Document number (if any)',{exact:true})).toHaveValue('SYNTHETIC-PRIVATE-DOC')
  await panel.getByLabel('Employee-chosen document combination').selectOption('LIST_B_C')
  await panel.getByLabel('List B: Document title',{exact:true}).fill('Synthetic identity document')
  await panel.getByLabel('List C: Document title',{exact:true}).fill('Synthetic authorization document')
  await panel.getByRole('combobox',{name:'Examination method',exact:true}).selectOption('ALTERNATIVE')
  await expect(panel).toContainText('Employer eligibility, required document copies')
  await save.click();await expect(panel.getByRole('status')).toContainText('saved securely')
  await open();await expect(panel.getByLabel('List C: Document title',{exact:true})).toHaveValue('Synthetic authorization document')
  expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await panel.screenshot({path:'/tmp/payroll-i9-employer-draft-mobile.png'})
  const storage=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));expect(storage).not.toContain('SYNTHETIC-PRIVATE-DOC')
  await panel.getByLabel('Employee-chosen document combination').selectOption('LIST_A')
  await expect(panel.getByLabel('List A document 2: Document title',{exact:true})).toHaveValue('Synthetic second document')
  await api(`/employees/${employee.id}/onboarding/${task.id}/i9/context`,{onboardingCycle:1,expectedRevision:1,offerAccepted:true,offerAcceptedOn:'2026-09-01',eVerify:true,evidence:'Synthetic hiring-site participation update verified by admin.'})
  await save.click();await expect(panel.getByRole('alert')).toContainText('context changed')
  await panel.getByRole('button',{name:'Reload employer draft (replaces unsaved entries)'}).click()
  await expect(panel.getByRole('status')).toContainText('Previous draft entries are no longer current')
  await expect(panel.getByLabel('Employee-chosen document combination')).toHaveValue('')
  expect((await h.pool.query("SELECT status FROM payroll_onboarding_task WHERE employee_id=$1 AND task_key='I9_REVIEW'",[employee.id])).rows[0].status).toBe('OPEN')
  expect(errors).toEqual([])
 }finally{try{await h.close()}finally{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}
})
