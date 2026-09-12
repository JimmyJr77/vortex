import {allocateEarnedBonus} from '../earnedBonusAllocation.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {reviewedDiscretionaryBonus,paidSettlementBonuses,reviewedSettlementBonus,verifyBonusOvertime} from '../settlementBonusCoverage.js'
const fixture=()=>({adjustmentId:1,amountCents:10000,bonusPayPeriodId:2,taxTreatmentVerified:true,bonusReview:{version:1,classification:'DISCRETIONARY',paymentType:'ANNUAL_LUMP_SUM',amountDiscretionVerified:true,paymentDiscretionVerified:true,noPriorPromiseVerified:true,verifiedAt:'2026-08-10T12:00:00Z',source:'Original signed discretionary award evidence'}})
test('allocated bonuses require complete discretionary classification and the original payment period',()=>{
 const a=fixture(),record=reviewedDiscretionaryBonus(a,2)
 assert.equal(record.amountCents,10000);assert.equal(record.adjustmentId,1)
 for(const mutate of [a=>a.adjustmentId=0,a=>a.amountCents=-1,a=>a.bonusPayPeriodId=3,a=>a.taxTreatmentVerified=false,a=>a.bonusReview.classification='NONDISCRETIONARY',a=>a.bonusReview.noPriorPromiseVerified=false,a=>a.bonusReview.amountDiscretionVerified='yes',a=>a.bonusReview.verifiedAt='bad',a=>a.bonusReview.source='short']){const input=fixture();mutate(input);assert.throws(()=>reviewedDiscretionaryBonus(input,2))}
})
test('paid bonus evidence preserves cents and rejects duplicate, changed, or wrong-period records',()=>{
 const record=reviewedDiscretionaryBonus(fixture(),2)
 const payment={payPeriodId:2,payItems:[{kind:'BONUS',amountCents:10000,allocatedBonus:record}]}
 assert.deepEqual(paidSettlementBonuses(payment),{records:[record],totalCents:10000})
 for(const mutate of [p=>p.payPeriodId=3,p=>p.payItems[0].amountCents=10001,p=>p.payItems[0].allocatedBonus=null,p=>p.payItems.push(p.payItems[0]),p=>p.payItems[0].allocatedBonus.bonusReview.paymentDiscretionVerified=false]){const input=structuredClone(payment);mutate(input);assert.throws(()=>paidSettlementBonuses(input))}
})

test('earned bonus overtime stays linked and rejects altered allocation or prior workweek hours',()=>{
 const a=fixture(),fingerprint='a'.repeat(64)
 a.bonusAllocation={...allocateEarnedBonus(10000,[{week:'2026-08-03',workedMinutes:3000,earnedMinutes:3000,overtimeEligible:true}]),earnedStart:'2026-08-03',earnedEnd:'2026-08-09',fingerprint,coverage:{version:1,evidence:[{entryId:1,workDate:'2026-08-03',source:'CURRENT_PAYROLL'}]}}
 a.bonusReview={...a.bonusReview,classification:'NONDISCRETIONARY',earnedStart:'2026-08-03',earnedEnd:'2026-08-09',allocationMethod:'PROPORTIONAL_EARNED_HOURS',allocationMethodVerified:true,allocationFingerprint:fingerprint}
 const record=reviewedSettlementBonus(a,2),overtime={kind:'BONUS_OVERTIME',bonusAdjustmentId:1,amountCents:1000}
 assert.equal(record.version,2);verifyBonusOvertime([record],[overtime])
 for(const items of [[],[overtime,overtime],[{...overtime,amountCents:999}],[{...overtime,bonusAdjustmentId:2}]])assert.throws(()=>verifyBonusOvertime([record],items))
 const payment={payPeriodId:2,payItems:[{kind:'BONUS',amountCents:10000,allocatedBonus:record},overtime]},review={week:'2026-08-03',allocationReview:{calculation:{workedMinutes:3000}}}
 assert.equal(paidSettlementBonuses(payment,review).totalCents,11000)
 assert.throws(()=>paidSettlementBonuses(payment,{...review,allocationReview:{calculation:{workedMinutes:2940}}}))
 const changed=structuredClone(a);changed.bonusAllocation.additionalOvertimeCents=999
 assert.throws(()=>reviewedSettlementBonus(changed,2))
 changed.bonusAllocation.additionalOvertimeCents=1000;changed.bonusAllocation.weeks[0].allocatedBonusCents=9999
 assert.throws(()=>reviewedSettlementBonus(changed,2))
})
