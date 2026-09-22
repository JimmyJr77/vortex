import test from 'node:test'
import assert from 'node:assert/strict'
import {historicalEmploymentWageSource as source,historicalEmploymentWageReview as review,historicalEmploymentWageKeys as keys} from '../historicalEmploymentTaxWages.js'
const scope={facilityId:1,employeeId:9,paymentDate:'2026-09-18'}
const payment={id:41,facility_id:1,employee_id:9,period_start:'2025-12-16',period_end:'2025-12-31',payment_date:'2026-01-02',gross_amount_cents:'20000000',employee_tax_withheld_cents:'4000000',net_amount_cents:'16000000',method:'ACH',reference:'Synthetic prior payment',evidence_note:'Synthetic retained prior payroll register',source:'ADMIN_RECORDED'}
const wages={socialSecurityWagesCents:20000000,medicareWagesCents:20000000,futaWagesCents:20000000,marylandUnemploymentWagesCents:20000000}
const input=s=>({sourceFingerprint:s.fingerprint,disposition:'REVIEWED',reference:'Reviewed synthetic employer payroll register with uncapped taxable wages',confirmed:true,sameEmployerConfirmed:true,uncappedWagesConfirmed:true,completeHistoryConfirmed:true,payments:s.payments.map(p=>({paymentId:p.paymentId,wages:{...wages}}))})

test('prior-year work paid in 2026 retains independent uncapped bases above annual limits',()=>{
 const s=source([payment],scope),r=review(s,input(s))
 assert.equal(s.payments[0].periodStart,'2025-12-16')
 assert.equal(r.payments[0].wages.socialSecurityWagesCents,20000000)
 assert.equal(r.payments[0].wages.futaWagesCents,20000000)
 const independent=input(s);independent.payments[0].wages.futaWagesCents=19000000
 assert.equal(review(s,independent).payments[0].wages.futaWagesCents,19000000)
})
test('payment order and object key order are canonical while source changes invalidate review',()=>{
 const second={...payment,id:42,period_start:'2026-01-01',period_end:'2026-01-15',payment_date:'2026-01-16'}
 const s=source([second,payment],scope),same=source([Object.fromEntries(Object.entries(payment).reverse()),second],scope)
 assert.equal(s.fingerprint,same.fingerprint)
 for(const field of ['reference','evidence_note','source']){
  const changed=source([{...payment,[field]:'Changed source'},second],scope)
  assert.throws(()=>review(changed,input(s)),/changed/)
 }
})
test('foreign scope, duplicates, invalid amounts and payment chronology are rejected',()=>{
 for(const change of [{facility_id:2},{employee_id:8},{id:Number.MAX_SAFE_INTEGER+1},{gross_amount_cents:'9007199254740992'},{gross_amount_cents:'20000000.0'},{net_amount_cents:16000001},{payment_date:'2027-01-02'},{payment_date:'2026-09-19'},{payment_date:'2026-02-30'},{period_end:'2026-01-03'},{method:'UNKNOWN'}])assert.throws(()=>source([{...payment,...change}],scope))
 assert.throws(()=>source([payment,payment],scope),/duplicate/)
 assert.throws(()=>source([payment],{...scope,paymentDate:'2027-09-18'}),/2026/)
})
test('every imported payment and each explicit administrator finding are required',()=>{
 const s=source([payment],scope)
 for(const key of ['confirmed','sameEmployerConfirmed','uncappedWagesConfirmed','completeHistoryConfirmed'])assert.throws(()=>review(s,{...input(s),[key]:false}))
 for(const payments of [[],[null],[{paymentId:'999',wages}],input(s).payments.concat(input(s).payments)])assert.throws(()=>review(s,{...input(s),payments}))
 for(const key of keys)for(const value of [undefined,null,-1,0.5,'20000000',20000001,NaN,Infinity]){
  const b=input(s);b.payments[0].wages[key]=value;assert.throws(()=>review(s,b))
 }
 assert.throws(()=>review(s,{...input(s),reference:'short'}))
})
test('unresolved review cannot carry asserted wage bases and totals cannot lose precision',()=>{
 const s=source([payment],scope)
 const unresolved=review(s,{...input(s),disposition:'UNRESOLVED'})
 assert.equal(unresolved.disposition,'UNRESOLVED');assert.equal(unresolved.payments,undefined)
 const large={...payment,gross_amount_cents:String(Number.MAX_SAFE_INTEGER),employee_tax_withheld_cents:'0',net_amount_cents:String(Number.MAX_SAFE_INTEGER)}
 const tooLarge=source([large,{...large,id:42}],scope),b=input(tooLarge)
 for(const p of b.payments)p.wages=Object.fromEntries(keys.map(k=>[k,Number.MAX_SAFE_INTEGER]))
 assert.throws(()=>review(tooLarge,b),/precision/)
})
