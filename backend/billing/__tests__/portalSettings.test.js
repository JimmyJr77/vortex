import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePortalConfig } from '../../platform/portalSettings.js'

test('normalizePortalConfig drops invalid and locked tabs', () => {
  const config = normalizePortalConfig({
    member: { hiddenTabs: ['progress', 'events', 'home', 'bogus'], tabOrder: ['billing', 'home', 'bogus'] },
    coach: { hiddenTabs: ['insights', 'home'], tabOrder: ['roster', 'sessions'] },
  })
  assert.deepEqual(config.member.hiddenTabs, ['progress', 'events'])
  assert.deepEqual(config.coach.hiddenTabs, ['insights'])
  assert.deepEqual(config.member.tabOrder.slice(0, 2), ['billing', 'home'])
  assert.deepEqual(config.coach.tabOrder.slice(0, 2), ['roster', 'sessions'])
})

test('normalizePortalConfig defaults to empty hidden lists and canonical order', () => {
  const config = normalizePortalConfig(null)
  assert.deepEqual(config.member.hiddenTabs, [])
  assert.deepEqual(config.coach.hiddenTabs, [])
  assert.deepEqual(config.member.tabOrder, [
    'home',
    'profile',
    'classes',
    'training',
    'progress',
    'messages',
    'events',
    'billing',
    'waivers',
    'preferences',
  ])
  assert.deepEqual(config.coach.tabOrder.slice(0, 4), ['home', 'sessions', 'needs', 'library'])
})
