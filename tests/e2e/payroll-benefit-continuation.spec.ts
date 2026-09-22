import {datedBenefitContinuationFixture} from '../../backend/payroll/testing/datedBenefitContinuationFixture.js'
import {test,expect} from '@playwright/test'
import {mock} from 'node:test'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {benefitContinuationFixture} from '../../backend/payroll/testing/benefitContinuationFixture.js'

for(const futureChange of [false,true])test(`admin reviews ${futureChange?'dated prior':'current'} signed final-pay benefits, retries a lost response and refreshes changed coverage before payroll`,async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(90000)
 mock.timers.enable({apis:['Date'],now:Date.parse('2026-09-16T16:00:00.000Z')})
 const h=await createHarness({databaseNow:'2026-09-16T16:00:00.000Z'}),errors:string[]=[];let loseResponse=true
 try{
  const {api,employee,periods,coverageBody}=await (futureChange?datedBenefitContinuationFixture(h):benefitContinuationFixture(h))
  if(!futureChange)await api('/benefit-coverage',coverageBody)
  await page.clock.install();page.on('pageerror',error=>errors.push(error.message));await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(loseResponse&&u.pathname.endsWith('/benefit-continuation')&&route.request().method()==='POST'&&response.ok()){loseResponse=false;return route.fulfill({status:503,json:{success:false,message:'Synthetic lost collection review response'}})}await route.fulfill({response})})
  await page.setViewportSize({width:390,height:1100});await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Reports & QuickBooks',exact:true}).click()
  const ledger=page.getByRole('region',{name:'Monthly benefit coverage ledger',exact:true});await ledger.getByLabel('Benefit coverage month',{exact:true}).fill('2026-09');await ledger.getByRole('button',{name:'Load monthly coverage',exact:true}).click()
  const panel=page.getByRole('region',{name:'Separated employee benefit collection Monthly Benefits',exact:true})
  await panel.getByLabel('Final-pay payment date',{exact:true}).fill('2026-09-18');await panel.getByRole('button',{name:'Load final-pay collection review',exact:true}).click()
  await expect(panel).toContainText('Signed monthly total: $125.00');await expect(panel).toContainText('2026-09-16')
  if(futureChange)await expect(panel).toContainText('before the benefits change effective 2026-09-20')
  await panel.getByText('Read retained employee deduction authorization',{exact:true}).click();await expect(panel).toContainText('Do not prorate the first month')
  await panel.getByLabel('Final-pay collection decision',{exact:true}).selectOption('COLLECT_SIGNED_MONTHLY')
  await panel.getByLabel('Final-pay collection review reference',{exact:true}).fill('Synthetic reviewed full monthly premium and signed final-wage deduction authorization')
  await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Retain final-pay collection review',exact:true}).click()
  await expect(panel.getByRole('alert')).toHaveText('Synthetic lost collection review response');await expect(panel.getByLabel('Final-pay payment date',{exact:true})).toBeDisabled()
  await panel.getByRole('button',{name:'Retry original collection review',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Dated benefit collection review retained')
  expect((await h.pool.query('SELECT * FROM payroll_benefit_continuation_review')).rowCount).toBe(1)
  await panel.getByLabel('Final-pay collection decision',{exact:true}).selectOption('COLLECT_SIGNED_MONTHLY');await panel.getByLabel('Final-pay collection review reference',{exact:true}).fill('Keep this draft after the carrier evidence changes')
  await api('/benefit-coverage',{...coverageBody,expectedRevision:1,requestKey:randomUUID(),reference:'Updated synthetic carrier confirmation for the same monthly premium'})
  await page.clock.fastForward(30001);await expect(panel).toContainText('Collection evidence changed. Your draft is preserved')
  await expect(panel.getByLabel('Final-pay collection review reference',{exact:true})).toHaveValue('Keep this draft after the carrier evidence changes')
  await panel.getByRole('button',{name:'Use current collection evidence',exact:true}).click();await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Retain final-pay collection review',exact:true}).click()
  await expect.poll(async()=>Number((await h.pool.query('SELECT count(*) n FROM payroll_benefit_continuation_review')).rows[0].n)).toBe(2)
  const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-BROWSER-CONTINUATION'})
  const posted=(await h.pool.query('SELECT posttax_deduction_cents,statement_snapshot FROM payroll_run_employee WHERE payroll_run_id=$1 AND employee_id=$2',[run.id,employee.id])).rows[0];expect(Number(posted.posttax_deduction_cents)).toBe(12500);expect(posted.statement_snapshot).toBeTruthy()
  await panel.screenshot({path:futureChange?'/tmp/payroll-dated-continuation-mobile.png':'/tmp/payroll-current-continuation-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([])
 }finally{await page.unrouteAll({behavior:'wait'}).catch(()=>{});await page.close().catch(()=>{});await h.close();mock.timers.reset()}
})
