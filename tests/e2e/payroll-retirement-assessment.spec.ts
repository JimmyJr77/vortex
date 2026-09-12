import {checkRetirementReceipts} from '../../backend/payroll/retirementReceiptAutomation.js'
import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {createRetirementSftpServer} from '../../backend/payroll/testing/retirementSftpServer.js'
import {retirementBankProvider} from '../../backend/payroll/testing/retirementBankProvider.js'
import {retirementReceiptIntakeFixture} from '../../backend/payroll/testing/retirementReceiptIntakeFixture.js'
import {readRetirementSftpReceipt,transferRetirementAllocation,verifyRetirementSftpConnection} from '../../backend/payroll/retirementSftpTransport.js'
test('admin compares bank and participant evidence and sees reconciliation reopen after a return',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(90000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const server=await createRetirementSftpServer(),provider=retirementBankProvider(),h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>new Date('2026-09-19T15:00:00Z'),retirementNow:()=>new Date('2026-09-11T12:00:00Z'),retirementReceiptReader:(c,location)=>readRetirementSftpReceipt(c,location,server.options),retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options),retirementAllocationTransfer:(c,file,options)=>transferRetirementAllocation(c,file,{...server.options,...options})}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const f=await retirementReceiptIntakeFixture(h,server.config)
  server.files.set(f.remotePath,f.receipt())
  const bankPath=`/retirement-remittance-authorizations/${f.remittanceId}/dispatch`
  await f.api(bankPath,{action:'SUBMIT',confirmed:true,bankInstructionsReviewed:true,outsideActivityReviewed:true,reference:'Independent trustee credit and separate allocation instructions reviewed'})
  provider.complete();await f.api(bankPath,{action:'RECOVER',confirmed:true})
  await checkRetirementReceipts(h.pool,1,{reader:(c,r)=>readRetirementSftpReceipt(c,r,server.options),receiptNow:()=>new Date('2026-09-19T15:00:00Z')})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});await route.fulfill({response:r})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const panel=page.getByRole('region',{name:`Contribution reconciliation ${f.remittanceId}`,exact:true})
  await panel.getByRole('button',{name:'Review contribution reconciliation',exact:true}).click();await expect(panel).toContainText('Assessment: DELIVERY EVIDENCE MATCHED');await expect(panel).toContainText('Settlement accounting: REQUIRED')
  provider.returned();await f.api(bankPath,{action:'RECOVER',confirmed:true});await expect(panel).toContainText('Assessment: REVIEW REQUIRED',{timeout:40000});await expect(panel).toContainText('Bank: UNVERIFIED');await expect(panel).toContainText('Participants: POSTED')
  await page.setViewportSize({width:390,height:1100});await panel.screenshot({path:'/tmp/payroll-retirement-assessment-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(provider.posts()).toBe(1);expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close();await server.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}
})
