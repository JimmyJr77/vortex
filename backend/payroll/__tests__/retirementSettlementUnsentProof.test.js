import test from 'node:test'
import assert from 'node:assert/strict'
import {retirementSettlementUnsentProof} from '../retirementSettlementUnsentProof.js'
const fixture=()=>{
 const authorization={id:'authorization',preview:{realmId:'123',environment:'sandbox',journals:[{event:{key:'bank-movement'},payload:{amount:14}}]}}
 const jobs=[{id:'journal',authorization_id:authorization.id,realm_id:'123',environment:'sandbox',event_key:'bank-movement',payload:{amount:14},observations:[{id:'1',source:'SUBMISSION',create_attempted:false,result:{status:'NOT_SENT'}},{id:'2',source:'RECOVERY',create_attempted:false,result:{status:'NOT_FOUND'}}]}]
 return {authorization,jobs}
}
test('retirement unsent proof requires exact original jobs and affirmative ordered no-create evidence',()=>{
 const {authorization,jobs}=fixture()
 assert.deepEqual(retirementSettlementUnsentProof(authorization,jobs),{eligible:true,evidence:[{journalId:'journal',submissionObservationId:'1'}]})
 for(const mutate of [j=>j.pop(),j=>j.push(structuredClone(j[0])),j=>j[0].authorization_id='other',j=>j[0].realm_id='456',j=>j[0].environment='production',j=>j[0].payload.amount=15,j=>j[0].event_key='different',j=>j[0].observations.shift(),j=>j[0].observations[0].id='3',j=>delete j[0].observations[0].create_attempted,j=>j[0].observations[0].create_attempted=true]){
  const changed=structuredClone(jobs);mutate(changed);assert.equal(retirementSettlementUnsentProof(authorization,changed).eligible,false)
 }
})
test('missing, uncertain, partially posted and contradictory retirement journals never establish non-send',()=>{
 for(const status of ['NOT_FOUND','UNCERTAIN','SYNCED','NEEDS_REVIEW','CONNECTION_CHANGED',undefined]){
  const {authorization,jobs}=fixture();jobs[0].observations[0].result.status=status;assert.equal(retirementSettlementUnsentProof(authorization,jobs).eligible,false)
 }
 for(const status of ['UNCERTAIN','SYNCED','NEEDS_REVIEW','NOT_SENT']){
  const {authorization,jobs}=fixture();jobs[0].observations[1].result.status=status;assert.equal(retirementSettlementUnsentProof(authorization,jobs).eligible,false)
 }
 const {authorization,jobs}=fixture();authorization.preview.journals.push({event:{key:'second'},payload:{amount:2}});assert.equal(retirementSettlementUnsentProof(authorization,jobs).eligible,false)
})
