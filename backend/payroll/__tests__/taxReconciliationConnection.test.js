import test from 'node:test'
import assert from 'node:assert/strict'
import {registerTaxReconciliationRoutes} from '../taxReconciliation.js'
const paths=['/api/admin/payroll/tax-deposits','/api/admin/payroll/tax-deposits/:id/void','/api/admin/payroll/tax-filings','/api/admin/payroll/tax-filings/:id/void']
const response=()=>({code:200,body:null,status(code){this.code=code;return this},json(body){this.body=body;return this}})
const routes=pool=>{const handlers=new Map();registerTaxReconciliationRoutes({get:(path,handler)=>handlers.set(path,handler),post:(path,handler)=>handlers.set(path,handler)},pool);return handlers}
for(const path of paths)test(`connection failure returns a controlled response for ${path}`,async()=>{
 const handlers=routes({connect:async()=>{throw new Error('synthetic private database connection details')}}),res=response()
 await handlers.get(path)({canonicalAccess:{facilityId:1},adminId:99,params:{id:1},body:{}},res)
 assert.equal(res.code,500);assert.deepEqual(res.body,{success:false,message:'Unable to save tax reconciliation.'})
})
test('failed transaction initialization attempts rollback, releases once and hides internal errors',async()=>{
 const queries=[];let released=0
 const handlers=routes({connect:async()=>({query:async sql=>{queries.push(sql);throw new Error('synthetic private transport detail')},release:()=>{released++}})}),res=response()
 await handlers.get(paths[0])({canonicalAccess:{facilityId:1},adminId:99,body:{}},res)
 assert.deepEqual(queries,['BEGIN','ROLLBACK']);assert.equal(released,1);assert.equal(res.code,500);assert.equal(res.body.message,'Unable to save tax reconciliation.')
})
