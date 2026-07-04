import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizePortalConfig } from '../../platform/portalSettings.js'

test('normalizePortalConfig drops invalid and locked tabs', () => {
  const config = normalizePortalConfig({
    member: { hiddenTabs: ['progress', 'events', 'home', 'bogus'] },
    coach: { hiddenTabs: ['insights', 'home'] },
  })
  assert.deepEqual(config.member.hiddenTabs, ['progress', 'events'])
  assert.deepEqual(config.coach.hiddenTabs, ['insights'])
})

test('normalizePortalConfig defaults to empty hidden lists', () => {
  assert.deepEqual(normalizePortalConfig(null), {
    member: { hiddenTabs: [] },
    coach: { hiddenTabs: [] },
  })
})
