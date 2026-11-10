import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeStartDateAdjustment, startDateTuitionForMonth } from '../enrollmentStartDateAdjustment.js'
const calendarRows = [{ id: 3, slot_group_id: 2, day_of_week: 4, start_time: '17:30', end_time: '18:30', sg_dates_tbd: false, sg_active_start: '2026-01-01', sg_active_end: '2027-12-31' }]
const tuition = (date, periodKey = date.slice(0,7), monthlyCents = 10000) => startDateTuitionForMonth({periodKey,firstBillingDate:date,monthlyCents,calendarRows,slotGroupId:2,timeSlotId:3})
test('late first billing date counts actual scheduled classes, including the start day',()=>{
 assert.equal(tuition('2026-11-05').amountCents,10000)
 assert.deepEqual(tuition('2026-11-12'),{amountCents:7500,remainingClasses:3,ratio:0.75})
 assert.equal(tuition('2026-11-13').amountCents,5000)
 assert.equal(tuition('2026-11-27').amountCents,0)
})
test('discounted monthly tuition is prorated in cents and capped at one month',()=>{
 assert.equal(tuition('2026-11-12','2026-11',8501).amountCents,6376)
 assert.equal(tuition('2026-10-01').amountCents,10000)
 assert.equal(tuition('2026-11-12','2026-11',0).amountCents,0)
})
test('moving start across months removes earlier tuition and keeps following months whole',()=>{
 assert.equal(tuition('2026-11-12','2026-10').amountCents,0)
 assert.equal(tuition('2026-11-12','2026-12').amountCents,10000)
})
test('invalid dates, blank reasons, and undated schedules cannot create guessed charges',()=>{
 for(const date of ['2026-02-30','2026-13-01','2026-11','bad','']) assert.throws(()=>normalizeStartDateAdjustment({firstBillingDate:date,reason:'late start'}),/valid/)
 assert.throws(()=>normalizeStartDateAdjustment({firstBillingDate:'2026-11-12',reason:' '}),/reason/)
 assert.throws(()=>startDateTuitionForMonth({periodKey:'2026-11',firstBillingDate:'2026-11-12',monthlyCents:10000,calendarRows:[]}),/schedule/)
 assert.deepEqual(normalizeStartDateAdjustment({firstBillingDate:'2028-02-29',reason:' Late payment '}),{firstBillingDate:'2028-02-29',reason:'Late payment'})
})
