import test from 'node:test'
import assert from 'node:assert/strict'
import {correctionSettlementPlan} from '../correctionSettlementPlan.js'
const fixture=()=>{
 const request={id:3,employee_id:2,facility_id:1,kind:'TIME_CORRECTION',status:'PENDING',payload:{entryId:4,clockIn:'2026-08-03T12:00Z',clockOut:'2026-08-03T22:00Z',unpaidBreakMinutes:0}}
 const original={id:'4',employee_id:'2',facility_id:'1',clock_in:new Date('2026-08-03T12:00Z'),clock_out:new Date('2026-08-03T20:00Z'),status:'APPROVED'}
 const preview={version:3,employeeId:2,requestId:3,calculationId:5,fingerprint:'a'.repeat(64),calculationFingerprint:'b'.repeat(64),paymentDate:'2026-09-04',input:{payPeriodId:6},priorWageCorrectionCents:5000,currentWageReclassificationCents:2500,after:{grossPayCents:85000,netPayCents:72134},targetHours:{after:{regularMinutes:840,overtimeMinutes:720}},targetLeave:{after:{accrualMinutes:52,balanceBeforeMinutes:52,yearAccruedBeforeMinutes:52,fraction:{version:1,remainder:0,sourceRunId:1}}},correctionLeave:{version:1,creditDifferenceMinutes:52}}
 const employee={employeeId:2,...preview.after,...preview.targetHours.after,sickLeaveAccrualMinutes:52,sickLeaveBalanceBeforeMinutes:52,sickLeaveYearAccruedBeforeMinutes:52,sickLeaveFraction:{sourceRunId:1,remainder:0,version:1},payItems:[{kind:'WAGE_CORRECTION',amountCents:5000,correction:{authorizationId:7,requestId:3,fingerprint:preview.calculationFingerprint}}]}
 return {request,authorizationId:7,preview,original,employee}
}
test('settlement plan freezes source and authorized amounts without applying payment',()=>{
 const input=fixture(),plan=correctionSettlementPlan(input)
 assert.equal(plan.status,'AUTHORIZED_UNAPPLIED');assert.equal(plan.paymentApplied,false)
 assert.equal(plan.originalTime.clock_out,'2026-08-03T20:00:00.000Z')
 assert.equal(plan.proposedTime.clockOut,'2026-08-03T22:00Z')
 input.request.payload.clockOut='2026-08-03T23:00Z';input.preview.after.netPayCents=0
 assert.equal(plan.proposedTime.clockOut,'2026-08-03T22:00Z');assert.equal(plan.after.netPayCents,72134)
 const missing=fixture();delete missing.request.payload.entryId;missing.original=null
 assert.equal(correctionSettlementPlan(missing).originalTime,null)
})
test('settlement plan rejects mismatched source, financial, hours, leave and earning evidence',()=>{
 const mutations=[
  x=>{x.request.status='DECLINED'},x=>{x.preview.employeeId=9},x=>{x.employee.employeeId=9},
  x=>{x.original.facility_id=9},x=>{x.original.employee_id=9},x=>{x.original.id=9},x=>{x.original=null},
  x=>{delete x.request.payload.entryId},x=>{x.authorizationId=0},x=>{x.preview.fingerprint='bad'},
  x=>{x.employee.netPayCents++},x=>{x.employee.regularMinutes++},x=>{x.employee.overtimeMinutes++},
  x=>{x.employee.sickLeaveAccrualMinutes++},x=>{x.employee.sickLeaveBalanceBeforeMinutes++},
  x=>{x.employee.sickLeaveYearAccruedBeforeMinutes++},x=>{x.employee.sickLeaveFraction.remainder++},
  x=>{x.employee.payItems[0].amountCents++},x=>{x.employee.payItems[0].correction.authorizationId++},
  x=>{x.employee.payItems[0].correction.requestId++},x=>{x.employee.payItems[0].correction.fingerprint='c'.repeat(64)},
  x=>{x.employee.payItems.push(x.employee.payItems[0])},x=>{x.employee.payItems=[]}
 ]
 for(const mutate of mutations){const input=fixture();mutate(input);assert.throws(()=>correctionSettlementPlan(input),{status:409})}
})
