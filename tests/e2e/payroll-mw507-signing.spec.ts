import {test,expect as baseExpect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {monthlyBenefitsFixture} from '../../backend/payroll/testing/monthlyBenefitsFixture.js'
import {decryptDocument} from '../../backend/payroll/onboarding.js'
import {createRequire} from 'node:module'
import {writeFile} from 'node:fs/promises'
const {PDFDocument}=createRequire(new URL('../../backend/package.json',import.meta.url))('pdf-lib')
const expect=baseExpect.configure({timeout:20000})
for(const claim of ['NONE','PENNSYLVANIA'])test(`Maryland employee draft, review and signature: ${claim}`,async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const oldKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='67'.repeat(32)
 const h=await createHarness(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const {employee}=await monthlyBenefitsFixture(h)
  await page.setViewportSize({width:390,height:950})
  await page.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','monthly-benefits-session'))
  let lose=true
  await page.route('**/api/payroll/employee/**',async route=>{
   const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`})
   if(lose&&u.pathname.endsWith('/mw507/sign')){expect(response.status()).toBe(200);lose=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic lost MW507 response. Retry unchanged.'})});return}
   await route.fulfill({response})
  })
  const open=async()=>{await page.goto('/tests/support/payroll.html?employee=1');await page.getByRole('button',{name:'Onboarding',exact:true}).click();await page.locator('summary').filter({hasText:'State withholding certificate'}).click()}
  await open()
  const panel=page.getByRole('region',{name:'Complete MW507 internally',exact:true})
  await panel.getByLabel('Print full name',{exact:true}).fill('Łukasz Żółć')
  await panel.getByLabel('Social Security number',{exact:true}).fill('123-4')
  await panel.getByRole('button',{name:'Save MW507 draft',exact:true}).click()
  await expect(panel).toContainText('MW507 draft saved securely.')
  await open();await expect(panel.getByLabel('Social Security number',{exact:true})).toHaveValue('123-4')
  await expect(panel.getByLabel('Print full name',{exact:true})).toHaveValue('Łukasz Żółć')
  await panel.getByLabel('Social Security number',{exact:true}).fill('123456789')
  await panel.getByLabel('Street address, city, state and ZIP',{exact:true}).fill('100 Example Street, Bowie MD 20715')
  await panel.getByLabel('County of residence',{exact:false}).fill("Prince George’s")
  await panel.getByRole('combobox',{name:'Exemption basis',exact:true}).selectOption(claim)
  if(claim==='NONE'){
   await panel.getByRole('combobox',{name:'Maryland withholding rate',exact:true}).selectOption('MARRIED_SINGLE')
   await panel.getByLabel('Line 1: total exemptions claimed',{exact:true}).fill('2')
   await panel.getByRole('checkbox',{name:'Complete the Personal Exemptions Worksheet on page 2',exact:true}).check()
   await panel.getByRole('combobox',{name:'Worksheet tax-return filing group',exact:true}).selectOption('JOINT')
   for(const [label,value] of [['Estimated federal AGI in dollars','90000'],['Worksheet line a: personal exemption count','3'],['Worksheet line b: additional dependents age 65 or over','1'],['Worksheet line c: eligible additional deduction amount in dollars','4800'],['Worksheet line d: taxpayer/spouse age 65 or blindness exemption count (0–4)','2']])await panel.getByLabel(label,{exact:true}).fill(value)
   await panel.getByRole('button',{name:'Save MW507 draft',exact:true}).click();await expect(panel).toContainText('MW507 draft saved securely.')
   await open();await expect(panel.getByLabel('Estimated federal AGI in dollars',{exact:true})).toHaveValue('90000')
  }else{
   await panel.getByRole('checkbox',{name:'I certify that I do not maintain',exact:false}).check()
   await panel.getByRole('combobox',{name:'Pennsylvania local-tax exemption',exact:true}).selectOption('YORK_ADAMS')
  }
  await panel.getByRole('button',{name:'Prepare MW507 for review',exact:true}).click()
  await expect(panel).toContainText('Page 1 of 2 displayed and review visit saved.')
  const sign=panel.getByRole('button',{name:'Sign and submit MW507',exact:true});await expect(sign).toBeDisabled()
  for(const n of [1,2]){
   await panel.getByRole('button',{name:`Page ${n}`,exact:true}).click()
   await expect(panel).toContainText(`Page ${n} of 2 displayed and review visit saved.`)
   const data=await panel.locator('canvas').evaluate(c=>(c as HTMLCanvasElement).toDataURL().split(',')[1]);await writeFile(`/tmp/payroll-mw507-${claim}-page${n}.png`,Buffer.from(data,'base64'))
  }
  await panel.getByRole('checkbox',{name:'I reviewed both pages',exact:false}).check()
  await panel.getByLabel('Employee’s MW507 signature',{exact:true}).fill('Łukasz Żółć')
  await sign.click();await expect(panel.getByRole('alert')).toContainText('Synthetic lost MW507 response')
  await sign.click();await expect(page.getByRole('status').filter({hasText:'Your signed MW507 was submitted'})).toBeVisible()
  const rows=await h.pool.query('SELECT * FROM payroll_mw507_submission WHERE employee_id=$1',[employee.id]);expect(rows.rowCount).toBe(1)
  const doc=(await h.pool.query('SELECT * FROM payroll_private_document WHERE id=$1',[rows.rows[0].document_id])).rows[0]
  const pdf=await PDFDocument.load(decryptDocument(doc.encrypted_content,`1:${employee.id}:${doc.task_id}`))
  if(claim==='NONE')expect(pdf.getForm().getTextField('Text Field 31').getText()).toBe('6')
  expect(pdf.getPageCount()).toBe(2);expect(pdf.getForm().getTextField('vortex.mw507.employeeSignature').getText()).toBe('Łukasz Żółć')
  const storage=await page.evaluate(()=>JSON.stringify({session:{...sessionStorage},local:{...localStorage}}));expect(storage).not.toContain('123456789');expect(storage).not.toContain('100 Example Street')
  await open();await expect(page.getByRole('button',{name:'Form-MW507-2026-signed.pdf',exact:true})).toBeVisible()
  await expect(panel.getByLabel('Social Security number',{exact:true})).toHaveValue('')
  expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  const step=page.locator('details').filter({has:panel});await expect(step.getByRole('button',{name:'Update submission',exact:true})).toHaveCount(0)
  await step.getByLabel('Supporting documents (PDF, PNG or JPEG; up to 5 MB)',{exact:true}).setInputFiles({name:'supporting-review.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())})
  await expect(page.getByRole('status').filter({hasText:'Supporting document securely uploaded.'})).toBeVisible()
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click()
  const adminStep=page.locator('details').filter({has:page.getByText('State withholding certificate',{exact:true})});await adminStep.locator('summary').first().click()
  await expect(adminStep.getByRole('button',{name:'Form-MW507-2026-signed.pdf',exact:true})).toBeVisible()
  await expect(adminStep.getByRole('button',{name:'supporting-review.pdf',exact:true})).toBeVisible()
  const downloadPromise=page.waitForEvent('download');await adminStep.getByRole('button',{name:'Form-MW507-2026-signed.pdf',exact:true}).click();expect((await downloadPromise).suggestedFilename()).toBe('Form-MW507-2026-signed.pdf')
  if(claim==='NONE'){
   await adminStep.getByRole('textbox',{name:'Review evidence / instructions',exact:true}).fill('Reviewed retained synthetic Maryland certificate and worksheet')
   await adminStep.getByRole('button',{name:'Verify & complete',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Step reviewed and completed.'})).toBeVisible()
  }
  await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
  const source=page.getByRole('region',{name:'Signed Maryland certificate review',exact:true})
  await expect(source).toContainText('Signed internal MW507')
  await expect(source).toContainText(claim==='NONE'?'Hiring checklist review completed.':'Hiring checklist review is pending.')
  if(claim==='PENNSYLVANIA')await expect(source).toContainText('Nonresidence exemption claimed')
  await expect(page.getByRole('button',{name:'Save verified tax elections',exact:true})).toBeDisabled()
  const sourceDownload=page.waitForEvent('download');await source.getByRole('button',{name:'Download signed MW507 for review',exact:true}).click();expect((await sourceDownload).suggestedFilename()).toBe('Form-MW507-2026-signed.pdf')
  if(claim==='NONE'){
   const tax=page.getByRole('heading',{name:'Automatic withholding · 2026',exact:true}).locator('..')
   await expect(tax.getByRole('spinbutton',{name:'MW507 exemptions',exact:true})).toHaveValue('2');await expect(tax.getByRole('spinbutton',{name:'MW507 exemptions',exact:true})).toBeDisabled()
   await tax.getByRole('textbox',{name:'Certificate correctness and revocation evidence',exact:true}).fill('Reviewed certificate and synthetic employer correspondence')
   await tax.getByRole('textbox',{name:'Residence and local-rate evidence',exact:true}).fill('Synthetic Maryland resident and verified 3.20 percent table')
   for(const prefix of ['I reviewed the signed certificate','I checked the employer’s Comptroller correspondence','I verified Maryland work and residence'])await tax.getByRole('checkbox',{name:prefix,exact:false}).check()
   await tax.getByRole('textbox',{name:'Verification source',exact:true}).fill('Reviewed signed Maryland certificate and synthetic federal settings')
   await tax.getByRole('checkbox',{name:'I verified these values against signed forms',exact:false}).check()
   await tax.getByRole('button',{name:'Save verified tax elections',exact:true}).click();await expect(tax.getByRole('status')).toContainText('Verified elections saved.')
   const applied=(await h.pool.query('SELECT elections FROM payroll_tax_election WHERE employee_id=$1',[employee.id])).rows[0].elections
   expect(applied.mw507Source.submissionId).toBe(rows.rows[0].id);expect(applied.maryland.exemptions).toBe(2);expect(applied.mw507ReviewRequired).toBeUndefined()
  }
  await source.screenshot({path:`/tmp/payroll-mw507-admin-${claim}.png`})
  expect(errors).toEqual([])
 }finally{await page.unrouteAll({behavior:'ignoreErrors'});await page.close();await h.close();if(oldKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=oldKey}
})
