import {test,expect as baseExpect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {monthlyBenefitsFixture} from '../../backend/payroll/testing/monthlyBenefitsFixture.js'
const expect=baseExpect.configure({timeout:20000})
test('I-9 employee draft resumes, retries once and displays all official instructions',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const oldKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='67'.repeat(32)
 const h=await createHarness(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const {employee}=await monthlyBenefitsFixture(h)
  await page.setViewportSize({width:390,height:950})
  await page.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','monthly-benefits-session'))
  let lose=true
  await page.route('**/api/payroll/employee/**',async route=>{
   const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`,maxRetries:route.request().method()==='GET'?2:0})
   if(lose&&u.pathname.endsWith('/i9/draft')&&route.request().method()==='POST'){expect(response.status()).toBe(200);lose=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic lost I-9 draft response. Retry unchanged.'})});return}
   await route.fulfill({response})
  })
  const open=async()=>{await page.goto('/tests/support/payroll.html?employee=1');await page.getByRole('button',{name:'Onboarding',exact:true}).click();await page.locator('summary').filter({hasText:'Form I-9 employee section'}).click()}
  await open()
  const panel=page.getByRole('region',{name:'Internal I-9 draft',exact:true}),save=panel.getByRole('button',{name:'Save I-9 draft',exact:true})
  await panel.getByLabel('Last name (family name)',{exact:true}).fill('Żółć')
  await panel.getByLabel('Social Security number (if provided)',{exact:true}).fill('123-4')
  await expect(panel.getByRole('combobox',{name:'Did a preparer or translator assist you with Section 1?',exact:true})).toHaveValue('')
  await save.click();await expect(panel.getByRole('alert')).toContainText('Synthetic lost I-9 draft response')
  await save.click();await expect(panel.getByRole('status')).toContainText('I-9 draft saved securely.')
  expect((await h.pool.query('SELECT revision FROM payroll_i9_draft WHERE employee_id=$1',[employee.id])).rows[0].revision).toBe(1)
  await open();await expect(panel.getByLabel('Last name (family name)',{exact:true})).toHaveValue('Żółć')
  await expect(panel.getByLabel('Social Security number (if provided)',{exact:true})).toHaveValue('123-4')
  await panel.getByRole('combobox',{name:'Citizenship or immigration attestation',exact:true}).selectOption('AUTHORIZED_WORKER')
  await panel.getByRole('combobox',{name:'Identifier alternative',exact:true}).selectOption('PASSPORT')
  await panel.getByLabel('Selected identifier number',{exact:true}).fill('SYNTHETIC-PASSPORT')
  await panel.getByLabel('Passport country of issuance',{exact:true}).fill('Example country')
  await panel.getByRole('combobox',{name:'Did a preparer or translator assist you with Section 1?',exact:true}).selectOption('YES')
  const summary=page.locator('summary').filter({hasText:'Form I-9 employee section'});await summary.click();await summary.click()
  await expect(panel.getByLabel('Selected identifier number',{exact:true})).toHaveValue('SYNTHETIC-PASSPORT')
  await save.click();await expect(panel.getByRole('status')).toContainText('I-9 draft saved securely.')
  await open();await expect(panel.getByLabel('Passport country of issuance',{exact:true})).toHaveValue('Example country')
  await expect(panel).toContainText('Each assisting preparer or translator must separately complete and sign Supplement A.')
  await panel.getByRole('button',{name:'Read official I-9 instructions here',exact:true}).click()
  const review=panel.getByRole('region',{name:'Official I-9 instructions page review',exact:true})
  for(let n=1;n<=8;n++){await review.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(review.getByRole('status')).toContainText(`Page ${n} of 8 displayed.`)}
  expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await panel.screenshot({path:'/tmp/payroll-i9-draft-mobile.png'})
  const storage=await page.evaluate(()=>JSON.stringify({session:{...sessionStorage},local:{...localStorage}}));expect(storage).not.toContain('123-4');expect(storage).not.toContain('SYNTHETIC-PASSPORT')
  const task=(await h.pool.query("SELECT status,response FROM payroll_onboarding_task WHERE employee_id=$1 AND task_key='I9'",[employee.id])).rows[0]
  expect(task.status).toBe('OPEN');expect(JSON.stringify(task.response)).not.toContain('SYNTHETIC-PASSPORT')
  expect(JSON.stringify((await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='I9_DRAFT_SAVED'")).rows)).not.toContain('123-4')
  expect(errors).toEqual([])
 }finally{await page.unrouteAll({behavior:'ignoreErrors'});await page.close();await h.close();if(oldKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=oldKey}
})
