import test from 'node:test'
import assert from 'node:assert/strict'
import {previewWorkweekAllocation} from '../workweekAllocation.js'
import {revalidateWorkweekAllocations} from '../workweekAllocationApproval.js'
const review={employeeId:1,week:'2026-08-03',end:'2026-08-09',issues:[],approvedMinutes:60,agreements:[{employmentStart:'2026-08-07',start:'2026-08-07',end:'2026-08-09',payType:'SALARY',salaryReview:{classification:'NONEXEMPT',verifiedAt:'2026-01-01T00:00:00Z',minimumWageCents:1500}}],time:[{id:1,workDate:'2026-08-07',minutes:60,status:'APPROVED'}],payments:[]}
const input={week:review.week,salaryAllocations:[{employmentStart:'2026-08-07',earningsCents:3000,source:'Synthetic verified salary earnings allocation'}]}
test('allocation freshness tracks earnings independently of payment history and review display state',async()=>{
 const result=previewWorkweekAllocation(review,input.salaryAllocations)
 const changedPayments={...structuredClone(review),payments:[{runId:9,status:'APPROVED',regularPayCents:3000}],allocationReview:{status:'MISSING'}}
 assert.equal(previewWorkweekAllocation(changedPayments,input.salaryAllocations).fingerprint,result.fingerprint)
 const record={id:8,entity_id:'1',created_at:'2026-08-10T00:00:00Z',after_data:{input,result}}
 const db={query:async(_sql,args)=>{assert.equal(args[0],2);assert.deepEqual(args[1],['1']);return {rows:[record]}}}
 await revalidateWorkweekAllocations(db,2,[changedPayments]);assert.equal(changedPayments.allocationReview.status,'CURRENT')
 changedPayments.time[0].minutes=61
 await revalidateWorkweekAllocations(db,2,[changedPayments]);assert.equal(changedPayments.allocationReview.status,'STALE')
 assert.match(changedPayments.allocationReview.issues[0],/changed/)
 const legacy=structuredClone(review)
 for(const version of [1,2,3,4]){record.after_data.result={...result,version};await revalidateWorkweekAllocations(db,2,[legacy]);assert.equal(legacy.allocationReview.status,'STALE');assert.match(legacy.allocationReview.issues[0],/earlier-version/)}
})

test('approved leave changes invalidate retained worked-earnings allocations without adding leave to overtime hours',async()=>{
 const current=structuredClone(review)
 current.agreements[0].annualSalaryCents=6240000;current.agreements[0].salaryReview.fixed40Verified=true
 current.paidLeave=[{id:5,requestId:9,leaveDate:'2026-08-08',minutes:30,hourlyRateCents:null,includedInSalary:true,status:'APPROVED',leaveType:'PTO'}]
 const result=previewWorkweekAllocation(current,input.salaryAllocations)
 assert.equal(result.calculation.workedMinutes,60);assert.equal(result.calculation.overtimeMinutes,0)
 assert.equal(result.paidLeave[0].minutes,30)
 const db={query:async()=>({rows:[{id:8,entity_id:'1',created_at:'2026-08-10T00:00:00Z',after_data:{input,result}}]})}
 await revalidateWorkweekAllocations(db,2,[current]);assert.equal(current.allocationReview.status,'CURRENT')
 current.paidLeave[0].minutes=240
 await revalidateWorkweekAllocations(db,2,[current]);assert.equal(current.allocationReview.status,'STALE')
 current.agreements[0].annualSalaryCents=6240000;current.agreements[0].salaryReview.fixed40Verified=true
 current.paidLeave=[]
 await revalidateWorkweekAllocations(db,2,[current]);assert.equal(current.allocationReview.status,'STALE')
})
