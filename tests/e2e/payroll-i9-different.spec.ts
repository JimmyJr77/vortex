import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {receiptFixture} from '../../backend/payroll/testing/receiptFixture.js'
const scenarios=[
 {name:'citizen',authorizedWorker:false,rows:['B','C'],alternative:false},
 {name:'finite authorization',authorizedWorker:true,rows:['B','C'],alternative:false},
 {name:'List A extension',authorizedWorker:true,rows:['A1'],alternative:false},
 {name:'List B extension',authorizedWorker:false,rows:['B','C'],alternative:false},
 {name:'two original receipts',authorizedWorker:false,rows:['A1'],alternative:false},
 {name:'List A citizen',authorizedWorker:false,rows:['A1'],alternative:false},
 {name:'List A multiple alternative',authorizedWorker:true,rows:['A1','A2','A3'],alternative:true},
]
for(const {name,authorizedWorker,rows,alternative} of scenarios)test(`admin signs different replacement documents (${name})`,async({page})=>{
 const listA=rows[0]==='A1',authorizationRow=listA?'A1':'C',exception=name.includes('extension'),exceptionRow=rows[0],multipleReceipts=name==='two original receipts'
 let notation=''
 const alternativeChecks=['Employer is currently in E-Verify good standing','All relevant hiring sites are enrolled','Required examiner training is complete','The procedure is applied consistently without discrimination','I examined copies before live video','The same originals were presented during live video']
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(90000);page.setDefaultTimeout(15000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='96'.repeat(32)
 const h=await createHarness(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const {pdf}=await receiptFixture(h,{authorizedWorker,eVerify:alternative,multipleReceipts})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  let failContext=true,loseUpload=true,loseSign=true,loseDraft=true
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());if(failContext&&u.pathname.includes('/different-documents/')&&u.pathname.endsWith('/context')){failContext=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic context outage.'})});return}const response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`,maxRetries:route.request().method()==='GET'?2:0});if(loseDraft&&route.request().method()==='POST'&&u.pathname.includes('/different-documents/')&&u.pathname.endsWith('/draft')){expect(response.status()).toBe(200);loseDraft=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic draft response lost.'})});return}if(loseUpload&&route.request().method()==='POST'&&u.pathname.includes('/different-documents/')&&u.pathname.endsWith('/copies')){expect(response.status()).toBe(200);loseUpload=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic upload response lost.'})});return}if(loseSign&&response.status()===200&&u.pathname.includes('/different-documents/')&&u.pathname.endsWith('/sign')){expect(response.status()).toBe(200);loseSign=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic signing response lost.'})});return}await route.fulfill({response})})
  await page.setViewportSize({width:1100,height:950})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click();await page.locator('summary').filter({hasText:'Employer I-9 review'}).click()
  const records=page.getByRole('region',{name:'Retained employer I-9 evidence',exact:true});await records.locator('summary').filter({hasText:'Current certification'}).click()
  await records.getByRole('button',{name:'Prepare different replacement documents',exact:true}).first().click()
  const work=page.getByRole('region',{name:'Different-document replacement workspace',exact:true})
  await expect(work.getByRole('alert')).toContainText('Synthetic context outage.')
  await work.getByRole('button',{name:'Reload saved replacement (replaces unsaved entries)',exact:true}).click()
  await expect(work.getByLabel('Employer business name',{exact:true})).not.toHaveValue('')
  if(multipleReceipts)await expect(work).toContainText('C (due 2026-11-15); B (due 2026-11-30)')
  await expect(work.getByLabel('Replacement examiner name and title',{exact:true})).toHaveValue('')
  await work.getByLabel('Replacement document combination',{exact:true}).selectOption(listA?'LIST_A':'LIST_B_C')
  if(listA)for(let n=1;n<rows.length;n++)await work.getByRole('button',{name:'Add List A document',exact:true}).click()
  for(const row of rows)for(const [label,value] of [['Document title','Synthetic document'],['Issuing authority','Synthetic issuer'],['Document number',`SYNTHETIC-${row}`],['Expiration (if any)',exception&&row===exceptionRow?'2026-09-01':'2030-01-01']])await work.getByLabel(`${listA?`List A document ${row.slice(1)}`:`List ${row} document`} — ${label}`,{exact:true}).fill(value)
  await work.getByLabel('Replacement examination method',{exact:true}).selectOption(alternative?'ALTERNATIVE':'PHYSICAL')
  await work.getByLabel('Replacement examiner name and title',{exact:true}).fill('Reviewer Alice, Hiring Administrator')
  await work.getByLabel('Reason for different replacement documents',{exact:true}).fill('Employee selected different acceptable documents after the original receipt.')
  await work.getByLabel('Replacement examiner initials',{exact:true}).fill('RA')
  if(exception){
   const today=(await h.pool.query("SELECT (clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=1")).rows[0].today
   notation=`RA ${today.slice(5,7)}/${today.slice(8,10)}/${today.slice(0,4)}: Synthetic verified extension through January 1, 2030.`
   await work.getByLabel('Additional replacement information',{exact:true}).fill(notation)
  }
  await work.getByRole('button',{name:'Save replacement draft',exact:true}).click()
  await expect(work.getByRole('alert')).toContainText('Synthetic draft response lost.')
  await work.getByRole('button',{name:'Save replacement draft',exact:true}).click()
  await expect(work.getByRole('status')).toContainText('Private draft saved')
  expect((await h.pool.query('SELECT revision FROM payroll_i9_different_draft')).rows).toEqual([{revision:1}])
  await expect(work.getByText('You have unsaved replacement entries or examination notes.',{exact:true})).toHaveCount(0)
  await work.getByLabel('Reason for different replacement documents',{exact:true}).fill('Unsaved changes should be discarded on explicit reload.')
  await expect(work.getByText('You have unsaved replacement entries or examination notes.',{exact:true})).toBeVisible()
  await work.getByRole('button',{name:'Reload saved replacement (replaces unsaved entries)',exact:true}).click()
  await expect(work.getByLabel('Reason for different replacement documents',{exact:true})).toHaveValue('Employee selected different acceptable documents after the original receipt.')
  await work.getByRole('button',{name:'Prepare replacement certification',exact:true}).click()
  for(const [title,count] of [['Review new replacement certification',2],['Review original employer I-9',4],['Review original employee I-9',4]] as const){
   const viewer=work.getByRole('region',{name:`Official ${title} page review`,exact:true})
   for(let n=1;n<=count;n++){
    await viewer.getByRole('button',{name:`Page ${n}`,exact:true}).click()
    await expect(viewer.getByRole('status')).toContainText(`Page ${n} of ${count} displayed and review visit saved.`,{timeout:30000})
   }
  }
  expect((await h.pool.query('SELECT * FROM payroll_i9_different_page_visit')).rowCount).toBe(10)
  for(const row of rows){
   const copies=work.getByRole('region',{name:`Replacement document ${row} copies`,exact:true})
   await copies.getByLabel('Replacement document copy (PDF, PNG or JPEG, up to 5 MB)',{exact:true}).setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:pdf})
   await copies.getByRole('button',{name:'Retain replacement copy',exact:true}).click()
   if(row===rows[0]){await expect(copies.getByRole('alert')).toContainText('Synthetic upload response lost.');await copies.getByRole('button',{name:'Retain replacement copy',exact:true}).click()}
   await copies.getByRole('checkbox',{name:'Use replacement copy 1',exact:true}).check()
   await copies.getByRole('button',{name:'Review replacement copy 1 (2 pages)',exact:true}).click()
   const viewer=copies.getByRole('region',{name:`Official replacement document ${row} copy page review`,exact:true})
   for(let n=1;n<=2;n++){await viewer.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(viewer.getByRole('status')).toContainText(`Page ${n} of 2 displayed and review visit saved.`,{timeout:30000})}
  }
  expect((await h.pool.query('SELECT * FROM payroll_i9_different_copy')).rowCount).toBe(rows.length)
  expect((await h.pool.query('SELECT * FROM payroll_i9_different_copy_page')).rowCount).toBe(rows.length*2)

  await page.screenshot({path:'/tmp/payroll-different-workspace-desktop.png',fullPage:true})
  for(const width of [320,390]){
   await page.setViewportSize({width,height:844})
   expect(await work.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
   const examination=work.getByRole('region',{name:'Replacement examination and signing',exact:true})
   expect(await examination.evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(width-110)
   expect(await examination.getByLabel('Replacement examiner electronic signature',{exact:true}).evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(width-130)
  }
  await work.getByRole('heading',{name:'Different replacement documents',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/payroll-different-workspace-mobile.png'})
  const exam=work.getByRole('region',{name:'Replacement examination and signing',exact:true})
  await exam.getByLabel('Replacement examiner identity and authority',{exact:true}).fill('Authenticated examiner personally examined the replacement originals.')
  await exam.getByLabel('Originals examined in the employee’s physical presence',{exact:true}).selectOption(alternative?'no':'yes')
  await exam.getByLabel('Employment lasts fewer than three business days',{exact:true}).selectOption('no')
  for(const day of ['Monday','Tuesday','Wednesday','Thursday','Friday'])await exam.getByRole('checkbox',{name:day,exact:true}).check()
  await exam.getByLabel('Current employment authorization is indefinite',{exact:true}).selectOption(authorizedWorker?'no':'yes')
  if(authorizedWorker)await exam.getByLabel('Current employment authorization expiration (if finite)',{exact:true}).fill('2030-01-01')
  await exam.getByLabel('Current employment authorization evidence',{exact:true}).fill('Reviewed current employment authorization and acceptable replacement documentation.')
  for(const label of ['I confirmed the employer business calendar','These are different acceptable documents replacing the receipt','The employee chose the replacement documents','I reviewed the current Section 1 and preparer certifications','The originals reasonably appear genuine and relate to this employee'])await exam.getByRole('checkbox',{name:label,exact:true}).check()
  for(const row of rows){
   await exam.getByRole('checkbox',{name:`Document ${row}: selected copies include every required side and page`,exact:true}).check()
   await exam.getByRole('checkbox',{name:`Document ${row}: acceptable for the selected list or combination`,exact:true}).check()
   await exam.getByLabel(`Document ${row}: Acceptance`,{exact:true}).selectOption(exception&&row===exceptionRow?'EXTENSION':'STANDARD')
   if(exception&&row===exceptionRow){
    await exam.getByLabel(`Document ${row}: Official rule URL`,{exact:true}).fill('https://www.uscis.gov/i-9-central')
    await exam.getByLabel(`Document ${row}: Acceptance and follow-up evidence`,{exact:true}).fill('Synthetic examiner verified the applicable extension and its qualifying evidence.')
    await exam.getByLabel(`Document ${row}: Verified validity through`,{exact:true}).fill('2030-01-01')
    await exam.getByLabel(`Document ${row}: Exception notation already on the reviewed form`,{exact:true}).fill(notation)
   }
   await exam.getByLabel(`Document ${row}: Next action`,{exact:true}).selectOption(authorizedWorker&&row===authorizationRow?'REVERIFICATION':'NONE')
   if(authorizedWorker&&row===authorizationRow){await exam.getByLabel(`Document ${row}: Next action date`,{exact:true}).fill('2030-01-01');await exam.getByLabel(`Document ${row}: Official rule URL`,{exact:true}).fill('https://www.uscis.gov/i-9-central');await exam.getByLabel(`Document ${row}: Acceptance and follow-up evidence`,{exact:true}).fill('Examiner verified the current employment authorization deadline.')}else await exam.getByRole('checkbox',{name:`Document ${row}: no follow-up is required`,exact:true}).check()
  }
  if(alternative){
   for(const label of alternativeChecks)await exam.getByRole('checkbox',{name:label,exact:true}).check()
   await exam.getByLabel('Current alternative-procedure qualification evidence',{exact:true}).fill('Examiner verified current employer enrollment, training and consistent procedure.')
   await exam.getByLabel('Live-video examination evidence',{exact:true}).fill('Examiner reviewed every copy then observed the same originals during live video.')
  }
  const consent=['I read and agree to the replacement employer certification','I am the examiner who performed this replacement examination','I reviewed every packet and selected copy page','My identity and authority as the named replacement examiner are confirmed']
  for(const label of consent)await exam.getByRole('checkbox',{name:label,exact:true}).check()
  await exam.getByLabel('Replacement examiner electronic signature',{exact:true}).fill('Reviewer Alice')
  await exam.getByLabel('Current employment authorization evidence',{exact:true}).fill('Verified current employment authorization against the retained replacement documentation.')
  await expect(exam.getByRole('checkbox',{name:consent[0],exact:true})).not.toBeChecked()
  await expect(exam.getByLabel('Replacement examiner electronic signature',{exact:true})).toHaveValue('')
  for(const label of consent)await exam.getByRole('checkbox',{name:label,exact:true}).check()
  await exam.getByLabel('Replacement examiner electronic signature',{exact:true}).fill('Reviewer Alice')
  await work.getByRole('button',{name:'Save replacement draft',exact:true}).click()
  await expect(work.getByRole('status').filter({hasText:'Private draft saved'})).toBeVisible()
  await expect(work.getByText('You have unsaved replacement entries or examination notes.',{exact:true})).toHaveCount(0)
  expect((await h.pool.query('SELECT revision FROM payroll_i9_different_draft')).rows).toEqual([{revision:2}])
  await work.getByRole('button',{name:'Reload saved replacement (replaces unsaved entries)',exact:true}).click()
  await expect(work.getByRole('status')).toContainText('Draft restored.')
  await work.getByRole('button',{name:'Prepare replacement certification',exact:true}).click()
  for(const [title,count] of [['Review new replacement certification',2],['Review original employer I-9',4],['Review original employee I-9',4]] as const){
   const viewer=work.getByRole('region',{name:`Official ${title} page review`,exact:true})
   for(let n=1;n<=count;n++){await viewer.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(viewer.getByRole('status')).toContainText(`Page ${n} of ${count} displayed and review visit saved.`,{timeout:30000})}
  }
  for(const row of rows){
   const copies=work.getByRole('region',{name:`Replacement document ${row} copies`,exact:true})
   await expect(copies.getByRole('checkbox',{name:'Use replacement copy 1',exact:true})).not.toBeChecked()
   await copies.getByRole('checkbox',{name:'Use replacement copy 1',exact:true}).check()
   await copies.getByRole('button',{name:'Review replacement copy 1 (2 pages)',exact:true}).click()
   const viewer=copies.getByRole('region',{name:`Official replacement document ${row} copy page review`,exact:true})
   for(let n=1;n<=2;n++){await viewer.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(viewer.getByRole('status')).toContainText(`Page ${n} of 2 displayed and review visit saved.`,{timeout:30000})}
  }
  await expect(exam.getByLabel('Current employment authorization evidence',{exact:true})).toHaveValue('Verified current employment authorization against the retained replacement documentation.')
  await expect(exam.getByRole('checkbox',{name:'Monday',exact:true})).toBeChecked()
  await expect(exam.getByLabel('Replacement examiner electronic signature',{exact:true})).toHaveValue('')
  await expect(exam.getByRole('checkbox',{name:consent[0],exact:true})).not.toBeChecked()
  if(alternative){
   await expect(exam.getByLabel('Current alternative-procedure qualification evidence',{exact:true})).toHaveValue('Examiner verified current employer enrollment, training and consistent procedure.')
   await expect(exam.getByLabel('Live-video examination evidence',{exact:true})).toHaveValue('Examiner reviewed every copy then observed the same originals during live video.')
   for(const label of alternativeChecks){await expect(exam.getByRole('checkbox',{name:label,exact:true})).not.toBeChecked();await exam.getByRole('checkbox',{name:label,exact:true}).check()}
  }
  for(const label of ['I confirmed the employer business calendar','These are different acceptable documents replacing the receipt','The employee chose the replacement documents','I reviewed the current Section 1 and preparer certifications','The originals reasonably appear genuine and relate to this employee'])await exam.getByRole('checkbox',{name:label,exact:true}).check()
  for(const row of rows){
   await exam.getByRole('checkbox',{name:`Document ${row}: selected copies include every required side and page`,exact:true}).check()
   await exam.getByRole('checkbox',{name:`Document ${row}: acceptable for the selected list or combination`,exact:true}).check()
   if(!authorizedWorker||row!==authorizationRow)await exam.getByRole('checkbox',{name:`Document ${row}: no follow-up is required`,exact:true}).check()
  }
  for(const label of consent)await exam.getByRole('checkbox',{name:label,exact:true}).check()
  await exam.getByLabel('Replacement examiner electronic signature',{exact:true}).fill('Reviewer Alice')
  if(exception){
   const notationField=exam.getByLabel(`Document ${exceptionRow}: Exception notation already on the reviewed form`,{exact:true})
   await expect(notationField).toHaveValue(notation)
   await expect(exam.getByLabel(`Document ${exceptionRow}: Verified validity through`,{exact:true})).toHaveValue('2030-01-01')
   await notationField.fill('This mismatched notation is absent from the reviewed form.')
   for(const label of consent)await exam.getByRole('checkbox',{name:label,exact:true}).check()
   await exam.getByLabel('Replacement examiner electronic signature',{exact:true}).fill('Reviewer Alice')
   await exam.getByRole('button',{name:'Sign replacement certification',exact:true}).click()
   await expect(exam.getByRole('alert')).toContainText('Record the applicable official rule, evidence and an initialed, dated notation')
   expect((await h.pool.query('SELECT * FROM payroll_i9_different_signature')).rowCount).toBe(0)
   await notationField.fill(notation)
   for(const label of consent)await exam.getByRole('checkbox',{name:label,exact:true}).check()
   await exam.getByLabel('Replacement examiner electronic signature',{exact:true}).fill('Reviewer Alice')
  }
  await exam.screenshot({path:'/tmp/payroll-different-examination-ui.png'})
  await exam.getByRole('button',{name:'Sign replacement certification',exact:true}).click()
  await expect(exam.getByRole('alert')).toContainText('Synthetic signing response lost.')
  await exam.getByRole('button',{name:'Sign replacement certification',exact:true}).click()
  const history=records.locator('details').filter({has:page.locator('summary').filter({hasText:'Signed different-document replacement'})}).last()
  await history.locator('summary').click()
  await expect(history).toContainText(authorizedWorker?'Recorded authorization: through 2030-01-01.':'Recorded authorization: indefinite.')
  if(exception)await expect(history).toContainText(`Form notation: ${notation}`)
  const download=page.waitForEvent('download');await history.getByRole('button',{name:'Download signed different-document certification',exact:true}).click()
  await (await download).saveAs('/tmp/payroll-different-ui-signed.pdf')
  expect((await h.pool.query('SELECT * FROM payroll_i9_different_signature')).rowCount).toBe(1)
  const resolutions=(await h.pool.query('SELECT r.row_key,c.status FROM payroll_i9_different_resolution r JOIN payroll_compliance_task c ON c.id=r.compliance_task_id ORDER BY r.row_key')).rows
  expect(resolutions).toEqual(multipleReceipts?[{row_key:'B',status:'COMPLETE'},{row_key:'C',status:'COMPLETE'}]:[{row_key:'A1',status:'COMPLETE'}])
  if(multipleReceipts)await expect(history).toContainText('Resolved original receipt rows: C (task')
  const followups=(await h.pool.query("SELECT kind,due_on::text FROM payroll_i9_signature_followup WHERE row_key LIKE 'DIFFERENT:%'")).rows
  expect(followups).toEqual(authorizedWorker?[{kind:'REVERIFICATION',due_on:'2030-01-01'}]:[])
  await expect(records.getByRole('button',{name:'Prepare different replacement documents',exact:true})).toHaveCount(0)
  expect(errors).toEqual([])
 }finally{
  await page.unrouteAll({behavior:'wait'}).catch(()=>{});await page.close().catch(()=>{});await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old
 }
})
