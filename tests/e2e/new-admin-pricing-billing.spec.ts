import { expect, test, type Page } from '@playwright/test'

async function setup(page: Page, master=true) {
  await page.addInitScript(()=>{
    localStorage.setItem('vortex_admin','true');localStorage.setItem('adminToken','test-token')
    localStorage.setItem('vortex-admin-info',JSON.stringify({id:1,name:'Admin'}));localStorage.setItem('vortex_admin_portal','new-admin')
  })
  let price=12000
  const requests:string[]=[]
  const rule={id:7,name:'Returning family',type:'promo_code',active:true,amountType:'percent',amountValue:1000,applyTo:'per_class',calcBase:'pre',priority:100,stackable:true,scopeLevel:'global',scopeRefId:null,redeemedCount:2,config:{code:'RETURN10'},tiers:[]}
  await page.route('**/api/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;requests.push(path)
    let data:unknown=[]
    if(path==='/api/admin/access/me')data={isMasterAdmin:master,permissions:['pricing.view','pricing.manage','classes.view','classes.manage','billing.view'],user:{id:1}}
    if(path==='/api/admin/notifications')data={notifications:[],unreadCount:0}
    if(path==='/api/admin/new-admin/pricing/classes/1'&&req.method()==='PATCH'){
      expect(Object.keys(req.postDataJSON())).toEqual(['monthlyPriceCents']);price=req.postDataJSON().monthlyPriceCents;data={id:1}
    }
    if(path==='/api/admin/new-admin/classes/1'&&req.method()==='PUT'){price=req.postDataJSON().monthlyPriceCents;data={id:1}}
    if(['/api/admin/new-admin/pricing/classes','/api/admin/new-admin/classes'].includes(path))data={rows:[{id:1,formId:10,programsId:2,name:'Tumbling',programName:'Gymnastics',isActive:true,monthlyPriceCents:price,costAmountCents:price,costUnit:'per_month',details:{displayName:'Tumbling',abridgedName:'Tumble',isActive:true},schedules:[],enrolledCount:0,capacity:12,waitlistCount:0}],total:1,page:1,pageSize:25,totalPages:1}
    if(path==='/api/admin/programs-top')data=[{id:2,displayName:'Gymnastics',pricingPromoCodes:['RETURN10']}]
    if(path==='/api/admin/scheduling/discount-rules')data={rules:[rule],globalSettings:{}}
    if(path==='/api/admin/scheduling/forms')data=[{id:10,title:'Tumbling',programsId:2}]
    if(path==='/api/admin/new-admin/pricing/assignments')data=[{ruleId:7,scopeLevel:'class',scopeRefId:10,name:'Tumbling'}]
    if(path==='/api/admin/scheduling/promo-codes')data=[{code:'RETURN10',sourceType:'discount',sourceId:7,sourceName:'Returning family',subtypeLabel:'Promo code',active:true,redeemedCount:2},{code:'HIDDENPASS',sourceType:'free_pass',sourceId:9,sourceName:'Old free pass',subtypeLabel:'Free pass',active:true,redeemedCount:0}]
    if(path==='/api/admin/stripe/operations')data={stripeEnabled:false,alerts:[],webhookCounts:{},latestReconciliation:null}
    if(path==='/api/admin/stripe/payments')data={retrievedAt:'2026-11-12T12:00:00Z',payments:[{id:'pi_test_shared',createdAt:'2026-11-10T12:00:00Z',amountMinor:15000,amountReceivedMinor:15000,amountRefundedMinor:0,currency:'usd',status:'succeeded',description:'Class tuition',customerId:'cus_shared',customerName:'Test Family',customerEmail:'test@example.test',paymentMethod:'card',latestChargeId:'ch_shared',liveMode:false}]}
    await route.fulfill({json:{success:true,data}})
  })
  await page.goto('/')
  return requests
}

test('class costs stay in sync across pricing and edit class, with discounts/rules/codes and no Free Passes',async({page})=>{
  const requests=await setup(page)
  const nav=page.getByRole('navigation',{name:'Admin sections'})
  await nav.getByRole('button',{name:'Pricing',exact:true}).click()
  const tabs=page.getByRole('navigation',{name:'Pricing tabs'})
  await expect(tabs.getByRole('button')).toHaveText(['Costs','Discounts','Rules','Promo Codes'])
  await expect(page.getByRole('cell',{name:'$120.00 / month',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Edit price: Tumbling',exact:true}).click()
  await page.getByLabel('Monthly price ($)',{exact:true}).fill('150')
  await page.getByRole('button',{name:'Save price',exact:true}).click()
  await expect(page.getByRole('cell',{name:'$150.00 / month',exact:true})).toBeVisible()
  await nav.getByRole('button',{name:'Classes & schedules',exact:true}).click()
  await page.getByRole('button',{name:'Edit class: Tumbling',exact:true}).click()
  await expect(page.getByLabel('Monthly price ($)',{exact:true})).toHaveValue('150.00')
  await page.getByLabel('Monthly price ($)',{exact:true}).fill('135')
  await page.getByRole('button',{name:'Update class/event',exact:true}).click()
  await nav.getByRole('button',{name:'Pricing',exact:true}).click()
  await expect(page.getByRole('cell',{name:'$135.00 / month',exact:true})).toBeVisible()
  await tabs.getByRole('button',{name:'Discounts',exact:true}).click()
  await expect(page.getByRole('cell',{name:/Returning family/})).toBeVisible()
  await tabs.getByRole('button',{name:'Rules',exact:true}).click()
  await expect(page.getByText('Class: Tumbling',{exact:true})).toBeVisible()
  await tabs.getByRole('button',{name:'Promo Codes',exact:true}).click()
  await expect(page.getByText('RETURN10',{exact:true})).toBeVisible()
  await expect(page.getByText('HIDDENPASS',{exact:true})).toHaveCount(0)
  expect(requests.some(path=>path.includes('free-passes'))).toBe(false)
})

test('billing includes recovery, cancellations, disputes, Stripe operations and owner Stripe payments',async({page})=>{
  await setup(page)
  await page.getByRole('navigation',{name:'Admin sections'}).getByRole('button',{name:'Billing',exact:true}).click()
  const tabs=page.getByRole('navigation',{name:'Billing tabs'})
  await expect(tabs.getByRole('button')).toHaveText(['Account Billing & Enrollments','Billing','Stripe Payments'])
  await tabs.getByRole('button',{name:'Billing',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Payment recovery review',exact:true})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Stripe dispute cases',exact:true})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Stripe operations',exact:true})).toBeVisible()
  await tabs.getByRole('button',{name:'Stripe Payments',exact:true}).click()
  await expect(page.getByText('pi_test_shared',{exact:true})).toBeVisible()
  await expect(page.getByRole('cell',{name:'Test Family',exact:false})).toBeVisible()
})

test('ordinary billing admins retain the existing Stripe-wide access restriction',async({page})=>{
  await setup(page,false)
  await page.getByRole('navigation',{name:'Admin sections'}).getByRole('button',{name:'Billing',exact:true}).click()
  await expect(page.getByRole('navigation',{name:'Billing tabs'}).getByRole('button',{name:'Stripe Payments',exact:true})).toHaveCount(0)
})
