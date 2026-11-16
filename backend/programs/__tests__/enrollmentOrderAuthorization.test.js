import assert from 'node:assert/strict'
import test from 'node:test'
import { registerNewAdminRoutes } from '../../newAdmin/registerRoutes.js'

for (const method of ['get','put']) {
  for (const allowed of [false,true]) {
    test(`${method.toUpperCase()} enrollment order requires classes.manage (${allowed ? 'granted' : 'denied'})`, async () => {
      const routes = new Map()
      const app = Object.fromEntries(['get','post','put','patch','delete','use'].map(verb => [verb,(path,...handlers) => routes.set(`${verb}:${path}`,handlers)]))
      const pool = { async query(sql, values) {
        if (sql.includes('FROM v_app_user_access_context')) return { rows: [{ user_id: 11, facility_id: 1, is_owner: false, is_active: true, can_access_admin_portal: true, storage_roles: ['ADMIN'] }] }
        assert.equal(values[2], 'classes.manage')
        return { rows: [{ base_allowed: allowed, override_effect: null }] }
      } }
      registerNewAdminRoutes(app,pool,{jwtSecret:'test-fixture'})
      const [authorize] = routes.get(`${method}:/api/admin/new-admin/enroll-order`)
      let next = false
      const res = { statusCode:200, status(value) { this.statusCode=value; return this }, json() {} }
      await authorize({ canonicalAccess:{userId:11,facilityId:1,portalAccess:{admin:true}} },res,()=>{next=true})
      assert.equal(next,allowed)
      assert.equal(res.statusCode,allowed ? 200 : 403)
      next=false
      await authorize({ canonicalAccess:{userId:11,facilityId:1,portalAccess:{admin:false}} },res,()=>{next=true})
      assert.equal(next,false)
      assert.equal(res.statusCode,403)
    })
  }
}
