import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {retirementPlanFixture} from '../../backend/payroll/testing/retirementPlanFixture.js'
import {hashPayrollToken} from '../../backend/payroll/employeeAuth.js'
test('employee signs and changes retirement election with exact retry and admin visibility',async({browser})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated local payroll database');test.setTimeout(120000)
 const h=await createHarness({retirementNow:()=>new Date('2026-09-11T12:00:00Z')}),ec=await browser.newContext({viewport:{width:390,height:1000}}),ac=await browser.newContext(),employee=await ec.newPage(),admin=await ac.newPage();let lose=true
 try{
  const api=async(path:string,body?:unknown)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const json=await r.json();expect(r.ok,JSON.stringify(json)).toBe(true);return json.data}
  const e=await api('/employees',{employeeNumber:'ELECTION-BROWSER',legalFirstName:'Synthetic',legalLastName:'Employee',hireDate:'2026-09-01',hourlyRateCents:2500})
  await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[e.id,hashPayrollToken('election-browser-session')])
  await api('/retirement-plans',{plan:retirementPlanFixture(),expectedRevision:0,requestKey:randomUUID()})
  const path=`/employees/${e.id}/retirement-eligibility/standard`,source=(await api(path)).source
  await api(path,{sourceFingerprint:source.fingerprint,expectedRevision:0,requestKey:randomUUID(),confirmed:true,disposition:'ELIGIBLE',eligibleOn:'2026-09-01',methods:['PERCENTAGE'],reference:'Private administrator service review reference',employeeExplanation:'Eligible under the reviewed service and entry requirements.'})
  await ec.addInitScript(()=>sessionStorage.setItem('vortex_payroll_employee_session_v1','election-browser-session'));await ac.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  for(const context of [ec,ac])for(const prefix of ['admin/payroll','payroll/employee'])await context.route(`**/api/${prefix}/**`,async route=>{const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(u.pathname.endsWith('/retirement/standard/elections')&&route.request().method()==='POST'&&lose){lose=false;expect(response.ok()).toBe(true);return route.fulfill({status:503,json:{success:false,message:'Synthetic lost election response'}})}await route.fulfill({response})})
  await employee.goto('/tests/support/payroll.html?employee=1');await employee.getByRole('button',{name:'Onboarding',exact:true}).click()
  const panel=employee.getByRole('region',{name:'My retirement elections',exact:true})
  await panel.getByRole('button',{name:'Review current election terms',exact:true}).click()
  await panel.getByRole('combobox',{name:'Retirement election choice',exact:true}).selectOption('ELECT')
  await panel.getByRole('combobox',{name:'Contribution method',exact:true}).selectOption('PERCENTAGE')
  await panel.getByRole('textbox',{name:'Pretax contribution (%)',exact:true}).fill('5')
  await panel.getByRole('textbox',{name:'Roth contribution (%)',exact:true}).fill('2')
  await panel.getByRole('textbox',{name:'Retirement election signature',exact:true}).fill('Synthetic Employee')
  await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Sign retirement election',exact:true}).click()
  await expect(panel.getByText('Synthetic lost election response',{exact:true})).toBeVisible({timeout:15000})
  await panel.getByRole('button',{name:'Refresh retirement elections',exact:true}).click()
  await expect(panel.getByText('Your election terms or history changed.',{exact:false})).toBeVisible()
  await panel.getByRole('button',{name:'Retry original signed election',exact:true}).click()
  await expect(panel.getByRole('status')).toContainText('Your signed choice was retained.',{timeout:15000})
  expect((await h.pool.query('SELECT count(*)::int AS n FROM payroll_retirement_election')).rows[0].n).toBe(1)
  await expect(panel).not.toContainText('Private administrator')
  await admin.goto('/tests/support/payroll.html');await admin.getByRole('button',{name:'People & onboarding',exact:true}).click();await admin.getByRole('button',{name:/ELECTION-BROWSER/}).click();await admin.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
  const ap=admin.getByRole('region',{name:'Participant signed retirement elections',exact:true});await ap.getByRole('button',{name:'Load signed retirement elections',exact:true}).click();await expect(ap.getByText('Election revision 1',{exact:false})).toBeVisible()
  await panel.getByRole('button',{name:'Review current election terms',exact:true}).click();await panel.getByRole('combobox',{name:'Retirement election choice',exact:true}).selectOption('DECLINE');await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Sign retirement election',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Your signed choice was retained.')
  await expect(ap.getByText('Election revision 2',{exact:false})).toBeVisible({timeout:40000})
  await panel.getByText('Election revision 2',{exact:false}).click();await panel.screenshot({path:'/tmp/payroll-retirement-election-mobile.png'});expect(await employee.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await employee.getByRole('button',{name:'Pay statements',exact:true}).click();await expect(employee.getByRole('region',{name:'My retirement elections',exact:true}).getByText('Election revision 2',{exact:false})).toBeVisible()
 await Promise.all([employee.waitForLoadState('networkidle'),admin.waitForLoadState('networkidle')])
 }finally{
  // All business assertions finish before teardown. Ignore only route callbacks
  // still finishing as their browser contexts are removed.
  await ec.unrouteAll({behavior:'ignoreErrors'});await ac.unrouteAll({behavior:'ignoreErrors'});await ec.close();await ac.close();await h.close()
 }
})
