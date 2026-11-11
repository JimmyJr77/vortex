import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBillingDashboard } from '../billingDashboardMetrics.js'
import { loadBillingDashboard } from '../billingDashboard.js'

const base = {today:'2026-11-10'}
test('cash income includes refunds on their own dates; each breakdown reconciles to the cent', () => {
  const data = buildBillingDashboard({...base,payments:[
    {id:1,amount_cents:10001,occurred_date:'2026-10-01'},
    {id:2,amount_cents:3000,occurred_date:'2025-11-01',gender:'female',date_of_birth:'2018-11-02',class_name:'Imported class'},
    {id:3,amount_cents:100000,occurred_date:'2026-11-05'},
    {id:4,amount_cents:999999,occurred_date:'2026-12-01'},
  ],allocations:[
    {billing_payment_id:1,amount_cents:6000,class_name:'Tumbling',gender:'male',date_of_birth:'2016-10-02'},
    {billing_payment_id:1,amount_cents:3000,class_name:'Team',gender:'female',date_of_birth:'2014-01-01'},
  ],refunds:[{id:1,payment_id:1,amount_cents:3333,occurred_date:'2026-11-07'}]})
  assert.equal(data.summary.twelveMonthIncomeCents,13001)
  assert.equal(data.summary.threeMonthIncomeCents,10001)
  assert.equal(data.summary.lastMonthIncomeCents,10001)
  assert.equal(data.summary.averageMonthlyIncomeCents,13001/12)
  assert.equal(data.months.at(-1).netCents,96667)
  assert.equal(data.months.at(-2).breakdowns.class.Unassigned,1001)
  assert.equal(data.months[0].breakdowns.age['Age 6'],3000)
  for (const month of data.months) for (const breakdown of Object.values(month.breakdowns)) {
    assert.equal(Object.values(breakdown).reduce((total,value)=>total+value,0),month.netCents)
  }
})
test('linked refunds retain their charge category and may produce a negative-income month', () => {
  const data = buildBillingDashboard({...base,refunds:[{id:1,amount_cents:5000,occurred_date:'2026-09-03',has_charge:true,class_name:'Team',gender:'female',date_of_birth:'2016-09-01'}]})
  assert.equal(data.summary.threeMonthIncomeCents,-5000)
  assert.equal(data.months.find(row=>row.key==='2026-09').breakdowns.class.Team,-5000)
})
test('account funds offset oldest debt, credit balances are separate, future bills stay out of overdue/current', () => {
  const data = buildBillingDashboard({...base,accounts:[
    {id:1,family_id:1,family_name:'Owing',balance_cents:11000},
    {id:2,family_id:2,family_name:'Credit',balance_cents:-5000},
    {id:3,family_id:3,family_name:'Paid',balance_cents:0},
    {id:4,family_id:4,family_name:'Future',balance_cents:1000},
  ],lines:[
    {id:1,account_id:1,service_month:'2026-09',open_cents:3000},
    {id:2,account_id:1,service_month:'2026-10',open_cents:4000},
    {id:3,account_id:1,service_month:'2026-11',open_cents:5000},
    {id:4,account_id:1,service_month:'2026-12',open_cents:1000},
    {id:5,account_id:2,service_month:'2026-11',open_cents:3000},
    {id:6,account_id:3,service_month:'2026-11',open_cents:3000},
    {id:7,account_id:4,service_month:'2026-12',open_cents:1000},
  ]})
  assert.equal(data.unpaid.length,1)
  assert.equal(data.unpaid[0].overdueCents,5000)
  assert.equal(data.unpaid[0].currentCents,5000)
  assert.equal(data.unpaid[0].futureCents,1000)
  assert.equal(data.credits.length,1)
  assert.equal(data.credits[0].creditCents,5000)
})
test('billing dashboard requires billing permission and reads one enforced read-only snapshot', async () => {
  const { registerNewAdminRoutes } = await import('../registerRoutes.js')
  let guard
  const app = {use(){},get(path,...chain){if(path.endsWith('/billing-dashboard')) guard=chain[0]},post(){},patch(){},delete(){},put(){}}
  registerNewAdminRoutes(app,{query:()=>assert.fail('denied access must not query')},{jwtSecret:'unit-only'})
  const req={canonicalAccess:{portalAccess:{admin:true},facilityId:7},newAdminPermissions:new Map([['billing.view',Promise.resolve(false)]])}
  const res={status(code){this.statusCode=code;return this},json(){}}
  await guard(req,res,()=>assert.fail('must deny'))
  assert.equal(res.statusCode,403)
  const calls=[], client={query:async(sql,params)=>{calls.push({sql,params});return {rows:sql.includes('new-admin:billing-dashboard') ? [base] : []}},release(){}}
  await loadBillingDashboard({connect:async()=>client},7)
  assert.match(calls[0].sql,/REPEATABLE READ READ ONLY/)
  assert.equal(calls.filter(row=>row.sql.includes('new-admin:billing-dashboard')).length,1)
  assert.equal(calls.find(row=>row.params).params[0],7)
  assert.equal(calls.at(-1).sql,'COMMIT')
})
