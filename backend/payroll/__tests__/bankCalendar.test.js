import test from 'node:test'
import assert from 'node:assert/strict'
import { previousBankBusinessDay } from '../bankCalendar.js'
import { generateSemimonthlyPeriods } from '../payrollEngine.js'
test('paydays move before weekends and Federal Reserve closures',()=>{
 assert.equal(generateSemimonthlyPeriods(2026,6)[1].payDate,'2026-06-18')
 assert.equal(previousBankBusinessDay('2026-01-19'),'2026-01-16')
 assert.equal(previousBankBusinessDay('2026-05-25'),'2026-05-22')
 assert.equal(previousBankBusinessDay('2026-11-26'),'2026-11-25')
 assert.equal(previousBankBusinessDay('2026-07-05'),'2026-07-03')
 assert.equal(previousBankBusinessDay('2027-07-05'),'2027-07-02')
 assert.equal(previousBankBusinessDay('2027-01-01'),'2026-12-31')
 assert.throws(()=>previousBankBusinessDay('2026-02-30'))
})
