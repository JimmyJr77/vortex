import test from 'node:test'
import assert from 'node:assert/strict'
import {i9DraftToSection1} from '../i9DraftToSection1.js'
import {i9DraftInput} from '../i9DraftInput.js'
const context={today:'2026-09-12',offerAccepted:true,eVerify:false}
const draft={lastName:'Synthetic',firstName:'Employee',address:'100 Example Street',city:'Bowie',state:'MD',postalCode:'20715',dateOfBirth:'2000-02-29',attestationKind:'CITIZEN',ssnPending:false,preparerAssisted:false}
test('draft-to-preview conversion excludes identifier alternatives outside the chosen attestation',()=>{
 const current={...draft,aNumber:'1234567',identifierKind:'PASSPORT',identifierNumber:'Synthetic123',passportCountry:'Canada',authorizationExpiresOn:'N/A'}
 assert.deepEqual(i9DraftToSection1(current,context).attestation,{kind:'CITIZEN'})
 assert.deepEqual(i9DraftToSection1({...current,attestationKind:'PERMANENT_RESIDENT'},context).attestation,{kind:'PERMANENT_RESIDENT',aNumber:'1234567'})
 assert.deepEqual(i9DraftToSection1({...current,attestationKind:'AUTHORIZED_WORKER'},context).attestation,{kind:'AUTHORIZED_WORKER',authorizationExpiresOn:'N/A',identifier:{kind:'PASSPORT',number:'Synthetic123',country:'Canada'}})
 assert.equal(current.identifierNumber,'Synthetic123')
})
test('unfinished drafts can be saved structurally but cannot become complete Section 1 previews',()=>{
 const partial=i9DraftInput({firstName:'Unfinished',ssn:'123-4'})
 assert.equal(partial.firstName,'Unfinished');assert.throws(()=>i9DraftToSection1(partial,context),{status:400})
 assert.throws(()=>i9DraftToSection1({...draft,preparerAssisted:null},context),/explicitly/)
 assert.throws(()=>i9DraftToSection1({...draft,attestationKind:'AUTHORIZED_WORKER',identifierKind:'PASSPORT',identifierNumber:'Partial',authorizationExpiresOn:'N/A'},context),/country/)
})
