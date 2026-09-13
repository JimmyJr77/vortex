import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {supplementReceiptFixture} from '../../backend/payroll/testing/supplementReceiptFixture.js'
for(const scenario of ['List C','List A extension and name change','Alternative examination'])test(`admin completes a different-document Supplement B replacement (${scenario})`,async({page})=>{
 const extension=scenario==='List A extension and name change',alternative=scenario==='Alternative examination'
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(120000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='98'.repeat(32)
 const h=await createHarness(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
 const {pdf,today}=await supplementReceiptFixture(h,{eVerify:alternative})
 await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
 let loseSign=true,loseDraft=true,loseCopy=true
 await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());const response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`,maxRetries:route.request().method()==='GET'?2:0});if(response.status()===200&&route.request().method()==='POST'&&u.pathname.includes('/different-supplement/')){const kind=loseDraft&&u.pathname.endsWith('/draft')?'draft':loseCopy&&u.pathname.endsWith('/copies')?'copy':null;if(kind){if(kind==='draft')loseDraft=false;else loseCopy=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:`Synthetic ${kind} response lost.`})});return}}if(loseSign&&response.status()===200&&u.pathname.includes('/different-supplement/')&&u.pathname.endsWith('/sign')){loseSign=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic signing response lost.'})});return}await route.fulfill({response})})
 await page.setViewportSize({width:1100,height:950})
 await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click();await page.locator('summary').filter({hasText:'Employer I-9 review'}).click()
 const records=page.getByRole('region',{name:'Retained employer I-9 evidence',exact:true});await records.locator('summary').filter({hasText:'Current certification'}).click()
 await records.getByRole('button',{name:'Replace receipt with different Supplement B documents',exact:true}).click()
 const work=page.getByRole('region',{name:'I-9 replacement Supplement B workspace',exact:true})
 await work.getByLabel('Document list',{exact:true}).selectOption(extension?'A':'C')
 for(const [label,value] of [['Reason for different replacement documents','Employee selected a different acceptable authorization document.'],['Examiner initials on replacement explanation','RA'],['Document title','Synthetic replacement authorization'],['Document number (if any)','SYNTHETIC-C'],['Document expiration (if any)',extension?'2026-09-01':'2032-01-01'],['Examiner name on Supplement B','Reviewer Alice']])await work.getByLabel(label,{exact:true}).fill(value)
 await work.getByLabel('Examination method',{exact:true}).selectOption(alternative?'ALTERNATIVE':'PHYSICAL')
 const notation=`RA ${today.slice(5,7)}/${today.slice(8,10)}/${today.slice(0,4)}: Synthetic extension valid through January 1, 2030.`
 if(extension){await work.getByLabel('Initialed and dated form notation (if needed)',{exact:true}).fill(notation);await work.getByLabel('New first name (if changed)',{exact:true}).fill('Taylor');await work.getByLabel('New last name (if changed)',{exact:true}).fill('Updated')}
 await work.getByRole('button',{name:'Save unfinished supplement replacement',exact:true}).click()
 await expect(work.getByRole('alert')).toContainText('Synthetic draft response lost.')
 await work.getByRole('button',{name:'Save unfinished supplement replacement',exact:true}).click()
 expect((await h.pool.query('SELECT revision FROM payroll_i9_different_supplement_draft')).rows).toEqual([{revision:1}])
 await expect(work.getByText('Unfinished supplement replacement saved securely for your admin account.',{exact:true})).toBeVisible()
 await work.getByRole('button',{name:'Reload my saved supplement replacement (replaces unsaved entries)',exact:true}).click()
 await expect(work.getByLabel('Document title',{exact:true})).toHaveValue('Synthetic replacement authorization')
 await work.getByRole('button',{name:'Prepare replacement Supplement B for review',exact:true}).click()
 const packet=(await h.pool.query('SELECT page_counts FROM payroll_i9_different_supplement_review ORDER BY id DESC LIMIT 1')).rows[0]?.page_counts
 await expect(work.getByRole('region',{name:'Official Replacement Supplement B to sign page review',exact:true})).toBeVisible()
 const counts=packet||(await h.pool.query('SELECT page_counts FROM payroll_i9_different_supplement_review ORDER BY id DESC LIMIT 1')).rows[0].page_counts
 for(const [key,count] of Object.entries(counts)){
 const title=key==='replacement'?'Replacement Supplement B to sign':`Retained I-9 record ${key}`,viewer=work.getByRole('region',{name:`Official ${title} page review`,exact:true})
 for(let n=1;n<=Number(count);n++){await viewer.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(viewer.getByRole('status')).toContainText(`Page ${n} of ${count} displayed and review visit saved.`,{timeout:30000})}
 }
 const copies=work.getByRole('region',{name:'Replacement document document copies',exact:true})
 await copies.getByLabel('Replacement document copy (PDF, PNG or JPEG, up to 5 MB)',{exact:true}).setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:pdf})
 await copies.getByRole('button',{name:'Retain replacement copy',exact:true}).click()
 await expect(copies.getByRole('alert')).toContainText('Synthetic copy response lost.')
 await copies.getByRole('button',{name:'Retain replacement copy',exact:true}).click()
 expect(Number((await h.pool.query('SELECT count(*) FROM payroll_i9_different_supplement_copy')).rows[0].count)).toBe(1)
 await copies.getByRole('button',{name:'Review replacement copy 1 (2 pages)',exact:true}).click()
 const viewer=copies.getByRole('region',{name:'Official replacement document document copy page review',exact:true})
 for(let n=1;n<=2;n++){await viewer.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(viewer.getByRole('status')).toContainText(`Page ${n} of 2 displayed and review visit saved.`,{timeout:30000})}
 await copies.getByLabel('Use replacement copy 1',{exact:true}).check()
 for(const [label,value] of [['Actual examination date',today],['Examiner identity and authority evidence','Reviewer Alice examined the original document.'],['Official reverification rule URL','https://www.uscis.gov/i-9-central'],['Employee-specific reason reverification is required','Synthetic finite authorization requires review.'],['Different-document replacement evidence','Employee chose different acceptable documentation.'],['Official document-acceptance rule URL','https://www.uscis.gov/i-9-central'],['Document acceptance and future-review evidence','Synthetic acceptance and current authorization review.'],['Current authorization expiration (unless indefinite)','2031-01-01'],['Next follow-up date (if required)','2031-01-01']])await work.getByLabel(label,{exact:true}).fill(value)
 await work.getByLabel('Document acceptance',{exact:true}).selectOption(extension?'EXTENSION':'STANDARD');await work.getByLabel('Is current authorization indefinite?',{exact:true}).selectOption('no');await work.getByLabel('Required next follow-up',{exact:true}).selectOption('REVERIFICATION')
 if(extension){await work.getByLabel('Document validity through (if applicable)',{exact:true}).fill('2030-01-01');await work.getByLabel('Exact exception notation on the reviewed form',{exact:true}).fill(notation);await work.getByLabel('Next follow-up date (if required)',{exact:true}).fill('2030-01-01');await work.getByLabel('Name-change evidence (if applicable)',{exact:true}).fill('Employee reported their updated name with reviewed supporting evidence.')}
 if(alternative){await work.getByLabel('Current employer and site qualification evidence',{exact:true}).fill('Current employer and site qualification reviewed for this synthetic test.');await work.getByLabel('Live-video examination evidence',{exact:true}).fill('Examiner reviewed the same original documents during live video.')}
 await work.getByLabel('I read and affirm the Supplement B certification.',{exact:true}).check()
 await work.getByLabel('Your examiner signature',{exact:true}).fill('Unsaved signature')
 await work.getByRole('button',{name:'Save unfinished supplement replacement',exact:true}).click()
 await expect(work.getByText('Unfinished supplement replacement saved securely for your admin account.',{exact:true})).toBeVisible()
 expect((await h.pool.query('SELECT revision FROM payroll_i9_different_supplement_draft')).rows).toEqual([{revision:2}])
 await work.getByRole('button',{name:'Reload my saved supplement replacement (replaces unsaved entries)',exact:true}).click()
 await expect(work.getByRole('button',{name:'Prepare replacement Supplement B for review',exact:true})).toBeEnabled()
 await work.getByRole('button',{name:'Prepare replacement Supplement B for review',exact:true}).click()
 await expect(work.getByLabel('Examiner identity and authority evidence',{exact:true})).toHaveValue('Reviewer Alice examined the original document.')
 await expect(work.getByLabel('I read and affirm the Supplement B certification.',{exact:true})).not.toBeChecked()
 await expect(work.getByLabel('Your examiner signature',{exact:true})).toHaveValue('')
 if(extension){await expect(work.getByLabel('Exact exception notation on the reviewed form',{exact:true})).toHaveValue(notation);await expect(work.getByLabel('New last name (if changed)',{exact:true})).toHaveValue('Updated');await expect(work.getByLabel('Name-change evidence (if applicable)',{exact:true})).toHaveValue('Employee reported their updated name with reviewed supporting evidence.')}
 await expect(copies.getByLabel('Use replacement copy 1',{exact:true})).not.toBeChecked()
 for(const [key,count] of Object.entries(counts)){
 const title=key==='replacement'?'Replacement Supplement B to sign':`Retained I-9 record ${key}`,part=work.getByRole('region',{name:`Official ${title} page review`,exact:true})
 for(let n=1;n<=Number(count);n++){await part.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(part.getByRole('status')).toContainText(`Page ${n} of ${count} displayed and review visit saved.`,{timeout:30000})}
 }
 await copies.getByRole('button',{name:'Review replacement copy 1 (2 pages)',exact:true}).click()
 for(let n=1;n<=2;n++){await viewer.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(viewer.getByRole('status')).toContainText(`Page ${n} of 2 displayed and review visit saved.`,{timeout:30000})}
 await copies.getByLabel('Use replacement copy 1',{exact:true}).check()
 const physicalCheck='I examined the originals in the employee’s physical presence.'
 for(const label of ['The employee chose different acceptable documentation to replace the retained receipt.','This employee currently requires reverification and is not exempt.','The employee chose their acceptable List A or C documentation.','I reviewed current authorization and applicable automatic extensions.','The original documents reasonably appear genuine and relate to this employee.','The selected copies include every required side and page.',...(alternative?[]:[physicalCheck]),'I read and affirm the Supplement B certification.','I am the representative who performed this examination.','I reviewed every source, prior supplement, new supplement and selected copy page.','My identity and authority as the named representative are confirmed.'])await work.getByLabel(label,{exact:true}).check()
 if(alternative){await expect(work.getByLabel('Live-video examination evidence',{exact:true})).toHaveValue('Examiner reviewed the same original documents during live video.');for(const label of ['Current E-Verify good standing is verified.','Every hiring site using this procedure is enrolled.','Required examiner training is complete.','The procedure is applied consistently and without discrimination.','I reviewed copies before the live video examination.','The same original documents were presented during live video.']){await expect(work.getByLabel(label,{exact:true})).not.toBeChecked();await work.getByLabel(label,{exact:true}).check()}for(const label of ['I read and affirm the Supplement B certification.','I am the representative who performed this examination.','I reviewed every source, prior supplement, new supplement and selected copy page.','My identity and authority as the named representative are confirmed.'])await work.getByLabel(label,{exact:true}).check()}
 await work.getByLabel('Your examiner signature',{exact:true}).fill('Reviewer Alice')
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844})
  const box=await work.boundingBox(),signatureBox=await work.getByLabel('Your examiner signature',{exact:true}).boundingBox()
  expect(box?.width).toBeGreaterThanOrEqual(width-110);expect(signatureBox?.width).toBeGreaterThanOrEqual(width-140)
  expect(await work.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true)
 }
 await work.locator('form').last().screenshot({path:'/tmp/payroll-different-supplement-exam-mobile.png'})
 await work.screenshot({path:'/tmp/payroll-different-supplement-mobile.png'})
 await work.getByRole('button',{name:'Sign and retain replacement Supplement B',exact:true}).click()
 await expect(work.getByRole('alert')).toContainText('Synthetic signing response lost.')
 await work.getByRole('button',{name:'Sign and retain replacement Supplement B',exact:true}).click()
 await records.locator('summary').filter({hasText:'Signed replacement Supplement B'}).click()
 const download=page.waitForEvent('download');await records.getByRole('button',{name:'Download signed replacement Supplement B',exact:true}).click();await (await download).saveAs('/tmp/payroll-different-supplement-browser-signed.pdf')
 expect(Number((await h.pool.query('SELECT count(*) FROM payroll_i9_different_supplement_signature')).rows[0].count)).toBe(1)
 const next=(await h.pool.query("SELECT due_on::text FROM payroll_i9_signature_followup WHERE row_key LIKE 'DIFFERENT_SUPPLEMENT:%'")).rows
 expect(next).toEqual([{due_on:extension?'2030-01-01':'2031-01-01'}])
 expect(errors).toEqual([])
 }finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
