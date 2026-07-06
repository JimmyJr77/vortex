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
    'faqs',
    'events',
    'billing',
    'waivers',
    'preferences',
  ])
  assert.deepEqual(config.coach.tabOrder.slice(0, 4), ['home', 'sessions', 'needs', 'library'])
})

test('normalizePortalConfig preserves custom coach order for all portal tabs', () => {
  const customOrder = [
    'home',
    'sessions',
    'messages',
    'roster',
    'framework',
    'library',
    'needs',
    'workout',
    'warmup',
    'assign',
    'training-blocks',
    'regimens',
    'faqs',
    'preferences',
  ]
  const config = normalizePortalConfig({ coach: { tabOrder: customOrder } })
  assert.deepEqual(config.coach.tabOrder.slice(0, customOrder.length), customOrder)
  assert.ok(config.coach.tabOrder.includes('programs'))
  assert.ok(config.coach.tabOrder.includes('insights'))
})

test('normalizePortalConfig preserves nav layout section breaks and tab order', () => {
  const config = normalizePortalConfig({
    coach: {
      navLayout: [
        { type: 'tab', key: 'home' },
        { type: 'section', id: 'session-design', label: 'Session Design' },
        { type: 'tab', key: 'sessions' },
        { type: 'tab', key: 'workout' },
        { type: 'section', id: 'athlete-dev', label: 'Athlete Development' },
        { type: 'tab', key: 'skills' },
        { type: 'tab', key: 'bogus' },
      ],
    },
  })
  assert.ok(config.coach.navLayout.some((item) => item.type === 'section' && item.label === 'Session Design'))
  assert.ok(config.coach.navLayout.some((item) => item.type === 'section' && item.label === 'Athlete Development'))
  assert.deepEqual(config.coach.tabOrder.slice(0, 4), ['home', 'sessions', 'workout', 'skills'])
})
