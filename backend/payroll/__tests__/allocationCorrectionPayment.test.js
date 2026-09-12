import test from 'node:test'
import assert from 'node:assert/strict'
import {allocationCorrectionPayment} from '../allocationCorrectionPayment.js'
const fixture=()=>{
 const original=[{week:'2026-08-03',workedMinutes:2400,straightTimePayCents:100000,premiumCents:0}],corrected=[{week:'2026-08-03',workedMinutes:2520,straightTimePayCents:105000,premiumCents:2500}]
 return {runId:1,regularMinutes:2400,overtimeMinutes:0,regularPayCents:100000,overtimePayCents:0,otherTaxablePayCents:0,payItems:[],workweekPayments:original,frozenCalculation:{payType:'HOURLY',entries:[]},correctionCoverage:{regularMinutes:2400,overtimeMinutes:120,regularPayCents:100000,overtimePayCents:7500,entries:[{id:1}],settlementIds:[9],workweekCorrections:[{version:1,runId:1,settlementId:9,original,corrected}]}}
}
test('allocation credits exact correction amounts while retaining detached original payment evidence',()=>{
 const payment=fixture(),before=structuredClone(payment),adjusted=allocationCorrectionPayment(payment)
 assert.equal(adjusted.overtimePayCents,7500);assert.equal(adjusted.workweekPayments[0].premiumCents,2500)
 adjusted.frozenCalculation.entries[0].id=88;adjusted.correctionSettlementIds.push(10)
 assert.deepEqual(payment,before)
 const processing={...fixture(),correctionCoverage:null,otherTaxablePayCents:8500,payItems:[{kind:'WAGE_CORRECTION',amountCents:7500,correction:{authorizationId:2,requestId:3}}],correctionPayments:[{id:9,amountCents:7500,authorizationId:2,requestId:3}]}
 assert.equal(allocationCorrectionPayment(processing).otherTaxablePayCents,1000)
 const duplicated=structuredClone(processing)
 duplicated.otherTaxablePayCents=15000
 duplicated.correctionPayments.push({...duplicated.correctionPayments[0],id:10})
 duplicated.payItems.push({kind:'WAGE_CORRECTION',amountCents:7500,correction:{authorizationId:4,requestId:5}})
 assert.throws(()=>allocationCorrectionPayment(duplicated),/Reconcile finalized correction/)
})
test('allocation rejects missing, duplicate and inconsistent correction credit evidence',()=>{
 const mutations=[p=>{p.correctionCoverage.workweekCorrections=[]},p=>{p.correctionCoverage.settlementIds.push(9)},p=>{p.correctionCoverage.workweekCorrections[0].runId=2},p=>{p.workweekPayments=[{...p.workweekPayments[0],premiumCents:1}]},p=>{p.correctionCoverage.overtimePayCents=0},p=>{p.payItems=[{kind:'WAGE_CORRECTION',amountCents:7500}]},p=>{p.correctionPayments=[{id:9,amountCents:7500,authorizationId:2,requestId:3}]}]
 for(const mutate of mutations){const p=fixture();mutate(p);assert.throws(()=>allocationCorrectionPayment(p),/Reconcile finalized correction/)}
})
