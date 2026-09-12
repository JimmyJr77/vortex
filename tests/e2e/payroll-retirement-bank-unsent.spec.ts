import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {retirementBankProvider} from '../../backend/payroll/testing/retirementBankProvider.js'
import {retirementRemittanceAuthorizationFixture} from '../../backend/payroll/testing/retirementRemittanceAuthorizationFixture.js'
test('admin releases a proven unsent bank instruction after lost response and authorizes a replacement',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(90000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');let clock=new Date('2026-09-19T12:00:00Z'),blocked=false,lost=true
 const provider=retirementBankProvider(),fetcher=async(url,options)=>{if(blocked&&url.includes('/payment_orders/'))clock=new Date('2026-09-21T18:00:00Z');return provider.fetcher(url,options)}
 const h=await createHarness({paymentFetcher:fetcher,remittanceNow:()=>clock,retirementNow:()=>new Date('2026-09-11T12:00:00Z')}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const f=await retirementRemittanceAuthorizationFixture(h),a=await f.api(f.path,f.body);blocked=true
  await f.api(`/retirement-remittance-authorizations/${a.id}/dispatch`,{action:'SUBMIT',confirmed:true,bankInstructionsReviewed:true,outsideActivityReviewed:true,reference:'Reviewed initial bank instruction before retained pre-send cutoff failure'});blocked=false;clock=new Date('2026-09-19T12:00:00Z')
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(u.pathname.endsWith('/release-unsent')&&r.ok()&&lost){lost=false;await route.fulfill({status:503,json:{success:false,message:'Synthetic lost bank release response'}})}else await route.fulfill({response:r})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const authorization=page.getByRole('region',{name:`Retirement remittance authorization ${f.run.id} standard`,exact:true}),release=page.getByRole('region',{name:'Unsent bank release',exact:true})
  await release.getByRole('button',{name:'Preview unsent bank release',exact:true}).click();await expect(release).toContainText('Eligible for reviewed release')
  await release.getByRole('textbox',{name:'Unsent bank release reference',exact:true}).fill('Independent outside contribution review and verified original bank instruction absence')
  await release.getByRole('checkbox',{name:'I independently verified no outside contribution payment, allocation delivery or pending duplicate instruction exists.',exact:true}).check();await release.getByRole('checkbox',{name:'I confirm release of this verified unsent bank instruction and contribution reservation.',exact:true}).check()
  await page.setViewportSize({width:390,height:1100});await release.screenshot({path:'/tmp/payroll-retirement-bank-unsent-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await release.getByRole('button',{name:'Release verified unsent bank',exact:true}).click();await expect(release).toContainText('Synthetic lost bank release response');await release.getByRole('button',{name:'Retry original unsent bank release',exact:true}).click();await expect(authorization).toContainText('Verified unsent bank release');expect(provider.posts()).toBe(0)
  await page.getByRole('region',{name:`Recordkeeper allocation file ${f.run.id} standard`,exact:true}).getByRole('button',{name:'Prepare allocation file for standard',exact:true}).click()
  await authorization.getByRole('textbox',{name:'Outside activity and authorization review reference',exact:true}).fill('Renewed exact contribution review after confirmed original unsent bank release')
  await authorization.getByRole('checkbox',{name:'I verified that these exact payroll deductions have no outside contributions, pending funds instructions or duplicate allocation submissions, including any downloaded files.',exact:true}).check();await authorization.getByRole('checkbox',{name:'I authorize this exact contribution amount, destination, allocation file and reviewed timing.',exact:true}).check();await authorization.getByRole('button',{name:'Authorize contribution remittance',exact:true}).click();await expect(authorization).toContainText('RESERVED NOT SENT')
  const next=(await f.api(f.path)).history.find(row=>!row.cancelled_at),bank=page.getByRole('region',{name:`Retirement bank payment ${next.id}`,exact:true})
  await bank.getByRole('textbox',{name:'Trustee bank-credit and allocation workflow reference',exact:true}).fill('Renewed trustee bank credit and independent allocation instructions without an extra debit')
  await bank.getByRole('checkbox').nth(0).check();await bank.getByRole('checkbox').nth(1).check();await bank.getByRole('button',{name:'Submit authorized retirement bank payment',exact:true}).click();await expect(bank).toContainText('Provider status: SENT');expect(provider.posts()).toBe(1);expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}
})
