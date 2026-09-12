import {test,expect as baseExpect} from '@playwright/test'
const expect=baseExpect.configure({timeout:20000})
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {monthlyBenefitsFixture} from '../../backend/payroll/testing/monthlyBenefitsFixture.js'
import {decryptDocument} from '../../backend/payroll/onboarding.js'
import {createRequire} from 'node:module'
import {writeFile} from 'node:fs/promises'
const {PDFDocument}=createRequire(new URL('../../backend/package.json',import.meta.url))('pdf-lib')

for(const exemption of [false,true])test(`employee completes W-4 internally, resumes and signs, then admin applies it: exemption=${exemption}`,async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated local payroll database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const oldKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='67'.repeat(32)
 const h=await createHarness(),errors:string[]=[]
 page.on('pageerror',e=>errors.push(e.message))
 try{
  const {api,employee}=await monthlyBenefitsFixture(h)
  await page.setViewportSize({width:390,height:950})
  await page.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','monthly-benefits-session'))
  let lose=true
  await page.route('**/api/payroll/employee/**',async route=>{
   const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`})
   if(lose&&u.pathname.endsWith('/w4/sign')){expect(response.status()).toBe(200);lose=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic lost W-4 response. Retry unchanged.'})});return}
   await route.fulfill({response})
  })
  const open=async()=>{await page.goto('/tests/support/payroll.html?employee=1');await page.getByRole('button',{name:'Onboarding',exact:true}).click();await page.locator('summary').filter({hasText:'Federal Form W-4'}).click()}
  await open()
  const panel=page.getByRole('region',{name:'Complete W-4 internally',exact:true})
  const capturePage=async(n:number)=>{const data=await panel.locator('canvas').evaluate(canvas=>(canvas as HTMLCanvasElement).toDataURL('image/png').split(',')[1]);await writeFile(`/tmp/payroll-w4-native-${exemption?'exempt-':''}preview-page${n}.png`,Buffer.from(data,'base64'))}
  await panel.getByRole('textbox',{name:'First name and middle initial',exact:true}).fill('Synthetic')
  await panel.getByLabel('Social security number',{exact:true}).fill('123-4')
  await panel.getByRole('button',{name:'Save W-4 draft',exact:true}).click()
  await expect(panel.getByRole('status').filter({hasText:'W-4 draft saved securely.'})).toBeVisible()
  await open()
  await expect(panel.getByRole('textbox',{name:'First name and middle initial',exact:true})).toHaveValue('Synthetic')
  await expect(panel.getByLabel('Social security number',{exact:true})).toHaveValue('123-4')

  await panel.getByRole('textbox',{name:'Last name',exact:true}).fill('Employee')
  await panel.getByRole('textbox',{name:'Address',exact:true}).fill('123 Test Street')
  await panel.getByRole('textbox',{name:'City or town, state, and ZIP code',exact:true}).fill('Bowie MD 20715')
  await panel.getByLabel('Social security number',{exact:true}).fill('123456789')
  await panel.getByRole('combobox',{name:'Step 1(c): Filing status',exact:true}).selectOption('HEAD_OF_HOUSEHOLD')
  await panel.getByRole('combobox',{name:'Are you a nonresident alien?',exact:true}).selectOption('NO')
  await panel.getByRole('textbox',{name:'Step 3: Total credits in dollars',exact:true}).fill('125.55')
  await panel.getByRole('textbox',{name:'Step 4(c): Extra withholding in dollars',exact:true}).fill('10.00')
  if(exemption){await panel.getByRole('checkbox',{name:'Exempt from withholding:',exact:false}).check();await panel.getByRole('button',{name:'Clear filing status and Steps 2–4 for exemption',exact:true}).click()}
  const prepare=panel.getByRole('button',{name:'Prepare W-4 for review',exact:true})
  await prepare.click()
  await expect(panel).toContainText('Page 1 of 5 displayed and review visit saved.')
  const sign=panel.getByRole('button',{name:'Sign and submit W-4',exact:true})
  await expect(sign).toBeDisabled()
  await panel.getByRole('button',{name:'Edit answers and restart review',exact:true}).click()
  if(!exemption)await panel.getByRole('textbox',{name:'Step 4(c): Extra withholding in dollars',exact:true}).fill('42.50')
  await prepare.click()
  await expect(panel).toContainText('Page 1 of 5 displayed and review visit saved.')
  await panel.getByRole('combobox',{name:'Page zoom',exact:true}).selectOption('3')
  await capturePage(1)
  const scroll=panel.getByRole('region',{name:'W-4 page image; scroll horizontally when zoomed',exact:true})
  expect(await scroll.evaluate(el=>{el.scrollLeft=el.scrollWidth;return el.scrollLeft>0})).toBe(true)
  for(let n=2;n<=5;n++){
   await panel.getByRole('button',{name:`Page ${n}`,exact:true}).click()
   await expect(panel).toContainText(`Page ${n} of 5 displayed and review visit saved.`)
   await capturePage(n)
  }
  await expect(panel).toContainText('5 of 5 pages visited.')
  await panel.getByRole('checkbox',{name:'I have reviewed all five pages and my entries.',exact:false}).check()
  await panel.getByRole('textbox',{name:'Employee’s signature (This form is not valid unless you sign it.)',exact:true}).fill('Synthetic Employee')
  await sign.click();await expect(panel.getByRole('alert')).toContainText('Synthetic lost W-4 response')
  await sign.click();await expect(page.getByRole('status').filter({hasText:'Your signed W-4 was submitted for hiring-admin review.'})).toBeVisible()
  const rows=await h.pool.query('SELECT * FROM payroll_w4_submission WHERE employee_id=$1',[employee.id]);expect(rows.rowCount).toBe(1)
  const doc=(await h.pool.query('SELECT * FROM payroll_private_document WHERE id=$1',[rows.rows[0].document_id])).rows[0]
  const pdf=await PDFDocument.load(decryptDocument(doc.encrypted_content,`1:${employee.id}:${doc.task_id}`))
  expect(pdf.getForm().getTextField('topmostSubform[0].Page1[0].f1_11[0]').getText()||'').toBe(exemption?'':'42.50')
  expect(pdf.getForm().getTextField('vortex.w4.employeeSignature').getText()).toBe('Synthetic Employee')
  const storage=await page.evaluate(()=>JSON.stringify({session:{...sessionStorage},local:{...localStorage}}))
  expect(storage).not.toContain('123456789');expect(storage).not.toContain('123 Test Street')
  await open();await expect(page.getByRole('button',{name:'Form-W4-2026-signed.pdf',exact:true})).toBeVisible()
  await expect(panel.getByLabel('Social security number',{exact:true})).toHaveValue('')
  expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  expect((await api('/onboarding',undefined,'GET',200,true)).tasks.find(t=>t.task_key==='W4').status).toBe('SUBMITTED')
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click()
  const step=page.locator('details').filter({has:page.getByText('Federal Form W-4',{exact:true})});await step.locator('summary').first().click()
  await expect(step.getByRole('button',{name:'Form-W4-2026-signed.pdf',exact:true})).toBeVisible()
  await step.getByRole('textbox',{name:'Review evidence / instructions',exact:true}).fill('Reviewed the retained employee signature and exact W-4 answers')
  await step.getByRole('button',{name:'Verify & complete',exact:true}).click()
  await expect(page.getByRole('status').filter({hasText:'Step reviewed and completed.'})).toBeVisible()
  await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
  const tax=page.getByRole('heading',{name:'Automatic withholding · 2026',exact:true}).locator('..')
  await expect(tax).toContainText('Federal values come from signed internal W-4')
  const extra=tax.getByRole('spinbutton',{name:'W-4 Step 4(c) extra per paycheck ($)',exact:true})
  await expect(extra).toHaveValue(exemption?'0':'42.5');await expect(extra).toBeDisabled()
  await expect(tax.getByRole('spinbutton',{name:'W-4 Step 3 annual credits ($)',exact:true})).toHaveValue(exemption?'0':'125.55')
  await tax.getByRole('textbox',{name:'Verification source',exact:true}).fill('Reviewed internal W-4 and synthetic Maryland certificate and local rate')
  await tax.getByRole('checkbox',{name:'I verified these values against signed forms',exact:false}).check()
  await tax.getByRole('button',{name:'Save verified tax elections',exact:true}).click()
  await expect(tax.getByRole('status')).toContainText('Verified elections saved.')
  const elected=(await api(`/employees/${employee.id}/tax-elections`)).election.elections
  expect(elected.federal.extraWithholdingCents).toBe(exemption?0:4250);expect(elected.federal.filingStatus).toBe(exemption?null:'HEAD_OF_HOUSEHOLD');expect(elected.w4Source.submissionId).toBe(rows.rows[0].id);expect(elected.w4ReviewRequired).toBeUndefined()
  expect(errors).toEqual([])
 }finally{
  await page.unrouteAll({behavior:'ignoreErrors'});await page.close();await h.close()
  if(oldKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=oldKey
 }
})
