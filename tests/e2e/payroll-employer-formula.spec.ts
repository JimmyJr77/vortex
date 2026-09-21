import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {retirementPlanFixture} from '../../backend/payroll/testing/retirementPlanFixture.js'

test('admin retains and resumes structured employer tiers with exact recovery and rejects contradictory ceilings',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(90000);page.setDefaultTimeout(15000)
 const h=await createHarness(),errors:string[]=[];let lose=true
 page.on('pageerror',e=>errors.push(e.message))
 const api=async(path:string,body?:unknown)=>{
  const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined})
  const result=await r.json();expect(r.ok,JSON.stringify(result)).toBe(true);return result.data
 }
 try{
  await api('/retirement-plans',{plan:{...retirementPlanFixture(),employerContributions:'MATCH_AND_NONELECTIVE',employerContributionTerms:'Synthetic signed tiered matching and nonelective formula.'},expectedRevision:0,requestKey:randomUUID()})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{
   const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`})
   if(u.pathname.endsWith('/retirement-plans')&&route.request().method()==='POST'&&response.ok()&&lose){lose=false;return route.fulfill({status:503,json:{success:false,message:'Synthetic lost employer formula response'}})}
   await route.fulfill({response})
  })
  await page.setViewportSize({width:390,height:1100})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click()
  const panel=page.getByRole('region',{name:'Retirement plan setup',exact:true})
  await panel.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  await panel.getByText('Synthetic Retirement Plan · Revision 1 · Effective 2026-01-01',{exact:true}).click()
  await panel.getByRole('button',{name:'Edit from this retained revision',exact:true}).click()
  const formula=panel.getByRole('region',{name:'Employer funding formula',exact:true})
  await formula.getByRole('combobox',{name:'Structured employer formula review',exact:true}).selectOption('REVIEWED')
  await formula.getByRole('combobox',{name:'Employer formula period',exact:true}).selectOption('ANNUAL_TRUE_UP')
  await formula.getByRole('spinbutton',{name:'Tier 1 compensation ceiling (%)',exact:true}).fill('3')
  await formula.getByRole('spinbutton',{name:'Tier 1 match rate (%)',exact:true}).fill('100')
  await formula.getByRole('button',{name:'Add matching tier',exact:true}).click()
  await formula.getByRole('spinbutton',{name:'Tier 2 compensation ceiling (%)',exact:true}).fill('5')
  await formula.getByRole('spinbutton',{name:'Tier 2 match rate (%)',exact:true}).fill('50')
  await formula.getByRole('combobox',{name:'Match catch-up deferrals',exact:true}).selectOption('true')
  await formula.getByRole('spinbutton',{name:'Nonelective contribution (%)',exact:true}).fill('2.25')
  for(const label of ['Regular wages','Overtime wages','Bonuses','Paid leave'])await formula.getByRole('combobox',{name:`${label} in employer compensation`,exact:true}).selectOption(label==='Bonuses'?'false':'true')
  await formula.getByLabel('Employer contribution eligibility and plan reference',{exact:true}).fill('Synthetic reviewed entry dates and hours under signed clause 3.')
  await formula.getByLabel('Employer contribution vesting and plan reference',{exact:true}).fill('Synthetic reviewed service and vesting under signed clause 4.')
  await panel.getByRole('checkbox',{name:/I reviewed these plan terms/}).check()
  await panel.getByRole('button',{name:'Retain retirement plan review',exact:true}).click()
  await expect(panel.getByText('Synthetic lost employer formula response',{exact:true})).toBeVisible()
  await panel.getByRole('button',{name:'Retry the original plan review',exact:true}).click()
  await expect(panel.getByRole('status')).toContainText('Plan review retained.')
  let history=(await api('/retirement-plans')).history
  expect(history).toHaveLength(2)
  expect(history[0].plan.employerFormula.matchTiers).toEqual([{upToBps:300,matchBps:10000},{upToBps:500,matchBps:5000}])
  expect(history[0].plan.employerFormula.nonelectiveBps).toBe(225)
  expect(history[0].plan.employerFormula.period).toBe('ANNUAL_TRUE_UP')
  expect(history[0].plan.fingerprint).not.toBe(history[1].plan.fingerprint)
  await panel.getByText('Synthetic Retirement Plan · Revision 2 · Effective 2026-01-01',{exact:true}).click()
  const retained=panel.locator('details').filter({has:page.getByText('Synthetic Retirement Plan · Revision 2 · Effective 2026-01-01',{exact:true})})
  await expect(retained).toContainText('Match 50% of deferrals between 3% and 5%')
  await retained.getByRole('button',{name:'Edit from this retained revision',exact:true}).click()
  await expect(formula.getByRole('spinbutton',{name:'Tier 2 match rate (%)',exact:true})).toHaveValue('50')
  await expect(formula.getByRole('spinbutton',{name:'Nonelective contribution (%)',exact:true})).toHaveValue('2.25')
  await formula.screenshot({path:'/tmp/payroll-employer-formula-mobile.png'})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await formula.getByRole('spinbutton',{name:'Tier 2 compensation ceiling (%)',exact:true}).fill('2')
  await panel.getByRole('checkbox',{name:/I reviewed these plan terms/}).check()
  await panel.getByRole('button',{name:'Retain retirement plan review',exact:true}).click()
  await expect(panel.getByText('Matching tiers need increasing compensation ceilings up to 100% and matching rates from 0% to 1,000%.',{exact:true})).toBeVisible()
  history=(await api('/retirement-plans')).history;expect(history).toHaveLength(2)
  const processing=await api('/retirement-plans/standard/processing-review')
  expect(processing.executionIssues.join(' ')).toContain('Employer retirement contributions require implemented calculation')
  expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close()}}
})
