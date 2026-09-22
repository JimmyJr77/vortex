import {test,expect} from '@playwright/test'
import {mock} from 'node:test'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {healthQualificationFixture} from '../../backend/payroll/testing/healthQualificationFixture.js'
test('admin publishes employee disclosure with original-request recovery and preserves a stale draft',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(90000);page.setDefaultTimeout(15000)
 mock.timers.enable({apis:['Date'],now:Date.parse('2026-09-16T16:00:00.000Z')});const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='1a'.repeat(32)
 const h=await createHarness({databaseNow:'2026-09-16T16:00:00.000Z'});let lose=true;const errors:string[]=[]
 try{
  const {api,bytes}=await healthQualificationFixture(h)
  await page.clock.install();page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(lose&&route.request().method()==='POST'&&u.pathname.endsWith('/disclosures')&&response.ok()){lose=false;return route.fulfill({status:503,json:{success:false,message:'Synthetic lost disclosure response'}})}await route.fulfill({response})})
  await page.setViewportSize({width:390,height:1100});await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click()
  const panel=page.getByRole('region',{name:'Employee health plan disclosure Medical',exact:true})
  await panel.getByLabel('Intended health election effective date',{exact:true}).fill('2026-09-18');await panel.getByRole('button',{name:'Load employee disclosure',exact:true}).click();await expect(panel).toContainText('NEEDS DISCLOSURE')
  await panel.getByLabel('Health plan year starts',{exact:true}).fill('2026-09-01');await panel.getByLabel('Health plan year ends',{exact:true}).fill('2027-08-31')
  await panel.getByLabel('Employee eligibility and salary-reduction terms',{exact:true}).fill('Eligible employees may elect the disclosed medical premium salary reduction for this plan year.')
  await panel.getByLabel('Employee election and change rules',{exact:true}).fill('Sign within your reviewed election window. Changes require a permitted event under the written plan.')
  await panel.getByLabel('Employee plan disclosure PDF',{exact:true}).setInputFiles({name:'employee-plan.pdf',mimeType:'application/pdf',buffer:bytes});await expect(panel).toContainText('Employee disclosure PDF selected.')
  await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Publish employee disclosure',exact:true}).click();await expect(panel.getByRole('alert')).toHaveText('Synthetic lost disclosure response')
  await expect(panel.getByLabel('Health plan year starts',{exact:true})).toBeDisabled();await panel.getByRole('button',{name:'Retry original disclosure publication',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Employee plan disclosure published.')
  await expect(panel.getByLabel('Employee plan disclosure PDF',{exact:true})).toHaveValue('')
  expect((await h.pool.query('SELECT count(*)::int n FROM payroll_health_plan_disclosure')).rows[0].n).toBe(1)
  const disclosed=await api('/health-plans/medical/disclosure?effectiveOn=2026-09-18',undefined,'GET',200,true)
  const response=await fetch(`${h.url}/api/payroll/employee/health-plans/medical/disclosure/document?effectiveOn=2026-09-18&disclosureId=${disclosed.id}`,{headers:{Authorization:'Bearer monthly-benefits-session'}});expect(response.status).toBe(200);expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
  await panel.getByLabel('Employee eligibility and salary-reduction terms',{exact:true}).fill('Preserve this unfinished employee disclosure draft while another administrator publishes.')
  const path='/health-plan-qualification/medical/disclosures',state=await api(`${path}?paymentDate=2026-09-18`)
  await api(path,{paymentDate:'2026-09-18',sourceFingerprint:state.source.fingerprint,expectedRevision:1,requestKey:randomUUID(),planYearStartsOn:'2026-09-01',planYearEndsOn:'2027-08-31',employeeTerms:'Another administrator published revised employee eligibility and salary reduction terms.',electionChangesTerms:'Changes require a permitted event and timely administrator review under the plan.',employeeDisclosureConfirmed:true,document:{filename:'employee-plan.pdf',contentBase64:bytes.toString('base64')}})
  await page.clock.fastForward(30001);await expect(panel).toContainText('Disclosure evidence changed. Your draft is preserved')
  await expect(panel.getByLabel('Employee eligibility and salary-reduction terms',{exact:true})).toHaveValue('Preserve this unfinished employee disclosure draft while another administrator publishes.')
  await panel.getByRole('button',{name:'Use current disclosure evidence',exact:true}).click();await expect(panel.getByRole('button',{name:'Publish employee disclosure',exact:true})).toBeDisabled()
  await panel.screenshot({path:'/tmp/payroll-health-disclosure-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([])
 }finally{await page.unrouteAll({behavior:'wait'}).catch(()=>{});await page.close().catch(()=>{});await h.close();mock.timers.reset();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
