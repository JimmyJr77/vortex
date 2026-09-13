import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {receiptFixture} from '../../backend/payroll/testing/receiptFixture.js'
test('admin prepares and reviews different replacement documents',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(90000);page.setDefaultTimeout(15000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='96'.repeat(32)
 const h=await createHarness(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const {pdf}=await receiptFixture(h)
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  let failContext=true,loseUpload=true
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());if(failContext&&u.pathname.includes('/different-documents/')&&u.pathname.endsWith('/context')){failContext=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic context outage.'})});return}const response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`,maxRetries:route.request().method()==='GET'?2:0});if(loseUpload&&route.request().method()==='POST'&&u.pathname.includes('/different-documents/')&&u.pathname.endsWith('/copies')){expect(response.status()).toBe(200);loseUpload=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic upload response lost.'})});return}await route.fulfill({response})})
  await page.setViewportSize({width:1100,height:950})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click();await page.locator('summary').filter({hasText:'Employer I-9 review'}).click()
  const records=page.getByRole('region',{name:'Retained employer I-9 evidence',exact:true});await records.locator('summary').filter({hasText:'Current certification'}).click()
  await records.getByRole('button',{name:'Prepare different replacement documents',exact:true}).click()
  const work=page.getByRole('region',{name:'Different-document replacement workspace',exact:true})
  await expect(work.getByRole('alert')).toContainText('Synthetic context outage.')
  await work.getByRole('button',{name:'Reload replacement context',exact:true}).click()
  await expect(work.getByLabel('Employer business name',{exact:true})).not.toHaveValue('')
  await expect(work.getByLabel('Replacement examiner name and title',{exact:true})).toHaveValue('')
  await work.getByLabel('Replacement document combination',{exact:true}).selectOption('LIST_B_C')
  for(const row of ['B','C'])for(const [label,value] of [['Document title','Synthetic document'],['Issuing authority','Synthetic issuer'],['Document number',`SYNTHETIC-${row}`],['Expiration (if any)','2030-01-01']])await work.getByLabel(`List ${row} document — ${label}`,{exact:true}).fill(value)
  await work.getByLabel('Replacement examination method',{exact:true}).selectOption('PHYSICAL')
  await work.getByLabel('Replacement examiner name and title',{exact:true}).fill('Reviewer Alice, Hiring Administrator')
  await work.getByLabel('Reason for different replacement documents',{exact:true}).fill('Employee selected different acceptable documents after the original receipt.')
  await work.getByLabel('Replacement examiner initials',{exact:true}).fill('RA')
  await work.getByRole('button',{name:'Prepare replacement certification',exact:true}).click()
  for(const [title,count] of [['Review new replacement certification',2],['Review original employer I-9',4],['Review original employee I-9',4]] as const){
   const viewer=work.getByRole('region',{name:`Official ${title} page review`,exact:true})
   for(let n=1;n<=count;n++){
    await viewer.getByRole('button',{name:`Page ${n}`,exact:true}).click()
    await expect(viewer.getByRole('status')).toContainText(`Page ${n} of ${count} displayed and review visit saved.`,{timeout:30000})
   }
  }
  expect((await h.pool.query('SELECT * FROM payroll_i9_different_page_visit')).rowCount).toBe(10)
  for(const row of ['B','C']){
   const copies=work.getByRole('region',{name:`Replacement document ${row} copies`,exact:true})
   await copies.getByLabel('Replacement document copy (PDF, PNG or JPEG, up to 5 MB)',{exact:true}).setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:pdf})
   await copies.getByRole('button',{name:'Retain replacement copy',exact:true}).click()
   if(row==='B'){await expect(copies.getByRole('alert')).toContainText('Synthetic upload response lost.');await copies.getByRole('button',{name:'Retain replacement copy',exact:true}).click()}
   await copies.getByRole('checkbox',{name:'Use replacement copy 1',exact:true}).check()
   await copies.getByRole('button',{name:'Review replacement copy 1 (2 pages)',exact:true}).click()
   const viewer=copies.getByRole('region',{name:`Official replacement document ${row} copy page review`,exact:true})
   for(let n=1;n<=2;n++){await viewer.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(viewer.getByRole('status')).toContainText(`Page ${n} of 2 displayed and review visit saved.`,{timeout:30000})}
  }
  expect((await h.pool.query('SELECT * FROM payroll_i9_different_copy')).rowCount).toBe(2)
  expect((await h.pool.query('SELECT * FROM payroll_i9_different_copy_page')).rowCount).toBe(4)

  await page.screenshot({path:'/tmp/payroll-different-workspace-desktop.png',fullPage:true})
  await page.setViewportSize({width:390,height:844})
  expect(await work.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await work.getByRole('heading',{name:'Different replacement documents',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/payroll-different-workspace-mobile.png'})
  await work.getByLabel('List B document — Document number',{exact:true}).fill('CHANGED')
  await expect(work.getByRole('region',{name:'Official Review new replacement certification page review',exact:true})).toHaveCount(0)
  await expect(work.getByRole('checkbox',{name:'Use replacement copy 1',exact:true})).toHaveCount(0)
  expect(errors).toEqual([])
 }finally{
  await page.unrouteAll({behavior:'wait'}).catch(()=>{});await page.close().catch(()=>{});await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old
 }
})
