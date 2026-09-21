import {test,expect} from '@playwright/test'

for(const legacy of [true,false])test(`settlement recovery remains available without retry permission: legacy=${legacy}`,async({page})=>{
 const actions:string[]=[]
 const errors:string[]=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.addInitScript(()=>localStorage.setItem('adminToken','synthetic-admin'))
 const job={id:'00000000-0000-4000-8000-000000000001',postedDate:'2026-09-18',employeeName:'Synthetic Employee',kind:'WITHDRAWAL',amountCents:10000,bank:{id:'9',name:'Test bank'},clearing:{id:'8',name:'Test clearing'},realmId:'123',environment:'sandbox',status:'NOT_FOUND',journalId:null,reference:'Synthetic retained reference',...(legacy?{}:{retry:{canRetry:false,observationId:null,reason:'Original send outcome is unknown.'},retries:[]})}
 await page.route('**/api/admin/payroll/runs/1/payment-accounting/posting',async route=>{
  if(route.request().method()==='POST'){
   const body=route.request().postDataJSON();actions.push(body.action)
   expect(body.jobId).toBe(job.id)
   await route.fulfill({json:{data:{jobId:job.id,recovery:true,result:{status:'NOT_FOUND'}}}})
  }else await route.fulfill({json:{data:{fingerprint:'synthetic',issues:[],mapping:null,destination:{realmId:'123',environment:'sandbox'},items:[],jobs:[job]}}})
 })
 await page.goto('/tests/support/payroll.html?settlement-response')
 await page.getByRole('button',{name:'Review settlement journals',exact:true}).click()
 const recovery=page.getByRole('button',{name:'Recover withdrawal journal',exact:true})
 await expect(recovery).toBeVisible()
 await expect(page.getByRole('button',{name:'Retry proven-unsent journal',exact:true})).toHaveCount(0)
 await recovery.click()
 await expect(page.getByRole('status')).toHaveText('Settlement journal: NOT FOUND.')
 await expect(recovery).toBeVisible()
 expect(actions).toEqual(['RECOVER'])
 expect(errors).toEqual([])
})
