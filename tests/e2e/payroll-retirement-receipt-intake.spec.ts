import {checkRetirementReceipts} from '../../backend/payroll/retirementReceiptAutomation.js'
import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {createRetirementSftpServer} from '../../backend/payroll/testing/retirementSftpServer.js'
import {retirementDestinationProvider} from '../../backend/payroll/testing/retirementDestinationProvider.js'
import {retirementReceiptIntakeFixture} from '../../backend/payroll/testing/retirementReceiptIntakeFixture.js'
import {readRetirementSftpReceipt,transferRetirementAllocation,verifyRetirementSftpConnection} from '../../backend/payroll/retirementSftpTransport.js'
test('admin checks retained receipts with exact lost-response retry and regression history',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(90000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const server=await createRetirementSftpServer(),provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>new Date('2026-09-19T15:00:00Z'),retirementNow:()=>new Date('2026-09-11T12:00:00Z'),retirementReceiptReader:(c,location)=>readRetirementSftpReceipt(c,location,server.options),retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options),retirementAllocationTransfer:(c,file,options)=>transferRetirementAllocation(c,file,{...server.options,...options})}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let lost=true
 try{
  const f=await retirementReceiptIntakeFixture(h,server.config)
  server.files.set(f.remotePath,f.receipt())
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(u.pathname.endsWith('/receipts')&&route.request().method()==='POST'&&r.ok()&&lost){lost=false;await route.fulfill({status:503,json:{success:false,message:'Synthetic lost receipt check response'}})}else await route.fulfill({response:r})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click();await page.getByRole('button',{name:'Load allocation delivery history',exact:true}).click()
  const panel=page.getByRole('region',{name:`Retirement receipt outcomes ${f.allocationId}`,exact:true})
  await panel.getByRole('button',{name:'Load receipt outcome history',exact:true}).click();await expect(panel).toContainText('No receipt checks retained.')
  await panel.getByRole('checkbox',{name:'I confirm retrieval from the reviewed receipt location.',exact:true}).check();await panel.getByRole('button',{name:'Check recordkeeper receipt',exact:true}).click();await expect(panel).toContainText('Synthetic lost receipt check response')
  await panel.getByRole('button',{name:'Retry original receipt check',exact:true}).click();await expect(panel).toContainText('Latest retained receipt: POSTED');await expect(panel).toContainText('posted $14.00')
  expect((await f.api(f.receiptPath)).history).toHaveLength(1)
  server.files.set(f.remotePath,f.receipt({status:'Imported',recordedAt:'2026-09-19T14:00:00Z'}))
  await panel.getByRole('checkbox',{name:'I confirm retrieval from the reviewed receipt location.',exact:true}).check();await panel.getByRole('button',{name:'Check recordkeeper receipt',exact:true}).click();await expect(panel).toContainText('Latest retained receipt: REGRESSION');await expect(panel).toContainText('Earlier receipt: POSTED')
  server.files.set(f.remotePath,f.receipt({recordedAt:'2026-09-19T14:30:00Z'}))
  expect((await checkRetirementReceipts(h.pool,1,{reader:(c,r)=>readRetirementSftpReceipt(c,r,server.options),now:new Date(Date.now()+6*60000),receiptNow:()=>new Date('2026-09-19T15:00:00Z')})).posted).toBe(1)
  await expect(panel).toContainText('Latest retained receipt: POSTED',{timeout:40000});await expect(panel).toContainText('Automatic check')
  expect((await f.api(f.receiptPath)).history).toHaveLength(3);await expect(panel).not.toContainText('PRIVATE-PARTICIPANT');await expect(panel).not.toContainText('Synthetic batch 1')
  await page.setViewportSize({width:390,height:1100});await panel.screenshot({path:'/tmp/payroll-retirement-receipt-intake-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(server.state.renames).toBe(1);expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close();await server.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}
})
