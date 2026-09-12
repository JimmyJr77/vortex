import {test,expect} from '@playwright/test'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../../backend/payroll/testing/harness.js'
import {createRetirementSftpServer} from '../../backend/payroll/testing/retirementSftpServer.js'
import {retirementSftpSetupFixture} from '../../backend/payroll/testing/retirementSftpSetupFixture.js'
import {verifyRetirementSftpConnection} from '../../backend/payroll/retirementSftpTransport.js'
test('admin retains encrypted SFTP setup, retries a lost save, checks a real connection and suspends offline',async({page})=>{
 test.skip(!process.env.PAYROLL_TEST_DATABASE_URL,'Requires isolated local database');test.setTimeout(90000)
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const server=await createRetirementSftpServer(),h=await createHarness({retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options)}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  const {api,path}=await retirementSftpSetupFixture(h,server.config);let loseSave=true
  await page.addInitScript(()=>localStorage.setItem('adminToken','payroll-test-admin'))
  await page.route('**/api/admin/payroll/**',async route=>{const u=new URL(route.request().url()),response=await route.fetch({url:`${h.url}${u.pathname}${u.search}`});if(u.pathname.endsWith('/allocation-delivery')&&route.request().method()==='POST'&&response.ok()&&loseSave){loseSave=false;await route.fulfill({status:503,json:{success:false,message:'Synthetic lost delivery setup response'}})}else await route.fulfill({response})})
  await page.goto('/tests/support/payroll.html');await page.getByRole('button',{name:'Employer setup',exact:true}).click();await page.getByRole('button',{name:'Load retirement plan history',exact:true}).click()
  const panel=page.getByRole('region',{name:'Secure allocation delivery standard',exact:true});await panel.getByRole('button',{name:'Load secure delivery setup',exact:true}).click()
  await expect(panel).toContainText('Delivery setup: REVIEW REQUIRED')
  for(const [key,label] of [['host','SFTP hostname'],['username','SFTP username'],['hostKeySha256','Independently verified server SHA-256 fingerprint'],['stagingDirectory','SFTP staging directory'],['deliveryDirectory','SFTP delivery directory']] as const)await panel.getByRole('textbox',{name:label,exact:true}).fill(server.config[key])
  await panel.getByRole('textbox',{name:'SFTP private key',exact:true}).fill(server.config.privateKey)
  await panel.getByRole('textbox',{name:'Secure delivery review or suspension reference',exact:true}).fill('Independent provider confirmation of identity, staging and non-debit allocation delivery')
  const retain=panel.getByRole('button',{name:'Retain secure delivery review',exact:true});await expect(retain).toBeDisabled()
  for(const checkbox of await panel.getByRole('checkbox').all())await checkbox.check()
  await retain.click();await expect(panel.getByRole('alert')).toHaveText('Synthetic lost delivery setup response')
  await panel.getByRole('button',{name:'Retry original secure delivery review',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Secure delivery setup retained')
  await expect(panel.getByRole('textbox',{name:'SFTP private key',exact:true})).toHaveValue('');expect((await api(path)).history).toHaveLength(1)
  await panel.getByRole('button',{name:'Check secure delivery connection',exact:true}).click();await expect(panel.getByRole('status')).toContainText('Server identity and directories verified');await expect(panel).toContainText('Delivery setup: VERIFIED');expect(server.files.size).toBe(0)
  await page.setViewportSize({width:390,height:1100});await panel.getByText('Secure delivery history (1)',{exact:true}).click();await panel.screenshot({path:'/tmp/payroll-retirement-sftp-setup-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  delete process.env.PAYROLL_DOCUMENT_KEY;await panel.getByRole('button',{name:'Load secure delivery setup',exact:true}).click();await expect(panel).toContainText('Encrypted storage is unavailable')
  await panel.getByRole('combobox',{name:'Secure delivery action',exact:true}).selectOption('SUSPEND');await panel.getByRole('textbox',{name:'Secure delivery review or suspension reference',exact:true}).fill('Suspend the connection while reviewing revised provider delivery instructions')
  await panel.getByRole('checkbox',{name:'I confirm this secure delivery action and independently reviewed evidence.',exact:true}).check();await retain.click();await expect(panel).toContainText('Delivery setup: SUSPENDED');expect((await api(path)).history).toHaveLength(2);expect(errors).toEqual([])
 }finally{try{if(!page.isClosed()){await page.unrouteAll({behavior:'ignoreErrors'});await page.close()}}finally{await h.close();await server.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}}
})
