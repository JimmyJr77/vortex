import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeClassSwapInput } from '../classSwaps.js'
import { applyClassSwapRows, classSwapCapacityDelta } from '../classSwapsRoster.js'

const request={mode:'temporary',source:'scheduling',signupId:1,sourceDate:'2030-01-07',sourceTimeSlotId:11,effectiveDate:'2030-01-09',targetFormId:2,targetSlotGroupId:3,targetTimeSlotId:12,reason:'Make-up',requestKey:'swap-test-123',confirmation:'TEMPORARY'}
test('swaps require real dates, valid ids and the exact mode-specific typed confirmation',()=>{
  assert.equal(normalizeClassSwapInput(request,{requireConfirmation:true}).sourceDate,'2030-01-07')
  for(const input of [{...request,effectiveDate:'2030-02-30'},{...request,signupId:-1},{...request,confirmation:'temporary'},{...request,mode:'permanent',confirmation:'TEMPORARY'},{...request,sourceDate:null},{...request,requestKey:'bad'}])assert.throws(()=>normalizeClassSwapInput(input,{requireConfirmation:true}))
  assert.equal(normalizeClassSwapInput({...request,mode:'permanent',confirmation:'PERMANENT'},{requireConfirmation:true}).sourceDate,null)
})

test('one-time overrides affect only the chosen source occurrence and destination day',()=>{
  const athlete={signupId:1,source:'scheduling',memberId:4,name:'Test Student'}
  const swap={id:2,source_type:'scheduling',source_id:1,source_time_slot_id:11,source_date:'2030-01-07',target_time_slot_id:12,target_date:'2030-01-09',athlete}
  const monday=[{timeSlotId:11,athletes:[athlete]},{timeSlotId:13,athletes:[athlete]}]
  applyClassSwapRows(monday,'2030-01-07',[swap])
  assert.equal(monday[0].athleteCount,0)
  assert.equal(monday[1].athleteCount,1,'a sibling class is not removed')
  const wednesday=[{timeSlotId:12,athletes:[]}]
  applyClassSwapRows(wednesday,'2030-01-09',[swap,swap])
  assert.equal(wednesday[0].athleteCount,1,'replaying application does not duplicate the student')
  assert.equal(wednesday[0].athletes[0].isClassSwap,true)
  const nextWeek=[{timeSlotId:11,athletes:[athlete]}]
  applyClassSwapRows(nextWeek,'2030-01-14',[swap])
  assert.equal(nextWeek[0].athleteCount,1,'recurring attendance returns the following week')
})

test('capacity remains compatible before the optional swap schema has been installed',async()=>{
  const db={query:async()=>({rows:[{exists:false}]})}
  assert.equal(await classSwapCapacityDelta(db,1,'2030-01-07'),0)
})
