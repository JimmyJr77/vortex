import test from 'node:test'
import assert from 'node:assert/strict'
import {marylandAdditionalPeriod} from '../marylandAdditionalPeriod.js'
const input=()=>({employeeId:'2',agreement:{verified:true,employeeId:'2',periodBasis:'PAYMENT_DATE',amountCents:500,payFrequency:'SEMIMONTHLY',fingerprint:'a'.repeat(64),electionFingerprint:'b'.repeat(64)},period:{id:'10',start:'2026-09-16',end:'2026-09-30',payFrequency:'SEMIMONTHLY'},paymentDate:'2026-09-24',history:{reconciled:true,evidence:[]}})
const row=(runId,status,amount)=>({runId,employeeId:'2',status,paymentDate:'2026-09-22',reconciled:true,sourceFingerprint:'c'.repeat(64),additionalWithholding:{status:'VERIFIED',requestedAdditionalCents:500,appliedAdditionalCents:amount,payFrequency:'SEMIMONTHLY',electionFingerprint:'b'.repeat(64)}})
test('additional period counts paid and approved deductions once and releases only voided reservations',()=>{
 const source=input();source.history.evidence=[row('1','FINALIZED',200),row('3','APPROVED',250)]
 const result=marylandAdditionalPeriod(source)
 assert.equal(result.committedAdditionalCents,450);assert.equal(result.remainingAdditionalCents,50)
 assert.deepEqual(result,marylandAdditionalPeriod({...source,history:{reconciled:true,evidence:[...source.history.evidence].reverse()}}))
 assert.equal(marylandAdditionalPeriod({...source,excludeRunId:'3'}).remainingAdditionalCents,300)
 source.history.evidence[1].status='VOID';assert.equal(marylandAdditionalPeriod(source).remainingAdditionalCents,300)
 assert.equal(marylandAdditionalPeriod(input()).remainingAdditionalCents,500)
 const beforeSourceChange=marylandAdditionalPeriod(source)
 source.history.evidence[0].sourceFingerprint='d'.repeat(64);assert.notEqual(marylandAdditionalPeriod(source).fingerprint,beforeSourceChange.fingerprint)
 const fullyApplied=input();fullyApplied.history.evidence=[row('1','FINALIZED',500)];assert.equal(marylandAdditionalPeriod(fullyApplied).remainingAdditionalCents,0)
})
test('additional period rejects duplicate, missing, cross-employee, changed-election and excess applications',()=>{
 const original=row('1','FINALIZED',200)
 for(const evidence of [[original,original],[{...original,employeeId:'9'}],[{...original,paymentDate:'2026-10-01'}],[{...original,paymentDate:'2026-09-25'}],[{...original,status:'DRAFT'}],[{...original,reconciled:false}],[{...original,sourceFingerprint:'bad'}],[{...original,additionalWithholding:{...original.additionalWithholding,status:'MISSING',appliedAdditionalCents:null}}],[{...original,additionalWithholding:{...original.additionalWithholding,electionFingerprint:'e'.repeat(64)}}],[{...original,additionalWithholding:{...original.additionalWithholding,appliedAdditionalCents:1.5}}],[row('1','FINALIZED',400),row('2','APPROVED',400)]])assert.throws(()=>marylandAdditionalPeriod({...input(),history:{reconciled:true,evidence}}),{status:409})
 for(const agreement of [{...input().agreement,verified:false},{...input().agreement,periodBasis:'EARNED_DATE'},{...input().agreement,amountCents:-1}])assert.throws(()=>marylandAdditionalPeriod({...input(),agreement}),{status:409})
 assert.throws(()=>marylandAdditionalPeriod({...input(),history:{reconciled:false,evidence:[]}}),{status:409})
 assert.throws(()=>marylandAdditionalPeriod({...input(),history:{reconciled:true,evidence:[null]}}),{status:409})
})
test('additional period requires a complete agreed calendar and binds its exact period and agreement',()=>{
 for(const [payFrequency,start,end,paymentDate] of [['WEEKLY','2026-09-21','2026-09-27','2026-09-24'],['BIWEEKLY','2026-09-14','2026-09-27','2026-09-24'],['MONTHLY','2026-02-01','2026-02-28','2026-02-20'],['SEMIMONTHLY','2026-09-01','2026-09-15','2026-09-15']]){
  const source=input();source.agreement.payFrequency=payFrequency;source.period={id:'10',payFrequency,start,end};source.paymentDate=paymentDate
  assert.equal(marylandAdditionalPeriod(source).remainingAdditionalCents,500)
 }
 for(const period of [{...input().period,end:'2026-09-29'},{...input().period,start:'2026-09-17'},{...input().period,payFrequency:'MONTHLY'},{...input().period,end:'2026-09-31'}])assert.throws(()=>marylandAdditionalPeriod({...input(),period}),{status:409})
 const source=input(),before=marylandAdditionalPeriod(source);source.agreement.fingerprint='f'.repeat(64);assert.notEqual(marylandAdditionalPeriod(source).fingerprint,before.fingerprint)
})
