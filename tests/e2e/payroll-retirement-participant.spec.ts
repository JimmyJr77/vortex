import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {regularRetirementFixture} from '../../backend/payroll/testing/regularRetirementFixture.js'
test('admin maps a retirement participant, recovers a lost response and suspends changed evidence',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const previousKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const h=await createHarness({retirementNow:()=>new Date('2026-09-11T12:00:00Z')}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const {employee}=await regularRetirementFixture(h)
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  let loseSave=true
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(loseSave&&route.request().method()==='POST'&&u.pathname.endsWith('/retirement-participant/standard')&&r.ok()){loseSave=false;await route.fulfill({status:503,json:{success:false,message:'Synthetic lost participant save response'}});return}await route.fulfill({response:r})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'People & onboarding',exact:true}).click();await page.getByRole('button',{name:/MONTHLY-BENEFITS/}).click();await page.getByRole('button',{name:'Pay setup & leave',exact:true}).click();await page.getByRole('button',{name:'Load signed retirement elections',exact:true}).click()
  const panel=page.getByRole('region',{name:'Retirement participant mapping standard',exact:true})
  await panel.getByRole('button',{name:'Load participant mapping',exact:true}).click();await expect(panel).toContainText('Mapping status: REVIEW REQUIRED');await panel.getByRole('button',{name:'Review current participant basis',exact:true}).click()
  await panel.getByRole('textbox',{name:'Recordkeeper plan identifier',exact:true}).fill('PRIVATE-PLAN-10001');await panel.getByRole('textbox',{name:'Recordkeeper participant identifier',exact:true}).fill('PRIVATE-PARTICIPANT-54321');await panel.getByRole('textbox',{name:'Participant mapping evidence reference',exact:true}).fill('Recordkeeper roster matched independently to employee identity')
  await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Retain participant mapping',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('Synthetic lost participant save response');await panel.getByRole('button',{name:'Retry original participant review',exact:true}).click()
  await expect(panel).toContainText('Mapping status: VERIFIED');await expect(panel).toContainText('Participant ••••4321');expect((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_participant_mapping')).rows[0].n).toBe(1)
  await expect(panel.getByRole('textbox',{name:'Recordkeeper participant identifier',exact:true})).toHaveValue('')
  await page.setViewportSize({width:390,height:1100});await panel.screenshot({path:'/tmp/payroll-retirement-participant-mobile.png'})
  await h.pool.query("UPDATE payroll_employee SET legal_last_name='Changed' WHERE id=$1",[employee.id]);await expect(panel).toContainText('Mapping status: REVIEW REQUIRED',{timeout:40000})
  await panel.getByRole('button',{name:'Review current participant basis',exact:true}).click();await panel.getByRole('combobox',{name:'Participant mapping disposition',exact:true}).selectOption('SUSPENDED');await panel.getByRole('textbox',{name:'Participant mapping evidence reference',exact:true}).fill('Suspended pending recordkeeper identity reconciliation');await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Retain participant mapping',exact:true}).click();await expect(panel).toContainText('Mapping status: SUSPENDED');await expect(panel).toContainText('Participant revision 1 · VERIFIED');await expect(panel).toContainText('Participant revision 2 · SUSPENDED');expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close();if(previousKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=previousKey}}
})
