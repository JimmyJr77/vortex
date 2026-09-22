import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {mock} from 'node:test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {monthlyBenefitsFixture} from '../../backend/payroll/testing/monthlyBenefitsFixture.js'
import {retirementPlanFixture} from '../../backend/payroll/testing/retirementPlanFixture.js'
import {retirementAnnualFixture} from '../../backend/payroll/testing/retirementAnnualFixture.js'

test('payroll preview shows capped employer compensation without presenting it as reserved funding',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(90000)
 mock.timers.enable({apis:['Date'],now:Date.parse('2026-09-16T16:00:00.000Z')})
 const h=await createHarness({databaseNow:'2026-09-16T16:00:00.000Z'}),errors:string[]=[]
 page.on('pageerror',error=>errors.push(error.message))
 try{
  const {api,employee,periods}=await monthlyBenefitsFixture(h)
  await api('/retirement-plans',{plan:{...retirementPlanFixture(),employerContributions:'MATCH_AND_NONELECTIVE',employerContributionTerms:'Synthetic reviewed employer contribution formula.',employerFormula:{period:'PER_PAYROLL',matchCatchUp:false,matchTiers:[{upToBps:300,matchBps:10000}],nonelectiveBps:200,compensation:{REGULAR:true,OVERTIME:true,BONUS:false,PAID_LEAVE:true},eligibilityTerms:'Synthetic reviewed eligibility conditions.',vestingTerms:'Synthetic reviewed vesting terms.'}},expectedRevision:0,requestKey:randomUUID()})
  const path=`/employees/${employee.id}/retirement-annual-sources/standard`,source=await api(path)
  await api(path,{planRevisionId:source.planRevisionId,expectedRevision:0,requestKey:randomUUID(),facts:{...retirementAnnualFixture(),employerFunding:{compensationCents:35990000,matchingCents:0,nonelectiveCents:0,reference:'Synthetic employer compensation excluding application payroll.'}}})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${u.pathname}${u.search}`})})})
  await page.setViewportSize({width:390,height:1000})
  await page.goto('/tests/support/payroll.html')
  await page.getByRole('button',{name:'Payroll runs',exact:true}).click()
  await page.getByRole('combobox',{name:'Pay period',exact:true}).selectOption(String(periods[1].id))
  await page.getByRole('button',{name:'Preview payroll',exact:true}).click()
  const message=page.getByText(/Employer retirement compensation preview: \$100\.00/).first()
  await expect(message).toBeVisible()
  await expect(message).toContainText('No employer contribution has been reserved.')
  await expect(message).toContainText('Review current employer eligibility before calculating contributions.')
  const eligibilityPath=`/employees/${employee.id}/retirement-employer-eligibility/standard`,eligibility=await api(eligibilityPath)
  const employerReview={sourceFingerprint:eligibility.source.fingerprint,expectedRevision:0,requestKey:randomUUID(),confirmed:true,assessedFrom:'2026-09-01',assessedThrough:'2026-09-15',reference:'Synthetic eligibility reviewed for the completed payroll period.',matching:{status:'NOT_ELIGIBLE',eligibleOn:null,vestedBps:null},nonelective:{status:'ELIGIBLE',eligibleOn:'2026-09-01',vestedBps:0}}
  await api(eligibilityPath,employerReview)
  await page.getByRole('combobox',{name:'Pay period',exact:true}).selectOption(String(periods[0].id))
  await page.getByRole('button',{name:'Preview payroll',exact:true}).click()
  await expect(message).toContainText('Nonelective obligation: $2.00.')
  await expect(message).toContainText('No employer contribution has been reserved.')
  await api(eligibilityPath,{...employerReview,expectedRevision:1,requestKey:randomUUID(),matching:{status:'ELIGIBLE',eligibleOn:'2026-09-01',vestedBps:0}})
  const deferralPath=`/employees/${employee.id}/retirement-eligibility/standard`,deferral=await api(deferralPath)
  await api(deferralPath,{sourceFingerprint:deferral.source.fingerprint,expectedRevision:0,requestKey:randomUUID(),confirmed:true,disposition:'ELIGIBLE',eligibleOn:'2026-09-01',methods:['PERCENTAGE'],reference:'Synthetic employee deferral eligibility evidence.',employeeExplanation:'Eligible for reviewed employee deferrals.'})
  const proposal=(await api('/retirement',undefined,'GET',200,true)).plans[0].proposal
  await api('/retirement/standard/elections',{action:'ELECT',method:'PERCENTAGE',pretax:500,roth:200,signature:'Monthly Benefits',confirmed:true,effectiveOn:'2026-09-17',expectedRevision:0,requestKey:randomUUID(),proposalFingerprint:proposal.fingerprint},'POST',200,true)
  const processingPath='/retirement-plans/standard/processing-review',processing=await api(processingPath)
  await api(processingPath,{planRevisionId:processing.planRevisionId,expectedRevision:0,requestKey:randomUUID(),review:{disposition:'REVIEWED',catchUpAuthorized:false,confirmed:true,reference:'Synthetic reviewed processing for matching preview.',policies:processing.policies}})
  await page.getByRole('button',{name:'Preview payroll',exact:true}).click()
  const funding=page.getByRole('region',{name:'Employer retirement funding for Monthly Benefits',exact:true})
  for(const [label,value] of [['Employer matching','$3.00'],['Employer nonelective','$2.00'],['Total employer funding','$5.00']])await expect(funding.locator('dl > div').filter({has:page.getByText(label,{exact:true})})).toHaveText(label+value)
  await expect(funding).toContainText('Approval will reserve these reviewed employer contributions with the employee deductions.')
  await expect(funding).not.toContainText('Employer contributions reserved at approval.')
  await expect(message).toHaveCount(0)
  const ready=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview
  expect(ready.canApprove).toBe(true)
  expect(ready.employees[0].employerContributionReview.eligibleCompensationCents).toBe(10000)
  await funding.screenshot({path:'/tmp/payroll-employer-compensation-preview-mobile.png'})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  expect(errors).toEqual([])
  expect((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_run_ledger')).rows[0].n).toBe(0)
  expect((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_employer_run_ledger')).rows[0].n).toBe(0)
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{try{await h.close()}finally{mock.timers.reset()}}}
})
