import {test,expect} from '@playwright/test'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {retirementPlanFixture} from '../../backend/payroll/testing/retirementPlanFixture.js'
import {randomUUID} from 'node:crypto'
test('admin processing review retains retries and preserves drafts after concurrent policy changes',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated payroll database');test.setTimeout(120000);page.setDefaultTimeout(15000)
 const h=await createHarness(),errors:string[]=[];let lose=true
 page.on('pageerror',e=>errors.push(e.message))
 const api=async(path:string,body?:unknown)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});expect(r.ok).toBe(true);return (await r.json()).data}
 try{
  await api('/retirement-plans',{plan:retirementPlanFixture(),expectedRevision:0,requestKey:randomUUID()})
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(u.pathname.endsWith('/processing-review')&&route.request().method()==='POST'&&lose){lose=false;expect(r.ok()).toBe(true);return route.fulfill({status:503,json:{success:false,message:'Synthetic lost processing response'}})}await route.fulfill({response:r})})
  await page.goto('/tests/support/payroll.html');await expect(page.getByRole('button',{name:'Employer setup',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Employer setup',exact:true}).click()
  await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const panel=page.getByRole('region',{name:'Processing review standard',exact:true})
  await panel.getByRole('button',{name:'Load processing review',exact:true}).click()
  await panel.getByRole('button',{name:'Review current processing policies',exact:true}).click()
  await panel.getByLabel('Processing disposition',{exact:true}).selectOption('REVIEWED')
  await panel.getByLabel('Catch-up processing',{exact:true}).selectOption('false')
  await panel.getByLabel('Processing review reference',{exact:true}).fill('Retained administrator policy review reference')
  await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Retain processing review',exact:true}).click()
  await expect(panel.getByRole('alert')).toHaveText('Synthetic lost processing response')
  await panel.getByRole('button',{name:'Refresh processing history',exact:true}).click()
  await expect(panel.getByText('A source revision changed.',{exact:false})).toBeVisible()
  await panel.getByRole('button',{name:'Retry original processing review',exact:true}).click()
  await expect(panel.getByRole('status')).toContainText('Processing review retained.')
  expect((await h.pool.query('SELECT count(*)::int AS n FROM payroll_retirement_processing_review')).rows[0].n).toBe(1)
  await panel.getByRole('button',{name:'Review current processing policies',exact:true}).click()
  await panel.getByLabel('Processing review reference',{exact:true}).fill('Preserved draft for this administrator')
  const current=await api('/retirement-plans/standard/processing-review')
  await api('/retirement-plans/standard/processing-review',{planRevisionId:current.planRevisionId,expectedRevision:1,requestKey:randomUUID(),review:{confirmed:true,disposition:'SUSPENDED',catchUpAuthorized:false,reference:'Another administrator suspended processing',policies:current.policies}})
  await panel.getByRole('button',{name:'Refresh processing history',exact:true}).click()
  await expect(panel.getByLabel('Processing review reference',{exact:true})).toHaveValue('Preserved draft for this administrator')
  await expect(panel.getByRole('button',{name:'Retain processing review',exact:true})).toBeDisabled()
  await expect(panel.getByText('Current review: SUSPENDED',{exact:true})).toBeVisible()
  await page.setViewportSize({width:390,height:1000});await panel.screenshot({path:'/tmp/payroll-retirement-processing-mobile.png'})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close()}}
})
