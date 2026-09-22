import {test,expect} from '@playwright/test'
import {mock} from 'node:test'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {healthElectionFixture} from '../../backend/payroll/testing/healthElectionFixture.js'
for(const includeAnnual of [false,true])test(`admin reviews imported bases with exact retry and preserved stale draft on mobile (annual detail: ${includeAnnual})`,async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(90000)
 mock.timers.enable({apis:['Date'],now:Date.parse('2026-09-16T16:00:00.000Z')});const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='1b'.repeat(32)
 const h=await createHarness({databaseNow:'2026-09-16T16:00:00.000Z'}),errors:string[]=[]
 try{
  const {api,employee,periods,path,electionBody}=await healthElectionFixture(h);await api(path,electionBody,'POST',200,true)
  await api(`/employees/${employee.id}/historical-payments`,{requestId:randomUUID(),periodStart:'2026-08-01',periodEnd:'2026-08-15',paymentDate:'2026-08-18',method:'ACH',reference:'SYNTHETIC-UI-WAGE-REVIEW',grossCents:100000,taxCents:20000,netCents:80000,evidence:'Synthetic original payroll register and payment confirmation',wageOnlyConfirmed:true,confirmed:true},'POST',201)
  let lose=true,savedBody:Record<string,unknown>|undefined
  await page.clock.install();page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{
   const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`})
   if(u.pathname.endsWith('/historical-employment-wages')&&route.request().method()==='POST'&&response.ok()){
    savedBody=route.request().postDataJSON()
    if(lose){lose=false;await route.fulfill({status:503,json:{success:false,message:'Synthetic lost imported-wage response'}});return}
   }
   await route.fulfill({response})
  })
  await page.setViewportSize({width:390,height:1100});await page.goto('/tests/support/payroll.html')
  await page.getByText('Review imported employment taxable wages',{exact:true}).click()
  await page.getByLabel('Employee for imported wage review',{exact:true}).selectOption(String(employee.id))
  await page.getByLabel('Payroll payment date for wage review',{exact:true}).fill('2026-09-18')
  await page.getByRole('button',{name:'Load imported taxable wages',exact:true}).click()
  const panel=page.getByRole('region',{name:'Imported taxable-wage review',exact:true})
  await expect(panel).toContainText('NEEDS REVIEW');await panel.getByLabel('Imported wage decision',{exact:true}).selectOption('REVIEWED')
  const labels=['Social Security wages ($)','Medicare wages ($)','Federal unemployment wages ($)','Maryland unemployment wages ($)']
  for(const label of labels)await panel.getByLabel(label,{exact:true}).fill('1000.00')
  if(includeAnnual){
   await panel.getByLabel('Include annual reporting detail for this payment',{exact:true}).check()
   const amounts={'Federal reporting wages ($)':'900.00','Maryland reporting wages ($)':'1000.00','Social Security reporting wages after the annual limit ($)':'1000.00','Wages subject to Additional Medicare ($)':'0.00','Federal income tax withheld ($)':'100.00','Maryland income tax withheld ($)':'23.50','Social Security tax withheld ($)':'62.00','Regular Medicare tax withheld ($)':'14.50','Additional Medicare tax withheld ($)':'0.00','Qualified FLSA overtime premium ($)':'25.00'}
   for(const [label,amount] of Object.entries(amounts))await panel.getByLabel(label,{exact:true}).fill(amount)
   await panel.getByLabel('Annual reporting source reference',{exact:true}).fill('Original synthetic employer payroll register and FLSA premium review')
   await panel.getByLabel('Include employer tax detail for reconciliation',{exact:true}).check()
   for(const [label,value] of Object.entries({'Employer Social Security tax ($)':'62.01','Employer Medicare tax ($)':'14.50','Employer FUTA tax ($)':'6.00','Employer Maryland unemployment tax ($)':'26.00'}))await panel.getByLabel(label,{exact:true}).fill(value)
   await panel.getByLabel('Employer tax source reference',{exact:true}).fill('Original synthetic employer tax register with explicit actual liabilities')

  }
  await panel.getByLabel('Imported wage source reference',{exact:true}).fill('Reviewed original same-employer payroll register.\nVerified uncapped taxable bases.')
  if(includeAnnual)await panel.getByLabel('Federal income tax withheld ($)',{exact:true}).fill('100.01')
  for(const checkbox of await panel.getByRole('checkbox').all()){if(await checkbox.evaluate(e=>e.closest('label')?.textContent?.includes('Include annual reporting')))continue;await checkbox.check()}
  if(includeAnnual){
   await panel.getByRole('button',{name:'Retain imported wage review',exact:true}).click()
   await expect(panel).toContainText('Separate imported withholding components must equal the retained total employee tax.')
   expect((await h.pool.query('SELECT count(*)::int n FROM payroll_historical_employment_wage_review')).rows[0].n).toBe(0)
   await panel.getByLabel('Federal income tax withheld ($)',{exact:true}).fill('100.00')
   for(const checkbox of await panel.getByRole('checkbox').all())await checkbox.check()
  }
  await panel.getByRole('button',{name:'Retain imported wage review',exact:true}).click();await expect(panel).toContainText('Synthetic lost imported-wage response')
  await panel.getByRole('button',{name:'Retry original imported-wage review',exact:true}).click();await expect(panel).toContainText('Imported taxable-wage review retained.')
  expect((await h.pool.query('SELECT count(*)::int n FROM payroll_historical_employment_wage_review')).rows[0].n).toBe(1)
  if(includeAnnual){const prepared=(await api('/reports/year-end-preparation?year=2026')).employees.find((e:{employeeId:number})=>e.employeeId===employee.id);expect(prepared.withholding.combinedMedicare).toBe('14.50');expect(prepared.wageInputs.federal).toBe('900.00');expect(prepared.reviewedQualifiedOvertime).toBe('25.00');expect((await api('/tax-reconciliation?year=2026')).annual.IRS_941).toBe(25301)}
  expect((await api('/runs/preview',{payPeriodId:periods[0].id})).preview.canApprove).toBe(true)
  if(includeAnnual){
   const reports=await page.context().newPage()
   try{
    await reports.setViewportSize({width:390,height:1100});await reports.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
    await reports.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
    await reports.goto('/tests/support/payroll.html');await reports.getByRole('button',{name:'Reports & QuickBooks',exact:true}).click()
    await reports.getByRole('button',{name:'Review retained wage bases',exact:true}).click()
    const bases=reports.getByRole('region',{name:'Retained payroll wage bases',exact:true})
    await expect(bases).toContainText('1 of 1 imported payments have verified reporting detail. Status: REVIEWED.')
    await expect(bases).toContainText('Native and imported wage bases reconcile.');await expect(bases).toContainText('$1,000.00')
    await bases.screenshot({path:'/tmp/payroll-imported-reporting-bases-mobile.png'})
    const exportResponse=reports.waitForResponse(response=>response.url().includes('/reports/tax-liabilities.csv?'))
    const downloadEvent=reports.waitForEvent('download')
    await reports.getByRole('button',{name:'Tax liabilities',exact:true}).click()
    const liabilityResponse=await exportResponse
    expect(liabilityResponse.status()).toBe(200)
    const exportQuery=new URL(liabilityResponse.url()).searchParams
    expect(exportQuery.get('start')).toBe('2026-01-01');expect(exportQuery.get('end')).toBe('2026-12-31')
    const liabilityDownload=await downloadEvent
    expect(liabilityDownload.suggestedFilename()).toBe('vortex-tax-liabilities.csv')
    const stream=await liabilityDownload.createReadStream();expect(stream).not.toBeNull()
    const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk))
    expect(Buffer.concat(chunks).toString('utf8')).toContain('308.51')

    await reports.getByRole('navigation',{name:'Payroll sections',exact:true}).getByRole('button',{name:'Compliance',exact:true}).click()
    await expect(reports.getByText('1 imported payments are included using retained wage, employee withholding and employer tax reviews.',{exact:true})).toBeVisible()
    await reports.getByRole('button',{name:'Prepare IRS 941 comparison',exact:true}).nth(2).click()
    await expect(reports.getByLabel('Reported federal wages ($)',{exact:true})).toHaveValue('900.00')
    await expect(reports.getByLabel('Reported tax control total ($)',{exact:true})).toHaveValue('253.01')
    await reports.getByLabel('Tax form',{exact:true}).selectOption('MD_UI')
    await expect(reports.getByLabel('Reported gross wages ($)',{exact:true})).toHaveValue('')
    await reports.getByRole('button',{name:'Prepare MD UI comparison',exact:true}).nth(2).click()
    await expect(reports.getByLabel('Reported gross wages ($)',{exact:true})).toHaveValue('1000.00')
    await reports.locator('#payroll-tax-filing-form').screenshot({path:'/tmp/payroll-form-specific-wages-mobile.png'})

    expect(await reports.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await reports.waitForLoadState('networkidle');await reports.unrouteAll({behavior:'wait'})
   }finally{await reports.close()}
  }

  await panel.getByLabel('Imported wage decision',{exact:true}).selectOption('REVIEWED')
  for(const label of labels)await panel.getByLabel(label,{exact:true}).fill('1000.00')
  await panel.getByLabel('Imported wage source reference',{exact:true}).fill('My next review draft must remain visible after a competing update')
  await api(`/employees/${employee.id}/historical-employment-wages`,{...savedBody,requestKey:randomUUID(),expectedRevision:1,disposition:'UNRESOLVED'})
  await page.clock.fastForward(30001);await expect(panel).toContainText('Your draft is preserved')
  await expect(panel.getByLabel('Social Security wages ($)',{exact:true})).toHaveValue('1000.00')
  await expect(panel.getByLabel('Imported wage source reference',{exact:true})).toHaveValue('My next review draft must remain visible after a competing update')
  await expect(panel.getByRole('button',{name:'Retain imported wage review',exact:true})).toBeDisabled()
  expect((await api('/runs/preview',{payPeriodId:periods[0].id})).preview.canApprove).toBe(false)
  await panel.getByRole('button',{name:'Review current imported evidence',exact:true}).click()
  await panel.getByLabel('Imported wage decision',{exact:true}).selectOption('REVIEWED');await expect(panel.getByLabel('Social Security wages ($)',{exact:true})).toHaveValue('')
  await panel.getByText('Imported wage review history',{exact:true}).click();await expect(panel).toContainText('Revision 1 · REVIEWED');await expect(panel).toContainText('Revision 2 · UNRESOLVED')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([])
  await panel.screenshot({path:includeAnnual?'/tmp/payroll-imported-annual-review-mobile.png':'/tmp/payroll-imported-wage-review-mobile.png'})
 }finally{await page.close().catch(()=>{});await h.close();mock.timers.reset();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
