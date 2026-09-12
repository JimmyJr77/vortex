import {test,expect} from '@playwright/test'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {retirementDestinationProvider} from '../../backend/payroll/testing/retirementDestinationProvider.js'
import {retirementRemittanceFixture} from '../../backend/payroll/testing/retirementRemittanceFixture.js'
test('admin previews exact retirement remittance and rejects stale mapping responses',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher,retirementNow:()=>new Date('2026-09-11T12:00:00Z')}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 let release:(()=>void)|undefined,ready:(()=>void)|undefined,hold=false
 const held=new Promise<void>(resolve=>{ready=resolve})
 try{
  const {api,run,mappingPath}=await retirementRemittanceFixture(h)
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(hold&&u.pathname.endsWith('/retirement-remittance/preview')){hold=false;await new Promise<void>(resolve=>{release=resolve;ready?.()})}await route.fulfill({response:r})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const source=page.getByRole('region',{name:'Retirement contribution reconciliation',exact:true}),panel=source.getByRole('region',{name:`Retirement remittance preview ${run.id} standard`,exact:true}),button=panel.getByRole('button',{name:'Preview remittance for standard',exact:true})
  await button.click();await expect(panel).toContainText('Proposed remittance $14.00');await expect(panel).toContainText('Participant ••••4321');await expect(panel).toContainText('ending 1234');await expect(panel).not.toContainText('PRIVATE-PARTICIPANT')
  await page.setViewportSize({width:390,height:1100});await panel.screenshot({path:'/tmp/payroll-retirement-remittance-preview-mobile.png'})
  provider.change(true);await button.click();await expect(panel.getByRole('alert')).toContainText('destination or funding evidence changed');await expect(panel).not.toContainText('Proposed remittance');provider.change(false)
  hold=true;await button.click();await held
  const m=await api(mappingPath);await api(mappingPath,{sourceFingerprint:m.source.fingerprint,expectedRevision:1,requestKey:randomUUID(),disposition:'SUSPENDED',reference:'Suspended pending recordkeeper identity reconciliation',confirmed:true})
  await expect(source).toContainText('Participant mapping: REVIEW REQUIRED',{timeout:40000})
  const response=page.waitForResponse(r=>r.url().endsWith('/retirement-remittance/preview'));release?.();await response
  await button.click();await expect(panel.getByRole('alert')).toContainText('participant mapping before remittance');await expect(panel).not.toContainText('Proposed remittance');expect(provider.posts()).toBe(0);expect(errors).toEqual([])
 }finally{release?.();try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}
})
