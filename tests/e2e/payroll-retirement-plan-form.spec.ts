import {test,expect} from '@playwright/test'
import {retirementPlanInput} from '../../backend/payroll/retirementPlanInput.js'
test('staged retirement plan form reviews terms and retries without duplicating a revision',async({page})=>{
 const plan=retirementPlanInput({taxYear:2026,planType:'STANDARD_401K',planId:'standard',effectiveOn:'2026-01-01',confirmed:true,name:'Synthetic Plan',providerName:'Synthetic Recordkeeper',planReference:'Retained synthetic plan document reference',eligibilityTerms:'Reviewed actual eligibility and entry-date terms.',compensationTerms:'Reviewed eligible compensation definition.',employeeTerms:'Reviewed employee election and withdrawal terms.',reviewReference:'Reviewed administrator plan evidence.',allowsPretax:true,allowsRoth:true,allowsCatchUp:false,allowsHigherCatchUp:false,automaticEnrollment:'NOT_APPLICABLE',employerContributions:'NONE',compensation:{REGULAR:true,OVERTIME:true,BONUS:false,PAID_LEAVE:true},planOrdinaryDeferralLimitCents:null,planCatchUpLimitCents:0})
 const history=[{id:'synthetic-1',planId:'standard',revision:1,effectiveOn:'2026-01-01',plan,createdAt:'2026-09-11T12:00:00Z'}],requests=new Map<string,string>();let loseResponse=true
 await page.addInitScript(()=>localStorage.setItem('adminToken','synthetic-admin'))
 await page.route('**/api/admin/payroll/retirement-plans',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{success:true,data:{taxYear:2026,history}}})
  const b=route.request().postDataJSON(),normalized=retirementPlanInput(b.plan),body=JSON.stringify({plan:normalized,revision:b.expectedRevision})
  if(requests.has(b.requestKey)){expect(requests.get(b.requestKey)).toBe(body);return route.fulfill({json:{success:true,data:{id:'synthetic-2',reused:true}}})}
  expect(b.expectedRevision).toBe(1);requests.set(b.requestKey,body);history.unshift({id:'synthetic-2',planId:'standard',revision:2,effectiveOn:normalized.effectiveOn,plan:normalized,createdAt:'2026-09-11T12:01:00Z'})
  if(loseResponse){loseResponse=false;return route.fulfill({status:503,json:{success:false,message:'Synthetic lost plan save response'}})}
  await route.fulfill({json:{success:true,data:{id:'synthetic-2',reused:false}}})
 })
 await page.route('**/api/admin/payroll/retirement-remittance-sources',route=>route.fulfill({json:{success:true,data:{year:2026,items:[],nextCursor:null}}}))
 await page.route('**/api/admin/payroll/retirement-plans/standard/destination',route=>route.fulfill({json:{success:true,data:{planRevisionId:history[0].id,planName:history[0].plan.name,providerName:history[0].plan.providerName,connectionRevision:0,vaultReady:false,history:[]}}}))
 for(const resource of ['timing','allocation-format'])await page.route(`**/api/admin/payroll/retirement-plans/standard/${resource}`,route=>route.fulfill({json:{success:true,data:{planRevisionId:history[0].id,history:[]}}}))
 await page.setViewportSize({width:390,height:1100});await page.goto('/tests/support/retirement-plan.html')
 const panel=page.getByRole('region',{name:'Retirement plan setup',exact:true});await panel.getByRole('button',{name:'Load retirement plan history',exact:true}).click();await panel.getByText('Synthetic Plan · Revision 1 · Effective 2026-01-01',{exact:true}).click();await panel.getByRole('button',{name:'Edit from this retained revision',exact:true}).click()
 await expect(panel.getByRole('combobox',{name:'Roth deferrals',exact:true})).toHaveValue('true');await panel.getByRole('combobox',{name:'Roth deferrals',exact:true}).selectOption('false');await panel.getByRole('textbox',{name:'Administrator review reference',exact:true}).fill('Reviewed the revised plan Roth contribution feature and retained evidence')
 await panel.getByRole('checkbox',{name:'I reviewed these plan terms and retained supporting evidence. Unresolved features require further implementation and review.',exact:true}).check();await panel.getByRole('button',{name:'Retain retirement plan review',exact:true}).click();await expect(panel.getByRole('alert')).toHaveText('Synthetic lost plan save response');await panel.getByRole('button',{name:'Retain retirement plan review',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Plan review retained.');expect(history).toHaveLength(2);expect(requests.size).toBe(1)
 await expect(panel).toContainText('Revision 2');await panel.screenshot({path:'/tmp/payroll-retirement-plan-form-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
})
