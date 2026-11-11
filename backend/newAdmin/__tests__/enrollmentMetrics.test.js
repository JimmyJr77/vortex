import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEnrollmentTrend, loadEnrollmentTrend } from '../enrollmentTrend.js'
import { summarizeCurrent, summarizeMonths, acquisitionMetrics } from '../enrollmentMetrics.js'
import { saveMarketingSpend } from '../marketingSpend.js'
const live = (id, family, start, extra = {}) => ({id, member_id:id, family_id:family, status:'confirmed', start_date:start, ...extra})

test('rolling 12 completed months crosses years and excludes current-month additions/losses', () => {
  const result = buildEnrollmentTrend({today:'2026-01-15', live:[live(1,1,'2024-12-01',{cancel_date:'2025-12-20',status:'cancelled'}), live(2,2,'2025-02-01'), live(3,3,'2026-01-02')]})
  assert.equal(result.rollingMonths.length,12)
  assert.equal(result.rollingMonths[0].key,'2025-01')
  assert.equal(result.rollingMonths.at(-1).key,'2025-12')
  assert.equal(result.summary.newFamilies,1)
  assert.equal(result.summary.averageNewFamilies,1/12)
  assert.equal(result.summary.cancellations,1)
  assert.equal(result.summary.lastMonthLossRate,50)
  assert.equal(result.summary.threeMonthLossRate,50/3)
  assert.equal(result.summary.twelveMonthLossRate,50/12)
})
test('averages preserve missing and zero denominators instead of inventing observations', () => {
  const summary = summarizeMonths([{newFamilies:null,canceledFamilies:null,lossRate:null},{newFamilies:0,canceledFamilies:0,lossRate:0},{newFamilies:6,canceledFamilies:2,lossRate:20}])
  assert.equal(summary.averageNewFamilies,3)
  assert.equal(summary.newFamilyMonths,2)
  assert.equal(summary.threeMonthLossRate,10)
  assert.equal(summarizeMonths([]).twelveMonthLossRate,null)
})
test('family and student loss summaries use independent cohorts across the previous year, excluding the current month', () => {
  const result = buildEnrollmentTrend({today:'2026-01-15', historical:[
    {family_id:1,member_id:1,start_date:'2024-12-01',end_date:'2025-06-01'},
  ], live:[
    live(1,1,'2025-06-01',{member_id:1,cancel_date:'2025-12-20',status:'cancelled'}),
    live(2,1,'2025-07-01',{member_id:1,cancel_date:'2025-12-20',status:'cancelled'}),
    live(3,1,'2024-12-01',{member_id:2,cancel_date:'2026-01-10',status:'cancelled'}),
    live(4,2,'2024-12-01',{member_id:3,cancel_date:'2025-12-10',status:'cancelled'}),
  ]})
  assert.equal(result.studentMonths.length,1)
  assert.equal(result.studentMonths[0].lossRate,100)
  assert.equal(result.summary.lastMonthLossRate,50)
  assert.equal(result.summary.threeMonthLossRate,50/3)
  assert.equal(result.summary.twelveMonthLossRate,50/12)
  assert.deepEqual(result.studentSummary,{
    lastMonthLossRate:66.67,threeMonthLossRate:66.67/3,threeMonthRateMonths:3,
    twelveMonthLossRate:66.67/12,twelveMonthRateMonths:12,
  })
})
test('student summary coverage excludes unresolved students and unknown or zero starting populations independently of families', () => {
  const data = buildEnrollmentTrend({today:'2026-11-10',live:[
    live(1,1,'2026-09-01',{cancel_date:'2026-10-10',status:'cancelled'}),
    live(2,2,'2025-01-01',{member_id:null}),
  ]})
  assert.equal(data.summary.lastMonthLossRate,50)
  assert.equal(data.summary.twelveMonthRateMonths,12)
  assert.deepEqual(data.studentSummary,{
    lastMonthLossRate:100,threeMonthLossRate:100,threeMonthRateMonths:1,
    twelveMonthLossRate:100,twelveMonthRateMonths:1,
  })
  const december = buildEnrollmentTrend({today:'2026-12-10',live:[
    live(1,1,'2026-09-01',{cancel_date:'2026-10-10',status:'cancelled'}),
  ]})
  assert.equal(december.studentSummary.lastMonthLossRate,null)
  assert.equal(december.studentSummary.threeMonthLossRate,100)
  assert.equal(december.studentSummary.threeMonthRateMonths,1)
  assert.deepEqual(buildEnrollmentTrend({today:'2026-11-10'}).studentSummary,{
    lastMonthLossRate:null,threeMonthLossRate:null,threeMonthRateMonths:0,
    twelveMonthLossRate:null,twelveMonthRateMonths:0,
  })
})
test('current counts deduplicate siblings and class repeats, exclude future/ended/test signups, and include pauses', () => {
  const result = buildEnrollmentTrend({today:'2026-11-10', live:[
    live(1,1,'2026-01-01',{class_id:1,gender:'male',date_of_birth:'2016-11-11',class_name:'Team tumbling'}),
    live(2,1,'2026-01-01',{member_id:1,class_id:2,gender:'male',date_of_birth:'2016-11-11',class_name:'Tumbling'}),
    live(3,1,'2026-01-01',{member_id:2,class_id:2,gender:'female',date_of_birth:'2018-11-10',status:'paused',class_name:'Non-team'}),
    live(4,2,'2026-11-11'), live(5,3,'2026-01-01',{cancel_date:'2026-11-10',status:'cancelled'}),
    live(6,4,'2026-01-01'), live(7,5,'2026-01-01',{status:'waitlisted'}),
  ], events:[{signup_id:6,event_type:'canceled_enrollment_error_suppressed'}], classes:[{id:1,name:'Team tumbling'},{id:2,name:'Tumbling'},{id:3,name:'Empty class'}]})
  assert.equal(result.current.families,1)
  assert.equal(result.current.students,2)
  assert.equal(result.current.studentsPerFamily,2)
  assert.deepEqual(result.current.classes.map(row=>row.count),[2,1,0])
  assert.deepEqual(result.current.genders.map(row=>row.count),[1,1,0])
  assert.deepEqual(result.current.teams.map(row=>row.count),[1,1,0])
  assert.deepEqual(result.current.ages,[{label:'Age 8',count:1},{label:'Age 9',count:1}])
})
test('membership uses net recurring amounts per student, sums classes, includes free students and avoids duplicate subscription rows', () => {
  const current = summarizeCurrent([live(1,1,'2026-01-01'),live(2,1,'2026-01-01',{member_id:1}),live(3,2,'2026-01-01')],[],'2026-11-10',[
    {id:1,member_id:1,family_id:1,source_id:'1',net_monthly_cents:10000,status:'active'},
    {id:2,member_id:1,family_id:1,source_id:'1',net_monthly_cents:15000,status:'active'},
    {id:3,member_id:1,family_id:1,source_id:'2',net_monthly_cents:5000,status:'active'},
    {id:4,member_id:3,family_id:2,source_id:'3',net_monthly_cents:9000,status:'paused'},
    {id:5,member_id:999,family_id:1,source_id:'1',net_monthly_cents:800000,status:'active'},
  ])
  assert.equal(current.membership.monthlyRevenueCents,20000)
  assert.equal(current.membership.averageMembershipCents,10000)
  assert.equal(current.membership.pricedStudents,2)
  assert.equal(summarizeCurrent([],[],'2026-11-10',[]).membership.averageMembershipCents,null)
})
test('CAC is ratio of aligned totals including zero-acquisition spend months, excludes blanks and current month; LTV uses family units', () => {
  const months = [{key:'2026-08',newFamilies:0},{key:'2026-09',newFamilies:4},{key:'2026-10',newFamilies:100},{key:'2026-11',newFamilies:10,partial:true}]
  const spending = [{month:'2026-08',amount_cents:20000},{month:'2026-09',amount_cents:60000},{month:'2026-11',amount_cents:500000}]
  const current = {membership:{averageMembershipCents:15000},studentsPerFamily:2}
  const result = acquisitionMetrics(months,spending,current,{twelveMonthLossRate:10})
  assert.equal(result.includedMonths,2)
  assert.equal(result.cacCents,20000)
  assert.equal(result.retentionMonths,10)
  assert.equal(result.familyLifetimeRevenueCents,300000)
  assert.equal(result.revenuePerDollar,15)
  assert.equal(result.rows[0].cacCents,null)
  assert.equal(result.rows[2].spendCents,null)
  assert.equal(acquisitionMetrics(months,[],current,{twelveMonthLossRate:0}).revenuePerDollar,null)
  assert.equal(acquisitionMetrics(months,[{month:'2026-09',amount_cents:0}],current,{twelveMonthLossRate:10}).revenuePerDollar,null)
})
test('marketing edits reject malformed months, negative/fractional amounts and missing versions before writing', async () => {
  const db = {query:()=>assert.fail('invalid input must not write')}
  for (const month of ['2026-13','2026-1','2026-11-01',"2026-11';DROP TABLE family"]) await assert.rejects(saveMarketingSpend(db,1,2,month,{amountCents:100,version:0}))
  for (const amountCents of [-1,1.2,'100',undefined,Infinity,100000000001]) await assert.rejects(saveMarketingSpend(db,1,2,'2026-11',{amountCents,version:0}))
  await assert.rejects(saveMarketingSpend(db,1,2,'2026-11',{amountCents:1}),/Refresh/)
})
test('marketing edits scope to the authenticated facility and preserve optimistic conflict errors', async () => {
  let params
  const db = {query:async(sql,args)=>{params=args;return {rows:[{month:'2026-10',amountCents:'0',version:2}]}}}
  assert.deepEqual(await saveMarketingSpend(db,7,3,'2026-10',{amountCents:0,version:1}),{month:'2026-10',amountCents:0,version:2})
  assert.deepEqual(params,[7,'2026-10-01',0,3,1])
  await assert.rejects(saveMarketingSpend({query:async()=>({rows:[]})},7,3,'2026-10',{amountCents:null,version:1}),error=>error.statusCode===409)
})
test('members-only dashboard does not read or return financial inputs', async () => {
  const client = {query:async sql=>{assert.ok(!sql.includes('FROM enrollment_marketing_spend'));assert.ok(!sql.includes('FROM billing_subscription'));return {rows:[]}},release(){}}
  const data = await loadEnrollmentTrend({connect:async()=>client},7)
  assert.equal(data.current.membership,null)
  assert.equal(data.acquisition,null)
})

test('marketing write route requires member, billing and marketing permissions before reaching the write', async () => {
  const { registerNewAdminRoutes } = await import('../registerRoutes.js')
  let middleware, writes = 0
  const app = {use(){},get(){},post(){},patch(){},delete(){},put(path,...chain){if(path.endsWith('/marketing-spend/:month')) middleware=chain[0]}}
  registerNewAdminRoutes(app,{query:()=>{writes++;throw new Error('Permission denial must precede database writes')}},{jwtSecret:'unit-only'})
  for (const denied of ['members.view','billing.view','marketing.manage']) {
    const req = {canonicalAccess:{portalAccess:{admin:true},facilityId:7},newAdminPermissions:new Map(['members.view','billing.view','marketing.manage'].map(key=>[key,Promise.resolve(key!==denied)]))}
    const res = {status(code){this.statusCode=code;return this},json(body){this.body=body}}
    await middleware(req,res,()=>assert.fail('must not invoke handler'))
    assert.equal(res.statusCode,403)
    assert.match(res.body.message,new RegExp(denied))
  }
  assert.equal(writes,0)
})

test('student trends distinguish siblings, merge classes and bridge Jackrabbit by student identity', () => {
  const data = buildEnrollmentTrend({ today:'2026-04-15', historical:[
    {family_id:1,member_id:1,start_date:'2025-12-01',end_date:'2026-01-01'},
    {family_id:1,member_id:2,start_date:'2025-12-01',end_date:'2026-02-10'},
    {family_id:1,member_id:null,start_date:'2025-12-01',end_date:'2026-02-20'},
  ], live:[
    live(10,1,'2026-01-01',{member_id:1}), live(11,1,'2026-02-01',{member_id:1}),
    live(12,1,'2026-03-01',{member_id:3}),
    live(13,1,'2026-03-01',{member_id:2}),
  ] })
  assert.equal(data.months[1].canceledFamilies,0)
  assert.equal(data.studentMonths[1].openingStudents,2)
  assert.equal(data.studentMonths[1].canceledStudents,1)
  assert.equal(data.studentMonths[1].lossRate,50)
  assert.equal(data.studentMonths[2].newStudents,1)
  assert.equal(data.months[2].newFamilies,0)
  assert.equal(data.studentMonths[0].newStudents,0)
})

test('family membership sums siblings and classes before averaging households', () => {
  const current = summarizeCurrent([live(1,1,'2026-01-01'),live(2,1,'2026-01-01'),live(3,2,'2026-01-01')],[],'2026-11-10',[
    {id:1,member_id:1,family_id:1,source_id:'1',net_monthly_cents:10000,status:'active'},
    {id:2,member_id:2,family_id:1,source_id:'2',net_monthly_cents:20000,status:'active'},
    {id:3,member_id:3,family_id:2,source_id:'3',net_monthly_cents:15000,status:'active'},
  ])
  assert.equal(current.membership.averageMembershipCents,15000)
  assert.equal(current.membership.averageFamilyMembershipCents,22500)
})
