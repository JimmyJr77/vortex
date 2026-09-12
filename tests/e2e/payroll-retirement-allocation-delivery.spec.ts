import {recoverRetirementAllocations} from '../../backend/payroll/retirementAllocationRecovery.js'
import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {createRetirementSftpServer} from '../../backend/payroll/testing/retirementSftpServer.js'
import {retirementDestinationProvider} from '../../backend/payroll/testing/retirementDestinationProvider.js'
import {retirementAllocationDeliveryFixture} from '../../backend/payroll/testing/retirementAllocationDeliveryFixture.js'
import {transferRetirementAllocation,verifyRetirementSftpConnection} from '../../backend/payroll/retirementSftpTransport.js'
test('admin authorizes an allocation, recovers lost upload and retains contribution reservation after a consumed file',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(90000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const server=await createRetirementSftpServer(),provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher,retirementNow:()=>new Date('2026-09-11T12:00:00Z'),remittanceNow:()=>new Date('2026-09-19T12:00:00Z'),retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options),retirementAllocationTransfer:(c,file,options)=>transferRetirementAllocation(c,file,{...server.options,...options})}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const f=await retirementAllocationDeliveryFixture(h,server.config);let loseAuthorization=true
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(u.pathname===`/api/admin/payroll${f.deliveryPath}`&&route.request().method()==='POST'&&r.ok()&&loseAuthorization){loseAuthorization=false;await route.fulfill({status:503,json:{success:false,message:'Synthetic lost file authorization response'}})}else await route.fulfill({response:r})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const panel=page.getByRole('region',{name:`Allocation file delivery ${f.remittanceId}`,exact:true});await panel.getByRole('button',{name:'Load allocation delivery history',exact:true}).click();await expect(panel).toContainText('Delivery setup: VERIFIED')
  await panel.getByRole('textbox',{name:'Allocation filename and delivery authorization reference',exact:true}).fill(f.deliveryBody.reference)
  await panel.getByRole('checkbox',{name:'I verified no external allocation file or duplicate instruction exists for these exact deductions.',exact:true}).check();await panel.getByRole('checkbox',{name:'I authorize the retained allocation bytes, reviewed filename and displayed SFTP destination.',exact:true}).check()
  await panel.getByRole('button',{name:'Authorize allocation file delivery',exact:true}).click();await expect(panel.getByRole('alert')).toHaveText('Synthetic lost file authorization response');await panel.getByRole('button',{name:'Retry original allocation authorization',exact:true}).click();await expect(panel).toContainText('AUTHORIZED NOT SENT')
  expect((await f.api(f.deliveryPath)).history).toHaveLength(1)
  await panel.getByRole('textbox',{name:'Allocation delivery action reference',exact:true}).fill('Renewed exact file and destination verification without outside duplicate submissions')
  await panel.getByRole('checkbox',{name:'I rechecked that no external or duplicate allocation submission is pending for these deductions.',exact:true}).check();await panel.getByRole('checkbox',{name:'I confirm the displayed allocation file action and reviewed evidence.',exact:true}).check()
  server.state.loseRename=true;await panel.getByRole('button',{name:'Submit authorized allocation file',exact:true}).click();await expect(panel).toContainText('File outcome: TRANSPORT UNCERTAIN');expect(server.state.created).toBe(1)
  expect((await recoverRetirementAllocations(h.pool,1,{now:new Date(Date.now()+6*60000),transfer:(c,file,options)=>transferRetirementAllocation(c,file,{...server.options,...options})})).remoteVerified).toBe(1);await expect(panel).toContainText('File outcome: REMOTE FILE VERIFIED',{timeout:40000});await expect(panel).toContainText('Automatic check');await expect(panel).toContainText('Review receipt outcomes to establish provider acceptance and participant posting.');expect(server.state.created).toBe(1)
  await expect(page.getByRole('button',{name:'Cancel remittance authorization',exact:true})).toHaveCount(0)
  await page.setViewportSize({width:390,height:1100});await panel.screenshot({path:'/tmp/payroll-retirement-allocation-delivery-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  server.files.clear();await panel.getByRole('button',{name:'Recover allocation file delivery',exact:true}).click();await expect(panel).toContainText('File outcome: REMOTE FILE NOT FOUND');await expect(panel).toContainText('A missing file may already have been consumed');expect(server.state.created).toBe(1);expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close();await server.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}
})
