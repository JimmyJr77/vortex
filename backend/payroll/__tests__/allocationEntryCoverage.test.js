import test from 'node:test'
import assert from 'node:assert/strict'
import {allocationEntryCoverage} from '../allocationEntryCoverage.js'
test('dated coverage preserves salary and hourly cents with deterministic chronological remainder ties',()=>{
 const time=Array.from({length:5},(_,i)=>({id:i+1,workDate:i<2?'2026-08-03':'2026-08-07',clockIn:`2026-08-${i<2?'03':'07'}T12:0${i}:00Z`,clockOut:`2026-08-${i<2?'03':'07'}T12:0${i+1}:00Z`,minutes:1,status:'APPROVED'}))
 const inputs=[{start:'2026-08-03',end:'2026-08-03',minutes:2,payType:'HOURLY',hourlyRateCents:1001},{start:'2026-08-07',end:'2026-08-07',minutes:3,payType:'SALARY',earningsCents:1001}]
 const calculation={workedMinutes:5,overtimeMinutes:0,straightTimePayCents:1034,overtimePremiumCents:0}
 const result=allocationEntryCoverage({time},inputs,calculation)
 assert.deepEqual(result.entries.map(e=>e.straightTimePayCents),[17,16,334,334,333])
 assert.deepEqual(allocationEntryCoverage({time:[...time].reverse()},[...inputs].reverse(),calculation),result)
 assert.equal(result.entries.reduce((n,e)=>n+e.premiumCents,0),0)
 assert.throws(()=>allocationEntryCoverage({time:[...time,time[0]]},inputs,calculation),/once/)
})
test('premium coverage follows chronological overtime hours and preserves the final premium cent',()=>{
 const time=[{id:1,workDate:'2026-08-03',clockIn:'2026-08-03T00:00:00Z',minutes:2400,status:'APPROVED'},{id:2,workDate:'2026-08-07',clockIn:'2026-08-07T12:00:00Z',minutes:60,status:'APPROVED'},{id:3,workDate:'2026-08-08',clockIn:'2026-08-08T12:00:00Z',minutes:60,status:'APPROVED'}]
 const result=allocationEntryCoverage({time},[{start:'2026-08-03',end:'2026-08-08',minutes:2520,payType:'SALARY',earningsCents:100000}],{workedMinutes:2520,overtimeMinutes:120,straightTimePayCents:100000,overtimePremiumCents:2381})
 assert.deepEqual(result.entries.map(e=>e.premiumCents),[0,1191,1190])
 assert.deepEqual(result.entries.map(e=>e.overtimeMinutes),[0,60,60])
 assert.equal(result.entries.reduce((n,e)=>n+e.straightTimePayCents,0),100000)
})
