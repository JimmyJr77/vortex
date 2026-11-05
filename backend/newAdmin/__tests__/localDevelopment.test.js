import test from 'node:test'
import assert from 'node:assert/strict'
import {localDevelopmentConfig,localChildEnvironment,isIsolatedAdminDevelopment} from '../localDevelopment.js'

const base={NODE_ENV:'development',LOCAL_DEV_SEED:'true',NEW_ADMIN_DATABASE_URL:'postgresql://local:secret@127.0.0.1:5432/vortex_new_admin_dev_test'}
test('local seed rejects production, remote, non-dedicated, redirected and live Stripe targets',()=>{
  for(const changed of [{NODE_ENV:'production'},{LOCAL_DEV_SEED:'false'},{STRIPE_ENABLED:'true'},
    {STRIPE_SECRET_KEY:'sk_live_example'},
    {NEW_ADMIN_DATABASE_URL:'postgresql://remote.example/vortex_new_admin_dev'},
    {NEW_ADMIN_DATABASE_URL:'postgresql://127.0.0.1/vortex_athletics'},
    {NEW_ADMIN_DATABASE_URL:'postgresql://127.0.0.1/vortex_new_admin_dev?host=remote.example'},
    {NEW_ADMIN_DATABASE_URL:'https://127.0.0.1/vortex_new_admin_dev'}]) {
    assert.throws(()=>localDevelopmentConfig({...base,...changed}))
  }
})
test('launcher overrides ambient database/payment/mail configuration without changing the caller',()=>{
  const ambient={...base,DATABASE_URL:'postgresql://remote.example/production',STRIPE_ENABLED:'true',STRIPE_SECRET_KEY:'sk_live_example',EMAIL_KILL_SWITCH:'false'}
  const env=localChildEnvironment(localDevelopmentConfig(base),ambient)
  assert.equal(env.DATABASE_URL,base.NEW_ADMIN_DATABASE_URL)
  assert.equal(env.DB_NAME,'vortex_new_admin_dev_test')
  assert.equal(env.STRIPE_ENABLED,'false')
  assert.equal(env.STRIPE_SECRET_KEY,'')
  assert.equal(env.EMAIL_KILL_SWITCH,'true')
  assert.equal(ambient.STRIPE_ENABLED,'true')
  assert.equal(isIsolatedAdminDevelopment(env),true)
  assert.equal(isIsolatedAdminDevelopment({...env,DB_NAME:'vortex_athletics'}),false)
  assert.equal(isIsolatedAdminDevelopment({...env,NODE_ENV:'production'}),false)
})
