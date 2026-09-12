import {test,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import {createHarness} from '../../backend/payroll/testing/harness.js'
test('earned bonus retains prior hourly overtime after an exempt salary rehire and fingerprints dated agreements',async({page})=>{
 test.setTimeout(90000)
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database')
 const h=await createHarness();try{
 const api=async(path:string,body:unknown,status=200)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const json=await r.json();assert.equal(r.status,status,JSON.stringify(json));return json.data}
 const e=await api('/employees',{employeeNumber:'BONUS-HISTORY',legalFirstName:'Bonus',legalLastName:'History',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 for(const d of ['03','04','05','06','07'])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-${d}T12:00Z`,`2026-08-${d}T22:00Z`])
 const path=`/employees/${e.id}/bonus-allocation/preview`,input={amountCents:10000,earnedStart:'2026-08-03',earnedEnd:'2026-08-09'}
 const before=await api(path,input);assert.equal(before.additionalOvertimeCents,1000)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-09' WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',hire_date='2026-08-10',termination_date=NULL,pay_type='SALARY',annual_salary_cents=7800000,overtime_classification='EXEMPT',salary_review=$2 WHERE id=$1",[e.id,{classification:'EXEMPT',verifiedAt:'2026-08-10T12:00:00Z'}])
 const prior=await api(path,input)
 assert.equal(prior.additionalOvertimeCents,1000);assert.equal(prior.weeks[0].overtimeEligible,true)
 assert.equal(prior.compensation[0].payType,'HOURLY')
 for(const d of ['10','11','12','13','14'])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-${d}T12:00Z`,`2026-08-${d}T22:00Z`])
 const both=await api(path,{...input,earnedEnd:'2026-08-16'})
 assert.deepEqual(both.weeks.map(w=>w.overtimeEligible),[true,false]);assert.equal(both.additionalOvertimeCents,500)
 await h.pool.query("UPDATE payroll_pay_rate SET hourly_rate_cents=2600 WHERE employee_id=$1 AND effective_on='2026-08-03'",[e.id])
 const changed=await api(path,input);assert.notEqual(changed.fingerprint,prior.fingerprint);assert.equal(changed.additionalOvertimeCents,1000)
 await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2026-08-02T12:00Z','2026-08-02T13:00Z','ADMIN','APPROVED')",[e.id])
 await api(path,{...input,earnedStart:'2026-08-02'},409)
 await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
 await page.route('**/api/admin/payroll/**',async route=>{const url=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${url.pathname}${url.search}`})})})
 await page.setViewportSize({width:390,height:1200});await page.goto('/tests/support/payroll.html')
 await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
 await page.getByLabel('Bonus amount ($)',{exact:true}).fill('100')
 await page.getByRole('combobox',{name:'Bonus classification',exact:true}).selectOption('NONDISCRETIONARY')
 const preview=page.getByRole('region',{name:'Earned bonus overtime allocation'})
 await preview.getByLabel('Bonus earning start',{exact:true}).fill('2026-08-03');await preview.getByLabel('Bonus earning end',{exact:true}).fill('2026-08-16')
 await preview.getByRole('checkbox').check();await preview.getByRole('button',{name:'Calculate bonus overtime',exact:true}).click()
 await expect(preview.getByText('Additional bonus overtime: $5.00',{exact:true})).toBeVisible()
 await preview.getByText('Dated employment agreements',{exact:true}).click()
 await expect(preview.getByText('2026-08-03 through 2026-08-09 · hourly, nonexempt',{exact:true})).toBeVisible()
 await expect(preview.getByText('2026-08-10 through 2026-08-16 · salary, exempt',{exact:true})).toBeVisible()
 await preview.screenshot({path:'/tmp/payroll-bonus-employment-mobile.png'})
 }finally{await page.unrouteAll({behavior:'wait'});await page.close();await h.close()}
})
