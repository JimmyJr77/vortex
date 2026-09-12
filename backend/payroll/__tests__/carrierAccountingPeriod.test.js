import test from 'node:test'
import assert from 'node:assert/strict'
import {carrierAccountingPeriod} from '../carrierAccountingPeriod.js'
test('carrier accounting period uses verified optional close dates and blocks closed or unknown periods',()=>{
 assert.deepEqual(carrierAccountingPeriod({AccountingInfoPrefs:{}},'2026-09-01'),{invoiceDate:'2026-09-01',bookCloseDate:null})
 assert.equal(carrierAccountingPeriod({AccountingInfoPrefs:{BookCloseDate:null}},'2026-09-01').bookCloseDate,null)
 assert.equal(carrierAccountingPeriod({AccountingInfoPrefs:{BookCloseDate:'2026-08-31'}},'2026-09-01').bookCloseDate,'2026-08-31')
 for(const date of ['2026-08-30','2026-08-31'])assert.throws(()=>carrierAccountingPeriod({AccountingInfoPrefs:{BookCloseDate:'2026-08-31'}},date),/closed through/)
 for(const preferences of [undefined,{}, {AccountingInfoPrefs:[]},{AccountingInfoPrefs:{BookCloseDate:'2026-02-30'}}])assert.throws(()=>carrierAccountingPeriod(preferences,'2026-09-01'))
 assert.throws(()=>carrierAccountingPeriod({AccountingInfoPrefs:{}},'2026-02-30'),/valid accounting date/)
})
