import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
for(const classification of ['EXEMPT','NONEXEMPT'])test(`admin can inspect and save ${classification} salary calculations without hourly rates`,async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated localhost payroll database')
 const h=await createHarness()
 try{
  const api=async(path:string,body:unknown)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});expect(r.ok).toBeTruthy();return(await r.json()).data}
  const employee=await api('/employees',{employeeNumber:'SALARY-CALC',legalFirstName:'Salary',legalLastName:'Calculation',jobTitle:'Office manager',hireDate:'2026-01-01',payType:'SALARY',annualSalaryCents:7800000})
  await api(`/employees/${employee.id}/salary-review`,{classification:'EXEMPT',category:'ADMINISTRATIVE',salaryBasisVerified:true,dutiesVerified:true,stateRulesVerified:true,dutiesEvidence:'Verified independent discretion and judgment on significant office management matters.',source:'Synthetic job duties and salary basis agreement',confirmed:true})
  await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[employee.id])
  const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
  if(classification==='NONEXEMPT')for(let i=0;i<6;i++)await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[employee.id,`2026-08-0${i+3}T12:00:00Z`,`2026-08-0${i+3}T20:00:00Z`])
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  for(const prefix of ['admin/payroll','payroll/employee'])await page.route(`**/api/${prefix}/**`,async route=>{const url=new URL(route.request().url());await route.fulfill({response:await route.fetch({url:`${h.url}${url.pathname}${url.search}`})})})
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('/tests/support/payroll.html');
  if(classification==='NONEXEMPT'){
   await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
   await page.getByRole('combobox',{name:'Overtime classification',exact:true}).selectOption('NONEXEMPT')
   await page.getByLabel('Weekly hours covered by salary',{exact:true}).fill('30')
   await page.getByLabel('Applicable minimum wage ($/hour)',{exact:true}).fill('15')
   for(const name of ['I verified the salary agreement covers a fixed 30-hour workweek.','I verified the applicable state and local minimum wage for this employee.','I confirm this classification and its supporting evidence.'])await page.getByLabel(name,{exact:true}).check()
   await page.getByRole('button',{name:'Save salary classification',exact:true}).click()
   await expect(page.getByText(/Salary classification saved and audited/)).toBeVisible()
  }
  if(classification==='EXEMPT'){
   await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
   for(const [day,hours] of [['Sunday','6'],['Monday','0'],['Tuesday','6'],['Wednesday','6'],['Thursday','6'],['Friday','6'],['Saturday','0']])await page.getByLabel(`${day} leave-basis hours`,{exact:true}).fill(hours)
   const schedule=page.getByRole('group',{name:'Normal workweek for sick leave',exact:true})
   await page.setViewportSize({width:390,height:1000});await schedule.scrollIntoViewIfNeeded();await expect(schedule).toBeInViewport({ratio:1});await schedule.screenshot({path:'/tmp/payroll-salary-normal-workweek-mobile.png'});await page.setViewportSize({width:1280,height:800})
   for(const name of ['I verified the salary basis agreement and permitted deduction rules.','I verified the actual duties meet the selected exemption test.','I verified applicable Maryland exemption requirements.','I confirm this classification and its supporting evidence.'])await page.getByLabel(name,{exact:true}).check()
   await page.getByRole('button',{name:'Save salary classification',exact:true}).click()
   await expect(page.getByText(/Salary classification saved and audited/)).toBeVisible()
  }
  await page.getByRole('button',{name:'Payroll runs',exact:true}).click()
  await page.getByRole('combobox',{name:'Pay period',exact:true}).selectOption(String(period.id))
  await page.getByRole('button',{name:'Preview payroll',exact:true}).click()
  const review=page.getByRole('region',{name:'Salary calculation review'})
  await expect(review.getByText('Salary Calculation · $1,500.00 salary',{exact:true})).toBeVisible()
  if(classification==='EXEMPT')await expect(review.getByText(/Sick leave basis: 30 hours/)).toBeVisible()
  else {await expect(review.getByText(/Overtime: 8 hours · \$600.00 additional pay/)).toBeVisible();await expect(review.getByText('Additional straight-time: 10 hours · $500.00.',{exact:true})).toBeVisible()}
  await page.getByRole('button',{name:'Save draft snapshot',exact:true}).click()
  await page.getByRole('button',{name:'Open review',exact:true}).last().click()
  await expect(review.last().getByText(/78,000.00 annually/)).toBeVisible()
  await page.setViewportSize({width:390,height:844});await review.last().scrollIntoViewIfNeeded();await expect(review.last()).toBeInViewport({ratio:1});await review.last().screenshot({path:`/tmp/payroll-salary-${classification.toLowerCase()}-mobile.png`})
  if(classification==='EXEMPT'){
   await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2099-01-01','2099-01-15','2099-01-20','SEMIMONTHLY')")
   await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
   await page.getByRole('button',{name:'Schedule a dated salary change',exact:true}).click()
   for(const [label,value] of Object.entries({'Salary effective date':'2099-01-01','Salary notice delivered on':'2026-01-01','Salary notice delivery reference':'Synthetic written salary notice','Salary change reason':'Synthetic annual salary increase','Reviewed annual salary ($)':'84000'}))await page.getByLabel(label,{exact:true}).fill(value)
   for(const label of ['I confirm written notice was delivered on the recorded date.','I verified the salary basis agreement and permitted deduction rules.','I verified the actual duties meet the selected exemption test.','I verified applicable Maryland exemption requirements.','I confirm this classification and its supporting evidence.'])await page.getByLabel(label,{exact:true}).check()
   await page.getByRole('button',{name:'Schedule reviewed salary change',exact:true}).click()
   await expect(page.getByText(/Salary change scheduled and audited/)).toBeVisible()
   await page.reload();await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
   await expect(page.getByText('2099-01-01 · $84,000.00 annually',{exact:true})).toBeVisible()
   const invite=await api(`/employees/${employee.id}/invitations`,{email:'salary-change-reader@example.test',sendEmail:false})
   await page.goto(`/tests/support/payroll.html?employee&invite=${new URL(invite.inviteUrl).searchParams.get('invite')}`)
   await page.getByRole('button',{name:'Pay statements',exact:true}).click()
   await expect(page.getByText('Announced normal workweek for sick leave: Sun 6h · Tue 6h · Wed 6h · Thu 6h · Fri 6h',{exact:true})).toBeVisible()
   await page.getByRole('button',{name:'Acknowledge salary change',exact:true}).click()
   await expect(page.getByText(/Change receipt acknowledged/)).toBeVisible()
   await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
   await expect(page.getByText(/Employee receipt: \d{4}-\d{2}-\d{2}/)).toBeVisible()
   await page.getByText('Cancel salary change effective 2099-01-01',{exact:true}).click()
   await page.getByLabel('Salary cancellation notice date',{exact:true}).fill('2026-01-02')
   await page.getByLabel('Salary cancellation notice reference',{exact:true}).fill('Synthetic salary cancellation notice')
   await page.getByLabel('Salary cancellation reason',{exact:true}).fill('Synthetic withdrawn salary increase')
   await page.getByLabel('I confirm the cancellation notice was delivered and the preceding agreement should resume.',{exact:true}).check()
   const cancellation=page.locator('details').filter({has:page.getByText('Cancel salary change effective 2099-01-01',{exact:true})})
   await cancellation.scrollIntoViewIfNeeded();await expect(cancellation).toBeInViewport({ratio:1});await cancellation.screenshot({path:'/tmp/payroll-salary-cancellation-mobile.png'})
   await page.getByRole('button',{name:'Confirm salary cancellation',exact:true}).click()
   await expect(page.getByText('2099-01-01 · $84,000.00 annually · cancelled',{exact:true})).toBeVisible()
   await page.reload();await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
   await expect(page.getByText('2099-01-01 · $84,000.00 annually · cancelled',{exact:true})).toBeVisible()
   await page.goto('/tests/support/payroll.html?employee');await page.getByRole('button',{name:'Pay statements',exact:true}).click()
   await page.getByRole('button',{name:'Acknowledge salary cancellation',exact:true}).click()
   await expect(page.getByText(/Cancellation receipt acknowledged/)).toBeVisible()
   const notice=page.locator('section').filter({has:page.getByRole('heading',{name:'Salary change notices',exact:true})})
   await notice.scrollIntoViewIfNeeded();await expect(notice).toBeInViewport({ratio:1});await notice.screenshot({path:'/tmp/payroll-salary-notice-mobile.png'})
   await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click()
   await expect(page.getByText(/cancellation receipt: \d{4}-\d{2}-\d{2}/)).toBeVisible()


  }
  expect(errors).toEqual([])
 }finally{await h.close()}
})
