import test from 'node:test'
import assert from 'node:assert/strict'
import { employerTaxes2026 } from '../employerTaxes.js'
const config={year:2026,verified:true,futaRatePercent:.6,mdUiRatePercent:2.6}
test('employer unemployment taxes apply verified rates and separate annual wage caps',()=>{
 assert.deepEqual(employerTaxes2026({grossCents:200000,config}),{futaWagesCents:200000,mdUiWagesCents:200000,futaTaxCents:1200,mdUiTaxCents:5200})
 assert.deepEqual(employerTaxes2026({grossCents:200000,ytdWagesCents:690000,config}),{futaWagesCents:10000,mdUiWagesCents:160000,futaTaxCents:60,mdUiTaxCents:4160})
 assert.deepEqual(employerTaxes2026({grossCents:200000,ytdWagesCents:900000,config}),{futaWagesCents:0,mdUiWagesCents:0,futaTaxCents:0,mdUiTaxCents:0})
})
test('unverified rates and unsupported unemployment cases fail closed',()=>{
 for(const override of [{config:null},{config:{...config,verified:false}},{year:2027},{workState:'VA'},{pretaxDeductionCents:100},{config:{...config,futaRatePercent:0}},{config:{...config,mdUiRatePercent:99}}])assert.throws(()=>employerTaxes2026({grossCents:200000,config,...override}))
})
