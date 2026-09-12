import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {createRetirementSftpServer} from '../../backend/payroll/testing/retirementSftpServer.js'
import {retirementDestinationProvider} from '../../backend/payroll/testing/retirementDestinationProvider.js'
import {retirementAllocationDeliveryFixture} from '../../backend/payroll/testing/retirementAllocationDeliveryFixture.js'
import {transferRetirementAllocation,verifyRetirementSftpConnection} from '../../backend/payroll/retirementSftpTransport.js'
test('admin releases a proven unsent file after lost response and submits a newly reviewed filename',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(90000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const server=await createRetirementSftpServer(),provider=retirementDestinationProvider();let block=true,lost=true
 const h=await createHarness({paymentFetcher:provider.fetcher,retirementNow:()=>new Date('2026-09-11T12:00:00Z'),remittanceNow:()=>new Date('2026-09-19T12:00:00Z'),retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options),retirementAllocationTransfer:(c,file,options)=>transferRetirementAllocation(c,file,{...server.options,...options,...(block&&options.mode==='SUBMIT'?{beforeWrite:async()=>false}:{})})}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const f=await retirementAllocationDeliveryFixture(h,server.config),a=await f.api(f.deliveryPath,f.deliveryBody)
  await f.api(`${f.deliveryPath}/${a.id}/dispatch`,{action:'SUBMIT',confirmed:true,outsideActivityReviewed:true,reference:'Retained initial exact file review before a prevented remote write'})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(u.pathname.endsWith('/release-unsent')&&route.request().method()==='POST'&&r.ok()&&lost){lost=false;await route.fulfill({status:503,json:{success:false,message:'Synthetic lost non-send release response'}})}else await route.fulfill({response:r})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const panel=page.getByRole('region',{name:`Allocation file delivery ${f.remittanceId}`,exact:true});await panel.getByRole('button',{name:'Load allocation delivery history',exact:true}).click();await expect(panel).toContainText('CLAIM NOT CONFIRMED')
  const release=panel.getByRole('region',{name:'Unsent allocation release',exact:true});await release.getByRole('button',{name:'Preview unsent allocation release',exact:true}).click();await expect(release).toContainText('Eligible for reviewed release')
  await release.getByRole('textbox',{name:'Unsent allocation release reference',exact:true}).fill('Independent absence and outside activity review before releasing the original unsent file')
  await release.getByRole('checkbox',{name:'I independently verified no outside allocation delivery or pending duplicate instruction exists.',exact:true}).check();await release.getByRole('checkbox',{name:'I confirm release of this verified unsent allocation authorization.',exact:true}).check()
  await page.setViewportSize({width:390,height:1100});await release.screenshot({path:'/tmp/payroll-retirement-allocation-unsent-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await release.getByRole('button',{name:'Release verified unsent allocation',exact:true}).click();await expect(release).toContainText('Synthetic lost non-send release response');await release.getByRole('button',{name:'Retry original unsent allocation release',exact:true}).click();await expect(panel).toContainText('Verified unsent release')
  expect((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_allocation_unsent_release')).rows[0].n).toBe(1);expect(server.state.created).toBe(0)
  await panel.getByRole('textbox',{name:'Recordkeeper allocation filename',exact:true}).fill('replacement_'+a.id+'.csv')
  await panel.getByRole('textbox',{name:'Allocation filename and delivery authorization reference',exact:true}).fill('Reviewed unique replacement filename after proven unsent original release')
  await panel.getByRole('checkbox',{name:'I verified no external allocation file or duplicate instruction exists for these exact deductions.',exact:true}).check();await panel.getByRole('checkbox',{name:'I authorize the retained allocation bytes, reviewed filename and displayed SFTP destination.',exact:true}).check();await panel.getByRole('button',{name:'Authorize allocation file delivery',exact:true}).click();await expect(panel).toContainText('AUTHORIZED NOT SENT')
  await panel.getByRole('textbox',{name:'Allocation delivery action reference',exact:true}).fill('Renewed reviewed destination and no external duplicate submission before replacement')
  await panel.getByRole('checkbox',{name:'I rechecked that no external or duplicate allocation submission is pending for these deductions.',exact:true}).check();await panel.getByRole('checkbox',{name:'I confirm the displayed allocation file action and reviewed evidence.',exact:true}).check();block=false
  await panel.getByRole('button',{name:'Submit authorized allocation file',exact:true}).click();await expect(panel).toContainText('REMOTE FILE VERIFIED');expect(server.state.created).toBe(1);expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close();await server.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}
})
