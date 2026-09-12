import test from 'node:test'
import assert from 'node:assert/strict'
import {calculateFutaDeposits} from '../futaTaxCalendar.js'
const row=(payment_date,futa)=>({payment_date,futa})
const receipt=(paid_on,amount_cents,tax_quarter=1)=>({id:1,paid_on,amount_cents,tax_quarter,agency:'IRS_FUTA',status:'RECORDED'})
const calc=(rows,receipts=[],today='2027-03-01')=>calculateFutaDeposits(rows,2026,receipts,today)
test('FUTA carries exactly 500 and requires a deposit when the accumulated amount exceeds 500',()=>{
 const result=calc([row('2026-01-09',50000),row('2026-04-10',1)])
 assert.equal(result.quarters[0].carriedCents,50000)
 assert.deepEqual(result.obligations.map(o=>[o.quarter,o.fromQuarter,o.liabilityCents,o.dueOn]),[[2,1,50001,'2026-07-31']])
 const annual=calc([row('2026-01-09',50000)])
 assert.equal(annual.obligations[0].rule,'YEAR_END_PAYMENT');assert.equal(annual.obligations[0].dueOn,'2027-02-01')
 assert.equal(calc([row('2026-09-09',60000)]).obligations[0].dueOn,'2026-11-02')
})
test('FUTA receipts cover carried amounts across quarters without duplicating overdue deposits',()=>{
 const result=calc([row('2026-01-09',40000),row('2026-04-10',20000),row('2026-07-10',60000)],[receipt('2026-08-01',60000,2)])
 assert.deepEqual(result.obligations.map(o=>[o.quarter,o.liabilityCents,o.balanceCents,o.status]),[[2,60000,0,'COVERED_LATE'],[3,60000,60000,'OVERDUE']])
 assert.equal(result.obligations[0].lateCoveredCents,60000)
})
test('voluntary early deposits reduce prior carry but do not change the current-quarter threshold',()=>{
 const priorPaid=calc([row('2026-01-09',40000),row('2026-04-10',20000)],[receipt('2026-04-30',40000)])
 assert.equal(priorPaid.obligations.length,1);assert.equal(priorPaid.obligations[0].quarter,4);assert.equal(priorPaid.obligations[0].liabilityCents,20000)
 const currentPaid=calc([row('2026-01-09',60000)],[receipt('2026-02-01',30000)])
 assert.equal(currentPaid.obligations[0].dueOn,'2026-04-30');assert.equal(currentPaid.obligations[0].balanceCents,30000)
 const fullyVoluntary=calc([row('2026-01-09',40000)],[receipt('2026-02-01',45000)])
 assert.equal(fullyVoluntary.obligations.length,0);assert.equal(fullyVoluntary.coveredCents,40000);assert.equal(fullyVoluntary.unappliedCents,5000)
})
test('FUTA projections exclude void and future receipts',()=>{
 const result=calc([row('2026-07-10',20000)],[{...receipt('2026-08-01',5000),status:'VOID'},receipt('2026-10-01',20000)],'2026-09-09')
 assert.equal(result.obligations[0].projected,true);assert.equal(result.obligations[0].coveredCents,0)
 assert.equal(result.quarters[2].closed,false)
})

test('unpaid earlier required deposits keep the fourth-quarter balance on electronic deposit rules',()=>{
 const rows=[row('2026-01-09',60000),row('2026-10-09',10000)]
 const unpaid=calc(rows)
 assert.equal(unpaid.obligations[1].rule,'QUARTERLY_DEPOSIT')
 assert.equal(unpaid.obligations[0].balanceCents,60000)
 const paid=calc(rows,[receipt('2026-04-30',60000)])
 assert.equal(paid.obligations[1].rule,'YEAR_END_PAYMENT')
})
