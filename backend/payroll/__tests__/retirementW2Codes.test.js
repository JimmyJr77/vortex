import test from 'node:test'
import assert from 'node:assert/strict'
import {retirementW2Codes} from '../retirementW2Codes.js'
const report=()=>({year:2026,status:'RECONCILED',hasEmployeeDeferrals:true,pretaxDeferrals:'110.00',rothDeferrals:'70.00',records:[{runId:'1',planId:'standard',paymentDate:'2026-09-15',ordinaryPretaxCents:10000,ordinaryRothCents:2000,catchUpPretaxCents:1000,catchUpRothCents:3000},{runId:'2',planId:'standard',paymentDate:'2026-09-30',ordinaryPretaxCents:0,ordinaryRothCents:2000,catchUpPretaxCents:0,catchUpRothCents:0}]})
test('standard 401k W-2 codes include corresponding catch-up amounts and reconcile to source records',()=>{
 assert.deepEqual(retirementW2Codes(report()),[{code:'D',amount:'110.00'},{code:'AA',amount:'70.00'}])
 for(const mutate of [r=>r.year=2027,r=>r.status='UNRESOLVED',r=>r.pretaxDeferrals='111.00',r=>r.records.push(r.records[0]),r=>r.records[0].catchUpRothCents=-1,r=>r.records[0].paymentDate='2026-02-30',r=>r.records=[]]){const r=report();mutate(r);assert.throws(()=>retirementW2Codes(r))}
 const roth=report();roth.records.forEach(r=>{r.ordinaryPretaxCents=0;r.catchUpPretaxCents=0});roth.pretaxDeferrals='0.00';assert.deepEqual(retirementW2Codes(roth),[{code:'AA',amount:'70.00'}])
})
