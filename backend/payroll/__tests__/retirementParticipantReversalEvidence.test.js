import test from 'node:test'
import assert from 'node:assert/strict'
import {retirementParticipantReversalEvidence as assess} from '../retirementParticipantReversalEvidence.js'
const allocations=[{employeeId:1,ordinaryPretaxCents:1000,ordinaryRothCents:400,catchUpPretaxCents:0,catchUpRothCents:0,totalCents:1400},{employeeId:2,ordinaryPretaxCents:600,ordinaryRothCents:0,catchUpPretaxCents:0,catchUpRothCents:0,totalCents:600}]
const bank={event:{key:'retained-return-event',amountCents:2000}}
const receipt=()=>({version:2,status:'REVERSED',authorizedCents:2000,reversedAllocationCents:2000,reportedCents:0,postedCents:0,returnBankEvidence:{...bank,observationId:'123'},participants:allocations.map(a=>({employeeId:String(a.employeeId),authorizedCents:a.totalCents,status:'REVERSED',fullyAccounted:false,reversedAllocationCents:a.totalCents,reported:{ordinaryPretaxCents:0,ordinaryRothCents:0,catchUpPretaxCents:0,catchUpRothCents:0,totalCents:0}}))})
test('participant reversal evidence reconciles exact full and partial original allocations',()=>{
 const r=receipt();assert.deepEqual(assess(r,allocations,bank),{status:'REVERSED',reversedAllocationCents:2000,postedCents:0})
 r.status='PARTIALLY_REVERSED';r.reversedAllocationCents=1400;r.reportedCents=600;r.postedCents=600;r.participants[1]={...r.participants[1],status:'POSTED',fullyAccounted:true,reported:{...allocations[1]}}
 assert.deepEqual(assess(r,allocations,bank),{status:'PARTIALLY_REVERSED',reversedAllocationCents:1400,postedCents:600})
})
test('reversal evidence rejects changed bank identity, participant attribution and contradictory totals',()=>{
 for(const mutate of [r=>{r.returnBankEvidence.event={...bank.event,key:'other'}},r=>{delete r.returnBankEvidence.observationId},r=>{r.version=1},r=>{r.participants[0].employeeId='9'},r=>{r.participants[0].reported.ordinaryPretaxCents=1;r.participants[0].reported.totalCents=1},r=>{r.participants[0].reversedAllocationCents=1399},r=>{r.reversedAllocationCents=1999},r=>{r.status='PARTIALLY_REVERSED'},r=>{r.postedCents=1},r=>{r.participants[0].fullyAccounted=true}]){const r=receipt();mutate(r);assert.throws(()=>assess(r,allocations,bank))}
 assert.throws(()=>assess(receipt(),[allocations[0],allocations[0]],bank))
})
