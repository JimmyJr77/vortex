import {test,expect as baseExpect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {signedI9Fixture} from '../../backend/payroll/testing/signedI9Fixture.js'
const expect=baseExpect.configure({timeout:20000})
test('admin invites a preparer, recipient signs privately, admin completes assisted Section 1',async({page,context})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(180000);page.setDefaultTimeout(15000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='93'.repeat(32)
 const h=await createHarness(),guest=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));guest.on('pageerror',e=>errors.push(e.message))
 try{
  const {employee,task}=await signedI9Fixture(h);let loseInvitation=true,loseSignature=true
  await page.setViewportSize({width:390,height:950});await guest.setViewportSize({width:390,height:950})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`,maxRetries:route.request().method()==='GET'?2:0});if(loseInvitation&&u.pathname.endsWith('/i9/preparers')&&route.request().method()==='POST'){expect(response.status()).toBe(200);loseInvitation=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic lost preparer invitation response.'})});return}await route.fulfill({response})})
  const openAdmin=async()=>{await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click();await page.locator('summary').filter({hasText:'Form I-9 employee section'}).click()}
  await openAdmin();const roster=page.getByRole('region',{name:'I-9 preparer roster',exact:true})
  await roster.getByLabel('Intended preparer name (first, optional middle initial, last)',{exact:true}).fill('Alice Translator')
  await roster.getByLabel('Preparer email',{exact:true}).fill('alice@example.test')
  await roster.getByLabel('Preparer identity and contact verification evidence',{exact:true}).fill('Synthetic assistant identity and private contact verified.')
  await roster.getByRole('checkbox',{name:'I verified this intended recipient',exact:false}).check()
  const invite=roster.getByRole('button',{name:'Create private preparer invitation',exact:true});await invite.click();await expect(roster.getByRole('alert')).toContainText('Synthetic lost preparer invitation response');await invite.click()
  const link=roster.getByRole('textbox',{name:'Private preparer link',exact:false});await expect(link).toBeVisible();const access=new URL(await link.inputValue()).hash
  expect((await h.pool.query('SELECT * FROM payroll_i9_preparer_request WHERE employee_id=$1',[employee.id])).rowCount).toBe(1)
  await guest.route('**/api/payroll/preparer/**',async route=>{const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`,maxRetries:route.request().method()==='GET'?2:0});if(loseSignature&&u.pathname.endsWith('/sign')){expect(response.status()).toBe(200);loseSignature=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,message:'Synthetic lost preparer signature response.'})});return}await route.fulfill({response})})
  await guest.goto(`/employee/payroll/preparer${access}`)
  await expect(guest.getByRole('heading',{name:'I-9 preparer / translator certification',exact:true})).toBeVisible();await expect(guest.getByText('This invitation is for Alice Translator', {exact:false})).toBeVisible();expect(guest.url()).not.toContain('#access=')
  for(const [label,value] of [['Preparer first name','Alice'],['Preparer last name','Translator'],['Preparer street address','20 Example Road'],['Preparer city or town','Bowie'],['Preparer state','MD'],['Preparer ZIP code','20715']])await guest.getByLabel(label,{exact:true}).fill(value)
  await guest.getByRole('button',{name:'Prepare my Supplement A',exact:true}).click();await expect(guest.getByRole('status')).toContainText('Page 1 of 1 displayed and review visit saved.')
  const sign=guest.getByRole('button',{name:'Sign my Supplement A',exact:true});await expect(sign).toBeDisabled()
  await guest.getByRole('checkbox',{name:'I am the intended preparer',exact:false}).check();await guest.getByLabel('Preparer electronic signature',{exact:true}).fill('Alice Translator')
  await sign.click();await expect(guest.getByRole('alert')).toContainText('Synthetic lost preparer signature response');await sign.click();await expect(guest.getByRole('status')).toContainText('Your Supplement A was signed')
  expect((await h.pool.query('SELECT * FROM payroll_i9_preparer_signature')).rowCount).toBe(1)
  const download=guest.waitForEvent('download');await guest.getByRole('button',{name:'Download my signed Supplement A',exact:true}).click();expect((await download).suggestedFilename()).toBe('Form-I9-Supplement-A-signed.pdf')
  await guest.reload();await expect(guest.getByRole('status')).toContainText('Your Supplement A was signed')
  const storage=await guest.evaluate(()=>JSON.stringify({...sessionStorage,...localStorage}));expect(storage).not.toContain('123456789');expect(storage).not.toContain('20 Example Road')
  await guest.screenshot({path:'/tmp/payroll-i9-preparer-receipt-mobile.png'})
  await openAdmin();await expect(roster).toContainText('Signed')
  const step=page.locator('details').filter({has:roster});await step.getByLabel('Review evidence / instructions',{exact:true}).fill('Reviewed all synthetic preparers and retained Supplement A.')
  const complete=step.getByRole('button',{name:'Verify & complete',exact:true});await expect(complete).toBeDisabled()
  await roster.getByRole('checkbox',{name:'I confirmed this list includes every preparer',exact:false}).check();await complete.click()
  await expect(page.getByRole('status').filter({hasText:'Step reviewed and completed.'})).toBeVisible()
  expect((await h.pool.query('SELECT status FROM payroll_onboarding_task WHERE id=$1',[task.id])).rows[0].status).toBe('COMPLETE')
  expect(errors).toEqual([])
 }finally{try{await page.unrouteAll({behavior:'ignoreErrors'});await guest.unrouteAll({behavior:'ignoreErrors'});await page.close();await guest.close()}finally{try{await h.close()}finally{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}}
})
