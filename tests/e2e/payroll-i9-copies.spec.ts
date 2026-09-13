import {test,expect as baseExpect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {employerI9ReviewFixture,syntheticI9CopyPdf} from '../../backend/payroll/testing/employerI9ReviewFixture.js'
const expect=baseExpect.configure({timeout:20000})
test('admin retains PDF and image copies internally, retries uploads and reuses unchanged document evidence',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='98'.repeat(32)
 const h=await createHarness(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const {employee}=await employerI9ReviewFixture(h),pdf=await syntheticI9CopyPdf()
  await page.setViewportSize({width:390,height:950})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  let lose=true
  await page.route('**/api/admin/payroll/**',async route=>{
   const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`,maxRetries:route.request().method()==='GET'?2:0})
   if(lose&&u.pathname.endsWith('/i9/employer-copies')&&route.request().method()==='POST'){expect(response.status()).toBe(200);lose=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic lost copy upload response. Retry unchanged.'})});return}
   await route.fulfill({response})
  })
  const open=async()=>{await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click();await page.locator('summary').filter({hasText:'Employer I-9 review'}).click();await page.getByRole('button',{name:'Prepare employer I-9 preview',exact:true}).click()}
  await open();const copies=page.getByRole('region',{name:'I-9 document copies',exact:true}),file=copies.getByLabel('List A document 1: copy file (PDF, PNG or JPEG, up to 5 MB)',{exact:true}),retain=copies.getByRole('button',{name:'Retain list a document 1 copy',exact:true})
  await file.setInputFiles({name:'SENSITIVE-ORIGINAL-NAME.pdf',mimeType:'application/pdf',buffer:pdf})
  await retain.click();await expect(copies.getByRole('alert')).toContainText('Synthetic lost copy upload response')
  await retain.click();await expect(copies.getByRole('status')).toContainText('Document copy retained securely')
  expect((await h.pool.query('SELECT count(*)::int AS n FROM payroll_i9_document_copy')).rows[0].n).toBe(1)
  await copies.getByRole('button',{name:'View list a document 1 copy 1',exact:true}).click()
  const viewer=copies.getByRole('region',{name:'Official I-9 document copy page review',exact:true})
  for(let n=1;n<=2;n++){await viewer.getByRole('button',{name:`Page ${n}`,exact:true}).click();await expect(viewer.getByRole('status')).toContainText(`Page ${n} of 2 displayed and review visit saved.`)}
  await viewer.locator('summary').click();await expect(viewer).toContainText('SYNTHETIC ID BACK')
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=300;const context=c.getContext('2d')!;context.fillStyle='#dbeafe';context.fillRect(0,0,600,300);context.fillStyle='#111827';context.font='32px sans-serif';context.fillText('SYNTHETIC ID IMAGE',35,150);return c.toDataURL('image/png').split(',')[1]})
  await file.setInputFiles({name:'SENSITIVE-IMAGE.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await retain.click()
  await copies.getByRole('button',{name:'View list a document 1 copy 2',exact:true}).click()
  await expect(copies.getByRole('status').filter({hasText:'Image displayed'})).toContainText('review visit saved')
  await copies.getByRole('combobox',{name:'Image zoom',exact:true}).selectOption('3')
  const image=copies.getByRole('region',{name:'Document image; scroll horizontally when zoomed',exact:true})
  expect(await image.evaluate(el=>el.scrollWidth>el.clientWidth)).toBe(true)
  await copies.getByRole('combobox',{name:'Image zoom',exact:true}).selectOption('1')
  expect(await copies.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await copies.screenshot({path:'/tmp/payroll-i9-copies-mobile.png'})
  expect((await h.pool.query('SELECT count(*)::int AS n FROM payroll_i9_copy_page_visit')).rows[0].n).toBe(3)
  const storage=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));expect(storage).not.toContain('SENSITIVE');expect(storage).not.toContain(png)
  await open();await expect(copies.getByRole('button',{name:'View list a document 1 copy 2',exact:true})).toBeVisible()
  await expect(page.getByRole('region',{name:'Official I-9 employer preview page review',exact:true}).getByRole('status')).toContainText('Page 1 of 4 displayed and review visit saved.')
  expect((await h.pool.query('SELECT count(*)::int AS n FROM payroll_i9_document_copy')).rows[0].n).toBe(2)
  expect((await h.pool.query("SELECT status FROM payroll_onboarding_task WHERE employee_id=$1 AND task_key='I9_REVIEW'",[employee.id])).rows[0].status).toBe('OPEN')
  expect(errors).toEqual([])
 }finally{try{await page.goto('about:blank');await page.unrouteAll({behavior:'wait'})}finally{try{await h.close()}finally{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}}
})
