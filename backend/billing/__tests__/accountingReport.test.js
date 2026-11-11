import test from 'node:test'
import assert from 'node:assert/strict'
import {accountingFilters,accountingCsvCell,listAccountingLines,listAccountingPayments,exportAccountingCsv,ACCOUNTING_EXPORT_LIMIT} from '../accountingReport.js'
import {registerAccountingRoutes} from '../accountingRoutes.js'

const result=(rows=[],total=rows.length,summary={})=>({rows:[{rows,total,summary,timezone:'America/Chicago'}]})

test('accounting rejects invalid dates, unbounded pages, and injected ordering before querying',async()=>{
  let calls=0
  const db={query:async()=>{calls++;return result()}}
  for(const query of [{from:'2026-02-30'},{through:'today'},{from:'2026-02-01',through:'2026-01-31'},
    {page:-1},{page:1000001},{page:1.5},{memberId:'1 OR TRUE'},{classId:0},{sortBy:'date; DROP TABLE billing_charge'},
    {sortDir:'DESC NULLS FIRST'},{status:'overdue'},{balancePeriod:'next; DROP TABLE billing_charge'},{paymentStatus:'refunded'},{kind:'credit'}]) {
    await assert.rejects(listAccountingLines(db,{facilityId:7,query}),error=>error.statusCode===400)
  }
  await assert.rejects(listAccountingLines(db,{facilityId:null}),error=>error.statusCode===403)
  assert.equal(calls,0)
  assert.equal(accountingFilters({pageSize:10000}).pageSize,100)
  assert.equal(accountingFilters({from:'2024-02-29'}).from,'2024-02-29')
})

test('filters stay bound and literal wildcard searches preserve the authenticated facility',async()=>{
  let captured
  const db={query:async(sql,params)=>{captured={sql,params};return result([{id:'9',amount_cents:'1000',paid_cents:'100',open_cents:'900'}],7,{billedCents:'7000',openCents:'6300'})}}
  const report=await listAccountingLines(db,{facilityId:7,query:{facilityId:999,search:"50%_\\' OR TRUE",from:'2026-01-01',through:'2026-01-31',memberId:12,classId:34,page:2,pageSize:3}})
  assert.equal(captured.params[0],7)
  assert.ok(captured.params.includes("%50\\%\\_\\\\' OR TRUE%"))
  assert.ok(!captured.sql.includes("50%_"))
  assert.deepEqual(captured.params.slice(-2),[3,3])
  assert.equal(report.rows[0].amountCents,1000)
  assert.equal(report.rows[0].currency,'usd')
  assert.equal(report.summary.billedCents,7000)
  assert.equal(report.totalPages,3)
  assert.equal(report.timezone,'America/Chicago')
  assert.equal(report.appliedFilters.memberId,12)
})

test('payment status/kind/date filters are distinct and validated',async()=>{
  let captured
  const db={query:async(sql,params)=>{captured={sql,params};return result()}}
  await listAccountingPayments(db,{facilityId:8,query:{kind:'refund',paymentStatus:'settled',from:'2026-11-01',through:'2026-11-01',sortBy:'amount',sortDir:'asc'}})
  assert.deepEqual(captured.params,[8,'2026-11-01','2026-11-01','refund','settled',25,0])
  assert.match(captured.sql,/ORDER BY signed_amount_cents asc/)
  await assert.rejects(listAccountingPayments(db,{facilityId:8,query:{sortBy:'balance'}}),error=>error.statusCode===400)
})

test('CSV preserves numeric negatives, quotes multiline text, and prevents text formula execution',()=>{
  assert.equal(accountingCsvCell(-1200),'-1200')
  assert.equal(accountingCsvCell('=SUM(A1:A2)'),`"'=SUM(A1:A2)"`)
  assert.equal(accountingCsvCell(' \t+cmd'),`"' \t+cmd"`)
  assert.equal(accountingCsvCell('-formula'),`"'-formula"`)
  assert.equal(accountingCsvCell('@link'),`"'@link"`)
  assert.equal(accountingCsvCell('normal "quoted"\nline'),'"normal ""quoted""\nline"')
})

test('CSV exports full filtered rows as readable USD and refuses an oversized report',async()=>{
  let captured
  const db={query:async(sql,params)=>{captured=params;return result([{id:9,description:'=1+1',amount_cents:-12345,paid_cents:0,open_cents:0,original_cents:-12345,adjustment_cents:0,credit_applied_cents:0}])}}
  const output=await exportAccountingCsv(db,{facilityId:1,query:{page:5,pageSize:1}})
  assert.deepEqual(captured.slice(-2),[ACCOUNTING_EXPORT_LIMIT+1,0])
  assert.match(output.csv,/"Billed \(USD\)"/)
  assert.ok(output.csv.includes('-123.45'))
  assert.ok(!output.csv.includes("'-123.45"))
  assert.ok(output.csv.includes(`"'=1+1"`))
  await assert.rejects(exportAccountingCsv({query:async()=>result([],10001)},{facilityId:1}),error=>error.statusCode===409 && error.message.includes('Narrow'))
})

function response(){return {headers:{},code:200,setHeader(k,v){this.headers[k]=v},status(v){this.code=v;return this},json(v){this.body=v},send(v){this.body=v}}}
test('all report routes require billing.view and derive facility only from authenticated user',async()=>{
  const routes=[],permissions=[]
  let params
  const pool={query:async(sql,values)=>{params=values;return result()}}
  const auth=()=>{}
  registerAccountingRoutes({get:(path,...handlers)=>routes.push({path,handlers})},pool,{jwtSecret:'test',requirePermission:(db,secret,key)=>{permissions.push(key);return [auth]}})
  assert.equal(routes.length,6)
  assert.ok(permissions.every(key=>key==='billing.view'))
  assert.ok(routes.every(route=>route.handlers[0]===auth))
  const list=routes.find(route=>route.path.endsWith('/lines')).handlers.at(-1)
  const allowed=response()
  await list({platformAuth:{user:{facility_id:7}},query:{facilityId:999},params:{}},allowed)
  assert.equal(allowed.code,200);assert.equal(params[0],7)
  assert.equal(allowed.headers['Cache-Control'],'no-store')
  const denied=response();params=null
  await list({platformAuth:{user:{}},query:{facilityId:7},params:{}},denied)
  assert.equal(denied.code,403);assert.equal(params,null)
})
