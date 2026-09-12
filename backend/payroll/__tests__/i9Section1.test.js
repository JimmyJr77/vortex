import test from 'node:test'
import assert from 'node:assert/strict'
import {i9Section1Input} from '../i9Section1.js'
const context={today:'2026-09-12',offerAccepted:true,eVerify:false}
const input=()=>({edition:'01/20/25',personal:{lastName:'Żółć',firstName:'Łukasz',address:'100 Synthetic Street',city:'Bowie',state:'MD',postalCode:'20715',dateOfBirth:'2000-02-29'},attestation:{kind:'CITIZEN'},ssnPending:false,preparerAssisted:false})
test('Section 1 preserves optional blanks and separates SSN/E-Verify configuration',()=>{
 const result=i9Section1Input(input(),context);assert.equal(result.personal.ssn,null);assert.equal(result.personal.lastName,'Żółć')
 assert.throws(()=>i9Section1Input(input(),{...context,eVerify:true}),/SSN/)
 assert.equal(i9Section1Input({...input(),ssnPending:true},{...context,eVerify:true}).ssnPending,true)
 assert.throws(()=>i9Section1Input({...input(),personal:{...input().personal,ssn:'900123456'}},context),/ITIN/)
 assert.throws(()=>i9Section1Input(input(),{...context,offerAccepted:false}),/accepted/)
})
test('Section 1 accepts all attestations and rejects cross-branch identifiers and signatures',()=>{
 const kinds=[{kind:'CITIZEN'},{kind:'NONCITIZEN_NATIONAL'},{kind:'PERMANENT_RESIDENT',aNumber:'A1234567'},{kind:'AUTHORIZED_WORKER',authorizationExpiresOn:'N/A',identifier:{kind:'A_NUMBER',number:'123456789'}},{kind:'AUTHORIZED_WORKER',authorizationExpiresOn:'2027-09-01',identifier:{kind:'I94',number:'123456789A1'}},{kind:'AUTHORIZED_WORKER',authorizationExpiresOn:'N/A',identifier:{kind:'PASSPORT',number:'Synthetic123',country:'Canada'}}]
 for(const attestation of kinds)assert.equal(i9Section1Input({...input(),attestation},context).attestation.kind,attestation.kind)
 assert.throws(()=>i9Section1Input({...input(),attestation:{kind:'CITIZEN',aNumber:'1234567'}},context),/supported/)
 assert.throws(()=>i9Section1Input({...input(),signature:'Cannot sign in an answers payload'},context),/supported/)
 assert.throws(()=>i9Section1Input({...input(),personal:{...input().personal,dateOfBirth:'2001-02-29'}},context),/valid date/)
 assert.throws(()=>i9Section1Input({...input(),personal:{...input().personal,dateOfBirth:'2027-01-01'}},context),/future/)
 assert.equal(i9Section1Input({...input(),preparerAssisted:true},context).preparerAssisted,true)
})
