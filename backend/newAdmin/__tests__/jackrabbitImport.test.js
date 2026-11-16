import test from 'node:test'
import assert from 'node:assert/strict'
import {planJackrabbitImport,sourceHash,resolveJackrabbitImportOptions} from '../jackrabbitImport.js'

const packet=()=>({organizationId:'557920',contacts:[{'Jackrabbit Family ID':'10',Family:'Smith',Name:'Avery Smith',Email:'avery@example.test'}],students:[{'Jackrabbit Family ID':'10','Student ID':'20',Family:'Smith','Student First Name':'Taylor','Student Last Name':'Smith',DOB:'2015-01-01'}],enrollments:[],transactions:[]})
test('source fingerprint is stable across JSONB property ordering',()=>assert.equal(sourceHash({z:1,a:{b:2,a:3}}),sourceHash({a:{a:3,b:2},z:1})))
test('merge household from name and email; retain source birth date conflict',()=>{
 const result=planJackrabbitImport(packet(),[{id:1,first_name:'Avery',last_name:'Smith',email:'avery@example.test',family_id:5},{id:2,first_name:'Taylor',last_name:'Smith',date_of_birth:'2014-01-01',family_id:5}])
 assert.equal(result[0].familyId,'5');assert.equal(result[0].people[1].memberId,2);assert.deepEqual(result[0].people[1].conflicts,['date_of_birth'])
})
test('repeated surnames use original household ID',()=>{
 const data=packet();data.contacts.push({'Jackrabbit Family ID':'11',Family:'Smith',Name:'Other Smith',Email:'other@example.test'})
 const result=planJackrabbitImport(data,[])
 assert.equal(result[0].students.length,1);assert.equal(result[1].students.length,0)
})
test('conflicting household evidence fails before import',()=>{
 const data=packet();data.contacts.push({'Jackrabbit Family ID':'10',Family:'Smith',Name:'Other Smith',Email:'other@example.test'})
 assert.throws(()=>planJackrabbitImport(data,[{id:1,first_name:'Avery',last_name:'Smith',email:'avery@example.test',family_id:5},{id:2,first_name:'Other',last_name:'Smith',email:'other@example.test',family_id:6}]),/Conflicting/)
})
test('duplicate financial source IDs fail rather than double count',()=>{
 const data=packet();data.transactions=[{'Trans ID':'1',amountCents:100},{'Trans ID':'1',amountCents:100}]
 assert.throws(()=>planJackrabbitImport(data,[]),/duplicated/)
})

test('distinct student IDs sharing a normalized household name fail instead of losing an identity',()=>{
 for(const dob of ['2015-01-01','2016-01-01']) {
  const data=packet()
  data.students.push({...data.students[0],'Student ID':'21','Student First Name':' tAYLOR ',DOB:dob})
  assert.throws(()=>planJackrabbitImport(data,[]),/Conflicting source student identities/)
 }
})

test('a repeated student ID with contradictory birth dates also fails closed',()=>{
 const data=packet()
 data.students.push({...data.students[0],DOB:'2016-01-01'})
 assert.throws(()=>planJackrabbitImport(data,[]),/Conflicting source student identities/)
})

test('one contact and its matching student identity remain one person',()=>{
 const data=packet()
 data.contacts.push({'Jackrabbit Family ID':'10',Family:'Smith',Name:'Taylor Smith',Email:'taylor@example.test'})
 data.students.push({...data.students[0]})
 const people=planJackrabbitImport(data,[])[0].people
 assert.equal(people.length,2)
 assert.equal(people.filter(person=>person.student).length,1)
 assert.equal(people.find(person=>person.student).contact.Email,'taylor@example.test')
})

test('import apply refuses ambiguous modes and ambient production destinations',()=>{
 const environment={EXTERNAL_DB_URL:'postgresql://importer@production.example/vortex_postgres',JACKRABBIT_IMPORT_DATABASE_URL:'postgresql://saved@production.example/vortex_postgres'}
 assert.throws(()=>resolveJackrabbitImportOptions(['--source=private.json','--apply','--rehearse'],{environment,explicitDatabaseUrl:environment.EXTERNAL_DB_URL}),/not both/)
 assert.throws(()=>resolveJackrabbitImportOptions(['--source=private.json','--apply'],{environment}),/explicitly supplied/)
 assert.throws(()=>resolveJackrabbitImportOptions(['--source=private.json'],{}),/valid PostgreSQL/)
})

test('explicit import destinations override defaults and keep local PostgreSQL usable',()=>{
 const explicitDatabaseUrl='postgresql://local@127.0.0.1:5432/vortex_new_admin_dev_import'
 const environment={EXTERNAL_DB_URL:'postgresql://importer@production.example/vortex_postgres'}
 const options=resolveJackrabbitImportOptions(['--source=private.json','--apply'],{environment,explicitDatabaseUrl})
 assert.equal(options.apply,true)
 assert.equal(options.connectionString,explicitDatabaseUrl)
 assert.equal(options.ssl,false)
 const rehearsal=resolveJackrabbitImportOptions(['--source=private.json','--rehearse'],{environment})
 assert.equal(rehearsal.apply,false)
 assert.equal(rehearsal.connectionString,environment.EXTERNAL_DB_URL)
})

test('import destinations reject redirection parameters and non-PostgreSQL URLs',()=>{
 for(const explicitDatabaseUrl of ['postgresql://localhost/vortex_new_admin_dev?host=remote.example','postgresql://localhost/vortex_new_admin_dev#fragment','https://localhost/vortex_new_admin_dev','postgresql://localhost/']) {
  assert.throws(()=>resolveJackrabbitImportOptions(['--source=private.json','--apply'],{explicitDatabaseUrl}),/explicit PostgreSQL/)
 }
})

test('reviewed source mapping preserves a merge with an abbreviated existing name',()=>{
 const members=[{id:1,first_name:'Avery',last_name:'Smith',email:'avery@example.test',family_id:5},
   {id:2,first_name:'Taylor',last_name:'S',family_id:5},
   {id:3,first_name:'Taylor',last_name:'Smith',family_id:null}]
 const prior=[{record_kind:'family',source_id:'10',family_id:5},{record_kind:'person',source_id:'10:taylorsmith',member_id:2}]
 assert.equal(planJackrabbitImport(packet(),members,prior)[0].people[1].memberId,2)
 assert.throws(()=>planJackrabbitImport(packet(),members.filter(m=>m.id!==2),prior),/outside the source household/)
})
