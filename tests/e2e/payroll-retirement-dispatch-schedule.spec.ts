import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {createRetirementSftpServer} from '../../backend/payroll/testing/retirementSftpServer.js'
import {retirementBankProvider} from '../../backend/payroll/testing/retirementBankProvider.js'
import {retirementAllocationDeliveryFixture} from '../../backend/payroll/testing/retirementAllocationDeliveryFixture.js'
import {transferRetirementAllocation,verifyRetirementSftpConnection} from '../../backend/payroll/retirementSftpTransport.js'
import {runRetirementScheduledDispatches} from '../../backend/payroll/retirementDispatchSchedule.js'
test('admin schedules bank and allocation dispatch, recovers lost save, cancels and renews before automatic submission',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(90000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const server=await createRetirementSftpServer(),provider=retirementBankProvider();let clock=new Date('2026-09-19T12:00:00Z')
 const now=()=>clock,transfer=(c,file,options)=>transferRetirementAllocation(c,file,{...server.options,...options})
 const h=await createHarness({paymentFetcher:provider.fetcher,retirementNow:()=>new Date('2026-09-11T12:00:00Z'),remittanceNow:now,retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options),retirementAllocationTransfer:transfer}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const f=await retirementAllocationDeliveryFixture(h,server.config),allocation=await f.api(f.deliveryPath,f.deliveryBody);let lost=true
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(u.pathname.includes('/retirement-dispatch-schedules/')&&route.request().method()==='POST'&&r.ok()&&lost){lost=false;await route.fulfill({status:503,json:{success:false,message:'Synthetic lost schedule response'}})}else await route.fulfill({response:r})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click();await page.getByRole('button',{name:'Load allocation delivery history',exact:true}).click()
  const time=await page.evaluate(()=>{const d=new Date('2026-09-19T13:00:00Z');return new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,16)})
  for(const [label,id] of [['bank payment',f.remittanceId],['allocation file',allocation.id]]){
   const panel=page.getByRole('region',{name:`Retirement ${label} schedule ${id}`,exact:true});await panel.getByRole('button',{name:`Load ${label} schedule`,exact:true}).click()
   await panel.getByLabel(`Scheduled ${label} submission time`,{exact:true}).fill(time)
   await panel.getByRole('textbox',{name:`${label} schedule review reference`,exact:true}).fill('Reviewed current destination and instructions with no outside or duplicate submission')
   await panel.getByRole('checkbox',{name:'I reviewed that no outside or duplicate instruction exists and will cancel this schedule before arranging another submission.',exact:true}).check()
   if(label==='bank payment')await panel.getByRole('checkbox',{name:'I verified the trustee accepts ACH CCD without additional addenda and separate allocation delivery will not trigger another debit.',exact:true}).check()
   await panel.getByRole('checkbox',{name:`I confirm this ${label} schedule action and retained review.`,exact:true}).check();await panel.getByRole('button',{name:`Schedule ${label} submission`,exact:true}).click()
   if(label==='bank payment'){await expect(panel).toContainText('Synthetic lost schedule response');await panel.getByRole('button',{name:`Retry original ${label} schedule action`,exact:true}).click()}
   await expect(panel).toContainText('SCHEDULED')
   if(label==='allocation file'){
    await panel.getByRole('textbox',{name:`${label} schedule review reference`,exact:true}).fill('Cancel the existing schedule before renewing its reviewed submission time')
    await panel.getByRole('checkbox',{name:`I confirm this ${label} schedule action and retained review.`,exact:true}).check();await panel.getByRole('button',{name:`Cancel ${label} schedule`,exact:true}).click();await expect(panel).toContainText('CANCELLED')
    await panel.getByLabel(`Scheduled ${label} submission time`,{exact:true}).fill(time)
    await panel.getByRole('checkbox',{name:'I reviewed that no outside or duplicate instruction exists and will cancel this schedule before arranging another submission.',exact:true}).check();await panel.getByRole('checkbox',{name:`I confirm this ${label} schedule action and retained review.`,exact:true}).check();await panel.getByRole('button',{name:`Schedule ${label} submission`,exact:true}).click();await expect(panel).toContainText('SCHEDULED')
   }
  }
  clock=new Date('2026-09-19T13:00:00Z');expect((await runRetirementScheduledDispatches(h.pool,{facility:1,bankFetcher:provider.fetcher,allocationTransfer:transfer,now})).claimed).toBe(2)
  const filePanel=page.getByRole('region',{name:`Retirement allocation file schedule ${allocation.id}`,exact:true});await expect(filePanel).toContainText('CLAIMED',{timeout:40000});expect(provider.posts()).toBe(1);expect(server.state.created).toBe(1)
  await page.setViewportSize({width:390,height:1100});await filePanel.screenshot({path:'/tmp/payroll-retirement-dispatch-schedule-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close();await server.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}
})
