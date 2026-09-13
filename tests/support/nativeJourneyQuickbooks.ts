import {expect,type Page} from '@playwright/test'

const labels=['Wages expense','Employer tax expense','Reimbursements expense','Tax liabilities','Deductions payable','Payroll clearing']
export function nativeJourneyQuickbooks(){
 const config:Record<string,string>={QUICKBOOKS_CLIENT_ID:'synthetic-journey-client',QUICKBOOKS_CLIENT_SECRET:'synthetic-journey-secret',QUICKBOOKS_REDIRECT_URI:'https://journey.example.test/api/payroll/quickbooks/callback',QUICKBOOKS_ENVIRONMENT:'sandbox'}
 const prior=Object.fromEntries(Object.keys(config).map(key=>[key,process.env[key]]))
 Object.assign(process.env,config)
 const journals:Array<{requestId:string,payload:any}>=[]
 return {
  journals,
  restore(){for(const key of Object.keys(config)){if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key]}},
  async fetcher(input:string|URL,options:RequestInit={}){
   const url=new URL(String(input))
   if(url.href==='https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'){
    expect(options.method).toBe('POST')
    expect(new URLSearchParams(String(options.body)).get('code')).toBe('synthetic-journey-code')
    return Response.json({access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:3600})
   }
   expect(url.origin).toBe('https://sandbox-quickbooks.api.intuit.com')
   expect(url.pathname).toMatch(/^\/v3\/company\/123\//)
   if(url.pathname.endsWith('/query'))return Response.json({QueryResponse:{Account:labels.map((name,index)=>({Id:String(index+1),FullyQualifiedName:name,Active:true}))}})
   if(url.pathname.endsWith('/journalentry')){
    expect(options.method).toBe('POST')
    const requestId=url.searchParams.get('requestid')
    expect(requestId).toBeTruthy()
    journals.push({requestId:requestId!,payload:JSON.parse(String(options.body))})
    return Response.json({JournalEntry:{Id:'synthetic-native-journey-journal'}})
   }
   throw new Error(`Unexpected isolated QuickBooks request: ${url.pathname}`)
  },
  async connect(page:Page,apiUrl:string){
   const returnUrl=new URL('/tests/support/payroll.html?quickbooksJourney=connected',page.url()).href
   // Only the external authorization/provider boundary is doubled. The app's
   // real authorization state, callback, encrypted connection and mapping run.
   await page.route('https://appcenter.intuit.com/connect/oauth2?**',async route=>{
    const authorization=new URL(route.request().url())
    expect(authorization.searchParams.get('client_id')).toBe(config.QUICKBOOKS_CLIENT_ID)
    const callback=new URL('/api/payroll/quickbooks/callback',apiUrl)
    callback.search=new URLSearchParams({state:authorization.searchParams.get('state')!,code:'synthetic-journey-code',realmId:'123'}).toString()
    const result=await page.request.get(callback.href,{maxRedirects:0})
    expect(result.status()).toBe(302)
    await route.fulfill({status:302,headers:{location:returnUrl},body:''})
   })
   await page.getByRole('button',{name:'Reports & QuickBooks',exact:true}).click()
   await page.getByRole('button',{name:'Connect QuickBooks',exact:true}).click()
   await page.waitForURL(returnUrl)
   await page.getByRole('button',{name:'Reports & QuickBooks',exact:true}).click()
   await expect(page.getByText('Connected company 123 · sandbox',{exact:true})).toBeVisible()
   await page.getByRole('button',{name:'Load chart of accounts',exact:true}).click()
   await expect(page.getByText('Chart of accounts loaded.',{exact:true})).toBeVisible()
   for(const [index,label] of labels.entries())await page.getByRole('combobox',{name:label,exact:true}).selectOption(String(index+1))
   await page.getByRole('checkbox',{name:'The bookkeeper verified these account mappings.',exact:true}).check()
   await page.getByRole('checkbox',{name:'Automatically sync after payroll finalization and retry unconfirmed syncs.',exact:true}).check()
   await page.getByRole('button',{name:'Save sync settings',exact:true}).click()
   await expect(page.getByText('QuickBooks mapping saved.',{exact:true})).toBeVisible()
  }
 }
}
