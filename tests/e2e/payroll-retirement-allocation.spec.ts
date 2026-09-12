import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {retirementDestinationProvider} from '../../backend/payroll/testing/retirementDestinationProvider.js'
import {retirementAllocationFixture} from '../../backend/payroll/testing/retirementAllocationFixture.js'
test('admin reviews recordkeeper format, retries a lost save, downloads exact allocations and suspends export',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated database');test.setTimeout(120000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher,retirementNow:()=>new Date('2026-09-11T12:00:00Z')}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let lose=true
 try{
  const {run}=await retirementAllocationFixture(h);await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),r=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(lose&&u.pathname.endsWith('/standard/allocation-format')&&route.request().method()==='POST'&&r.ok()){lose=false;await route.fulfill({status:503,json:{success:false,message:'Synthetic lost format response'}})}else await route.fulfill({response:r})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const format=page.getByRole('region',{name:'Recordkeeper allocation format standard',exact:true}),file=page.getByRole('region',{name:`Recordkeeper allocation file ${run.id} standard`,exact:true}),source=page.getByRole('region',{name:'Retirement contribution reconciliation',exact:true})
  await format.getByRole('combobox',{name:'Recordkeeper amount representation',exact:true}).selectOption('DOLLARS');await format.getByRole('combobox',{name:'Recordkeeper date representation',exact:true}).selectOption('ISO');await format.getByRole('combobox',{name:'Include column headers',exact:true}).selectOption('YES')
  const labels=['Recordkeeper plan identifier','Participant identifier','Withholding date','Ordinary pretax','Ordinary Roth','Pretax catch-up','Roth catch-up','Employee total']
  for(let i=0;i<labels.length;i++)await format.getByRole('textbox',{name:`${labels[i]} column header`,exact:true}).fill(`Column${i+1}`)
  await format.getByRole('button',{name:'Move Participant identifier up',exact:true}).click()
  await format.getByRole('textbox',{name:'Recordkeeper specification and verification reference',exact:true}).fill('Recordkeeper actual eight-column participant contribution template confirmed in retained specifications')
  await format.getByRole('checkbox').check();await format.getByRole('button',{name:'Retain allocation format',exact:true}).click();await expect(format).toContainText('Synthetic lost format response')
  await format.getByRole('button',{name:'Retry original allocation format',exact:true}).click();await expect(format).toContainText('Recordkeeper allocation format retained')
  expect((await h.pool.query('SELECT count(*)::int AS count FROM payroll_retirement_allocation_format')).rows[0].count).toBe(1)
  await expect(source).toContainText('Allocation format: VERIFIED',{timeout:40000})
  await file.getByRole('button',{name:'Prepare allocation file for standard',exact:true}).click();await expect(file).toContainText('Allocation file: 1 employee · $14.00');await expect(file).not.toContainText('PRIVATE-PARTICIPANT-54321')
  const downloadPromise=page.waitForEvent('download');await file.getByRole('button',{name:'Download recordkeeper allocation CSV',exact:true}).click();const download=await downloadPromise,csv=await readFile((await download.path())!,'utf8');expect(csv).toContain('"PRIVATE-PARTICIPANT-54321","PRIVATE-PLAN-10001","2026-09-18","10.00","4.00","0.00","0.00","14.00"')
  await page.setViewportSize({width:390,height:1100});await file.screenshot({path:'/tmp/payroll-retirement-allocation-file-mobile.png'});await format.screenshot({path:'/tmp/payroll-retirement-allocation-format-mobile.png'})
  await format.getByRole('combobox',{name:'Allocation format disposition',exact:true}).selectOption('SUSPENDED');await format.getByRole('checkbox').check();await format.getByRole('button',{name:'Retain allocation format',exact:true}).click();await expect(format).toContainText('Allocation format revision 2 · SUSPENDED')
  await expect(source).toContainText('Allocation format: SUSPENDED',{timeout:40000});await expect(file.getByRole('button',{name:'Download recordkeeper allocation CSV',exact:true})).toHaveCount(0)
  expect(provider.posts()).toBe(0);expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}
})
