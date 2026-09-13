import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {receiptFixture} from '../../backend/payroll/testing/receiptFixture.js'
test('admin completes an actual receipt replacement and recovers a lost signing response',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(180000);page.setDefaultTimeout(15000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='96'.repeat(32)
 const h=await createHarness(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const {pdf}=await receiptFixture(h)
  await page.setViewportSize({width:1100,height:950});await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  let lose=true
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`,maxRetries:route.request().method()==='GET'?2:0});if(lose&&u.pathname.includes('/i9/receipt/')&&u.pathname.endsWith('/sign')){expect(response.status()).toBe(200);lose=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic lost receipt response. Retry unchanged.'})});return}await route.fulfill({response})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click();await page.locator('summary').filter({hasText:'Employer I-9 review'}).click()
  const records=page.getByRole('region',{name:'Retained employer I-9 evidence',exact:true});await records.locator('summary').filter({hasText:'Current certification'}).click()
  await records.getByRole('button',{name:'Replace receipt with actual document',exact:true}).click()
  const work=page.getByRole('region',{name:'Receipt replacement workspace',exact:true})
  for(const [label,value] of [['Actual replacement document title','U.S. Passport'],['Replacement issuing authority','U.S. Department of State'],['Replacement document number','SYNTHETIC-ACTUAL'],['Replacement expiration (if any)','2036-01-01'],['Receipt examiner full name','Reviewer Alice'],['Receipt examiner initials','RA'],['Amendment explanation','The actual passport replaces the retained lost-document receipt.\nOriginal retained notes remain available.']])await work.getByLabel(label,{exact:true}).fill(value)
  await work.getByRole('button',{name:'Prepare receipt amendment',exact:true}).click()
  for(const [name,count] of [['Review source receipt form',4],['Review receipt amendment',5]] as const){const viewer=work.getByRole('region',{name:`Official ${name} page review`,exact:true});for(let n=1;n<=count;n++){await viewer.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(viewer.getByRole('status')).toContainText(`Page ${n} of ${count} displayed and review visit saved.`)}}
  const copies=work.getByRole('region',{name:'Receipt replacement document copies',exact:true})
  await copies.getByLabel('Replacement document copy (PDF, PNG or JPEG, up to 5 MB)',{exact:true}).setInputFiles({name:'synthetic-copy.pdf',mimeType:'application/pdf',buffer:pdf})
  await copies.getByRole('button',{name:'Retain replacement copy',exact:true}).click();await copies.getByRole('checkbox',{name:'Use replacement copy 1',exact:true}).check();await copies.getByRole('button',{name:'Review replacement copy 1 (2 pages)',exact:true}).click()
  const copyView=copies.getByRole('region',{name:'Official replacement document copy page review',exact:true});for(let n=1;n<=2;n++){await copyView.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(copyView.getByRole('status')).toContainText(`Page ${n} of 2 displayed and review visit saved.`)}
  for(const [label,value] of [['Examiner identity and authority','Authenticated examiner reviewed the actual replacement passport.'],['How the actual document matches this receipt','The original passport matches the previously retained receipt.'],['Official receipt acceptance rule URL','https://www.uscis.gov/i-9-central'],['Document acceptance and future-review evidence','Unexpired original passport matches the retained receipt.'],['Verified document validity through (if any)','2036-01-01']])await work.getByLabel(label,{exact:true}).fill(value)
  for(const [label,value] of [['Replacement examination method','PHYSICAL'],['Original examined in employee’s physical presence','yes'],['Replacement document acceptance','STANDARD'],['Employment authorization has no expiration','yes'],['This document requires reverification','no'],['Next receipt follow-up action','NONE'],['No further follow-up is required','yes']])await work.getByLabel(label,{exact:true}).selectOption(value)
  const checks=['This is the actual replacement for the identified receipt','The originals reasonably appear genuine and relate to this employee','The selected copies include every required side and page','I read and agree to the receipt certification','I am the examiner who performed this review','I reviewed every source, amendment and selected copy page','My identity and authority as the named examiner are confirmed']
  for(const label of checks)await work.getByRole('checkbox',{name:label,exact:true}).check()
  await work.getByLabel('Receipt examiner electronic signature',{exact:true}).fill('Reviewer Alice')
  await work.getByLabel('Examiner identity and authority',{exact:true}).fill('Authenticated named examiner reviewed the actual replacement passport.\nEmployee was present.')
  await expect(work.getByLabel('Receipt examiner electronic signature',{exact:true})).toHaveValue('')
  for(const label of checks)await expect(work.getByRole('checkbox',{name:label,exact:true})).not.toBeChecked()
  for(const label of checks)await work.getByRole('checkbox',{name:label,exact:true}).check()
  await work.getByLabel('Receipt examiner electronic signature',{exact:true}).fill('Reviewer Alice')
  await work.getByRole('button',{name:'Sign receipt amendment',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/payroll-receipt-ui-signing.png'})
  await work.getByRole('button',{name:'Sign receipt amendment',exact:true}).click();await expect(work.getByRole('alert')).toContainText('Synthetic lost receipt response')
  await work.getByRole('button',{name:'Sign receipt amendment',exact:true}).click()
  await records.locator('summary').filter({hasText:'Signed receipt amendment'}).click()
  await expect(records.getByRole('button',{name:'Download signed receipt amendment',exact:true})).toBeVisible()
  const download=page.waitForEvent('download');await records.getByRole('button',{name:'Download signed receipt amendment',exact:true}).click();await (await download).saveAs('/tmp/payroll-receipt-ui-signed.pdf')
  expect((await h.pool.query('SELECT * FROM payroll_i9_receipt_signature')).rowCount).toBe(1)
  await page.setViewportSize({width:390,height:844});await records.getByRole('button',{name:'Download signed receipt amendment',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/payroll-receipt-ui-mobile.png'})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(errors).toEqual([])
 }catch(error){await page.screenshot({path:'/tmp/payroll-receipt-ui-failure.png'}).catch(()=>{});throw error}
 finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
