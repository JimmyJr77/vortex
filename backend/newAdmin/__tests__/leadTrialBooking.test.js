import test from 'node:test'
import assert from 'node:assert/strict'
import { registerNewAdminRoutes } from '../registerRoutes.js'

test('staff lead trial booking requires member editing and scheduling permission on reads and writes',async()=>{
  const routes=[]
  const app={use(){},patch(){},put(){},delete(){},get(path,...chain){if(path.endsWith('/trial-booking'))routes.push(chain)},
    post(path,...chain){if(path.endsWith('/trial-booking'))routes.push(chain)}}
  registerNewAdminRoutes(app,{query:()=>assert.fail('Denied booking access cannot touch data')},{jwtSecret:'test-only'})
  assert.equal(routes.length,2)
  for(const chain of routes)for(const [index,key] of ['members.edit','scheduling.manage'].entries()){
    const req={canonicalAccess:{portalAccess:{admin:true},facilityId:1},newAdminPermissions:new Map([[key,Promise.resolve(false)]])}
    const res={status(value){this.statusCode=value;return this},json(body){this.body=body}}
    await chain[index](req,res,()=>assert.fail('Denied booking permission cannot reach the handler'))
    assert.equal(res.statusCode,403)
    assert.match(res.body.message,new RegExp(key.replace('.','\\.')))
  }
})
