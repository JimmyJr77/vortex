import {writeFile} from 'node:fs/promises'
import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {reverificationFixture} from '../../backend/payroll/testing/reverificationFixture.js'
test('admin reviews and signs Supplement B in payroll and recovers a lost signing response',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(180000);page.setDefaultTimeout(15000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='95'.repeat(32)
 const h=await createHarness(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&message.text().includes('Encountered two children'))errors.push(message.text())})
 try{
  const {pdf}=await reverificationFixture(h),today=(await h.pool.query("SELECT (clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=1")).rows[0].today
  await page.setViewportSize({width:1100,height:950});await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  let lose=true
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`,maxRetries:route.request().method()==='GET'?2:0});if(lose&&u.pathname.includes('/i9/supplement/')&&u.pathname.endsWith('/sign')){expect(response.status()).toBe(200);lose=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic lost supplement response. Retry unchanged.'})});return}await route.fulfill({response})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click()
  await page.locator('summary').filter({hasText:'Employer I-9 review'}).click()
  const records=page.getByRole('region',{name:'Retained employer I-9 evidence',exact:true})
  await records.locator('summary').filter({hasText:'Current certification'}).click()
  await records.getByRole('button',{name:'Complete reverification with Supplement B',exact:true}).click()
  const work=page.getByRole('region',{name:'I-9 reverification workspace',exact:true})
  await work.getByLabel('Document list',{exact:true}).selectOption('A')
  await work.getByLabel('Document title',{exact:true}).fill('Employment Authorization Document')
  await work.getByLabel('Document number (if any)',{exact:true}).fill('SYNTHETIC-RENEWED')
  await work.getByLabel('Document expiration (if any)',{exact:true}).fill('2032-01-01')
  await work.getByLabel('Examiner name on Supplement B',{exact:true}).fill('Reviewer Alice')
  await work.getByLabel('Examination method',{exact:true}).selectOption('PHYSICAL')
  await work.getByRole('button',{name:'Prepare Supplement B for review',exact:true}).click()
  const source=work.getByRole('region',{name:'Official Original signed I-9 page review',exact:true})
  for(let n=1;n<=4;n++){await source.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(source.getByRole('status')).toContainText(`Page ${n} of 4 displayed and review visit saved.`)}
  const supplement=work.getByRole('region',{name:'Official Supplement B to sign page review',exact:true})
  await expect(supplement.getByRole('status')).toContainText('Page 1 of 1 displayed and review visit saved.')
  const copies=work.getByRole('region',{name:'Supplement B document copies',exact:true})
  await copies.getByLabel('Replacement document copy (PDF, PNG or JPEG, up to 5 MB)',{exact:true}).setInputFiles({name:'SENSITIVE-ORIGINAL.pdf',mimeType:'application/pdf',buffer:pdf})
  await copies.getByRole('button',{name:'Retain replacement copy',exact:true}).click()
  await copies.getByRole('checkbox',{name:'Use replacement copy 1',exact:true}).check()
  await copies.getByRole('button',{name:'Review replacement copy 1 (2 pages)',exact:true}).click()
  const copyView=copies.getByRole('region',{name:'Official replacement document copy page review',exact:true})
  for(let n=1;n<=2;n++){await copyView.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(copyView.getByRole('status')).toContainText(`Page ${n} of 2 displayed and review visit saved.`)}
  for(const [label,value] of [['Actual examination date',today],['Examiner initials','RA'],['Examiner identity and authority evidence','Authenticated administrator personally examined these documents.'],['Official reverification rule URL','https://www.uscis.gov/i-9-central'],['Employee-specific reason reverification is required','Synthetic continuing employment authorization requires reverification.'],['Official document-acceptance rule URL','https://www.uscis.gov/i-9-central'],['Document acceptance and future-review evidence','Synthetic renewed employment authorization expires January 2032.'],['Document validity through (if applicable)','2032-01-01'],['Current authorization expiration (unless indefinite)','2032-01-01'],['Next follow-up date (if required)','2032-01-01']])await work.getByLabel(label,{exact:true}).fill(value)
  await work.getByLabel('Document acceptance',{exact:true}).selectOption('STANDARD')
  await work.getByLabel('Is current authorization indefinite?',{exact:true}).selectOption('no')
  await work.getByLabel('Required next follow-up',{exact:true}).selectOption('REVERIFICATION')
  await work.getByLabel('Is no further reverification or document follow-up required?',{exact:true}).selectOption('no')
  const final=['I read and affirm the Supplement B certification.','I am the representative who performed this examination.','I reviewed every source, prior supplement, new supplement and selected copy page.','My identity and authority as the named representative are confirmed.']
  for(const label of ['This employee currently requires reverification and is not exempt.','The employee chose their acceptable List A or C documentation.','I reviewed current authorization and applicable automatic extensions.','The original documents reasonably appear genuine and relate to this employee.','The selected copies include every required side and page.','I examined the originals in the employee’s physical presence.',...final])await work.getByRole('checkbox',{name:label,exact:true}).check()
  await work.getByLabel('Your examiner signature',{exact:true}).fill('Reviewer Alice')
  await work.getByLabel('Document acceptance and future-review evidence',{exact:true}).fill('Rechecked synthetic current document and January 2032 expiration.')
  await expect(work.getByLabel('Your examiner signature',{exact:true})).toHaveValue('')
  for(const label of final){await expect(work.getByRole('checkbox',{name:label,exact:true})).not.toBeChecked();await work.getByRole('checkbox',{name:label,exact:true}).check()}
  await work.getByLabel('Your examiner signature',{exact:true}).fill('Reviewer Alice')
  await page.screenshot({path:'/tmp/payroll-supplement-ui-signing.png'})
  await work.getByRole('button',{name:'Sign and retain Supplement B',exact:true}).click()
  await expect(work.getByRole('alert')).toContainText('Synthetic lost supplement response')
  await work.getByRole('button',{name:'Sign and retain Supplement B',exact:true}).click()
  await expect(records.locator('summary').filter({hasText:'Signed Supplement B'})).toHaveCount(1)
  await records.locator('summary').filter({hasText:'Signed Supplement B'}).click()
  const download=page.waitForEvent('download');await records.getByRole('button',{name:'Download signed Supplement B',exact:true}).click();await(await download).saveAs('/tmp/payroll-supplement-ui-signed.pdf')
  await expect(records).toContainText('2032-01-01')
  expect((await h.pool.query('SELECT * FROM payroll_i9_supplement_signature')).rowCount).toBe(1)
  await page.setViewportSize({width:390,height:844});await records.getByRole('button',{name:'Download signed Supplement B',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/payroll-supplement-ui-mobile-history.png'})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  expect(errors).toEqual([])
 }catch(error){await page.screenshot({path:'/tmp/payroll-supplement-ui-failure.png'}).catch(()=>{});await writeFile('/tmp/payroll-supplement-ui-failure.txt',await page.locator('body').ariaSnapshot()).catch(()=>{});throw error}finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
