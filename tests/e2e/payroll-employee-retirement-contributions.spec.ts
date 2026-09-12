import {checkRetirementReceipts} from '../../backend/payroll/retirementReceiptAutomation.js'
import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {createRetirementSftpServer} from '../../backend/payroll/testing/retirementSftpServer.js'
import {retirementDestinationProvider} from '../../backend/payroll/testing/retirementDestinationProvider.js'
import {retirementReceiptIntakeFixture} from '../../backend/payroll/testing/retirementReceiptIntakeFixture.js'
import {readRetirementSftpReceipt,transferRetirementAllocation,verifyRetirementSftpConnection} from '../../backend/payroll/retirementSftpTransport.js'
test('employee sees own retirement posting and automatic review status after missing receipt',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(90000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const server=await createRetirementSftpServer(),provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>new Date('2026-09-19T15:00:00Z'),retirementNow:()=>new Date('2026-09-11T12:00:00Z'),retirementReceiptReader:(c,location)=>readRetirementSftpReceipt(c,location,server.options),retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options),retirementAllocationTransfer:(c,file,options)=>transferRetirementAllocation(c,file,{...server.options,...options})}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const f=await retirementReceiptIntakeFixture(h,server.config)
  server.files.set(f.remotePath,f.receipt())
  const check=()=>checkRetirementReceipts(h.pool,1,{reader:(c,r)=>readRetirementSftpReceipt(c,r,server.options),now:new Date(Date.now()+25*3600000),receiptNow:()=>new Date('2026-09-19T15:00:00Z')})
  await check()
  await page.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','monthly-benefits-session'))
  await page.route('**/api/payroll/employee/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});await route.fulfill({response:r})})
  await page.goto('/tests/support/payroll.html?employee=1');await page.getByRole('button',{name:'Pay statements',exact:true}).click()
  const panel=page.getByRole('region',{name:'My retirement contributions',exact:true})
  await expect(panel).toContainText('Deducted $14.00');await expect(panel).toContainText('Receipt status: POSTED');await expect(panel).toContainText('Provider-reported posted amount: $14.00')
  server.files.delete(f.remotePath);await check();await expect(panel).toContainText('Receipt status: REVIEW REQUIRED',{timeout:40000});await expect(panel).not.toContainText('Provider-reported posted amount: $14.00');await expect(panel).not.toContainText('PRIVATE-PARTICIPANT');await expect(panel).not.toContainText('Synthetic batch 1')
  await page.setViewportSize({width:390,height:1100});await panel.screenshot({path:'/tmp/payroll-employee-retirement-contributions-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close();await server.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}
})
