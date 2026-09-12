import test from 'node:test'
import assert from 'node:assert/strict'
import {i9DraftInput} from '../i9DraftInput.js'
test('I-9 drafts preserve incomplete identity and unanswered choices without attesting',()=>{
 const blank=i9DraftInput({});assert.equal(blank.ssnPending,null);assert.equal(blank.preparerAssisted,null);assert.equal(blank.attestationKind,'')
 const partial=i9DraftInput({firstName:'Łukasz',ssn:'123-4',dateOfBirth:'2000-0',attestationKind:'AUTHORIZED_WORKER',identifierKind:'PASSPORT',identifierNumber:'Partial',preparerAssisted:true})
 assert.equal(partial.firstName,'Łukasz');assert.equal(partial.ssn,'123-4');assert.equal(partial.preparerAssisted,true);assert.equal(partial.passportCountry,'')
 assert.deepEqual(i9DraftInput(partial),partial)
})
test('I-9 drafts reject signature/decision injection and invalid data shapes',()=>{
 for(const input of [{signature:'Signer'},{signedOn:'2026-09-12'},{employerApproved:true},{personal:{ssn:'123'}},{ssn:'abc'},{dateOfBirth:'tomorrow'},{preparerAssisted:'false'},{attestationKind:'ASSUMED_CITIZEN'},{lastName:'a\u0000b'},[]])assert.throws(()=>i9DraftInput(input),{status:400})
})
