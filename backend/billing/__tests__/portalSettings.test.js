import test from 'node:test'
import assert from 'node:assert/strict'
import {
  COACH_PORTAL_TAB_KEYS,
  COACH_PORTAL_TAB_LABELS,
  DEFAULT_COACH_PORTAL_NAV_LAYOUT,
  MEMBER_PORTAL_TAB_KEYS,
  MEMBER_PORTAL_TAB_LABELS,
  normalizePortalConfig,
} from '../../platform/portalSettings.js'

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
    'store',
    'billing',
    'waivers',
    'preferences',
  ])
  assert.deepEqual(config.coach.tabOrder, DEFAULT_COACH_PORTAL_NAV_LAYOUT.filter((item) => item.type === 'tab').map((item) => item.key))
  assert.deepEqual(config.coach.navLayout, DEFAULT_COACH_PORTAL_NAV_LAYOUT)
  assert.ok(config.coach.tabOrder.includes('flip-fit'))
})

test('member portal preserves the Store selection', () => {
  const config = normalizePortalConfig({
    member: { hiddenTabs: ['store'], tabOrder: ['home', 'store', 'billing'] },
  })
  assert.ok(MEMBER_PORTAL_TAB_KEYS.includes('store'))
  assert.equal(MEMBER_PORTAL_TAB_LABELS.store, 'Store')
  assert.deepEqual(config.member.hiddenTabs, ['store'])
  assert.deepEqual(config.member.tabOrder.slice(0, 3), ['home', 'store', 'billing'])
})

test('coach portal exposes the renamed planning tabs and labels', () => {
  assert.ok(COACH_PORTAL_TAB_KEYS.includes('flip-fit'))
  assert.equal(COACH_PORTAL_TAB_LABELS['flip-fit'], 'Fit & Flip')
  assert.equal(COACH_PORTAL_TAB_LABELS.needs, 'Program Generator')
  assert.equal(COACH_PORTAL_TAB_LABELS['program-planner'], 'Program Planner')
  assert.equal(COACH_PORTAL_TAB_LABELS['prepare-access'], 'Prepare & Access')
  assert.equal(COACH_PORTAL_TAB_LABELS['athleticism-accelerator'], 'Custom Programs')
  assert.equal(COACH_PORTAL_TAB_LABELS.programs, 'ABC Progressions')
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
    'assign',
    'training-blocks',
    'regimens',
    'faqs',
    'preferences',
  ]
  const config = normalizePortalConfig({ coach: { tabOrder: customOrder } })
  const expectedOrder = ['home', 'sessions', 'messages', 'roster', 'framework', 'library', 'needs', 'program-planner', 'assign', 'faqs', 'preferences']
  assert.deepEqual(config.coach.tabOrder.slice(0, expectedOrder.length), expectedOrder)
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
  assert.deepEqual(config.coach.tabOrder.slice(0, 4), ['home', 'sessions', 'program-planner', 'gymnastics-evaluations'])
  const athleteDevelopmentIndex = config.coach.navLayout.findIndex((item) => item.type === 'section' && item.id === 'athlete-dev')
  assert.equal(config.coach.navLayout[athleteDevelopmentIndex + 1].key, 'gymnastics-evaluations')
})

test('normalizePortalConfig keeps training plans together in canonical order', () => {
  const config = normalizePortalConfig({
    coach: {
      navLayout: [
        { type: 'tab', key: 'home' },
        { type: 'tab', key: 'flip-fit' },
        { type: 'section', id: 'training-plans', label: 'Training Plans' },
        { type: 'tab', key: 'programs' },
        { type: 'tab', key: 'sessions' },
        { type: 'tab', key: 'athleticism-accelerator' },
        { type: 'tab', key: 'prepare-access' },
      ],
    },
  })
  const sectionIndex = config.coach.navLayout.findIndex((item) => item.type === 'section' && item.id === 'training-plans')
  assert.deepEqual(
    config.coach.navLayout.slice(sectionIndex + 1, sectionIndex + 5).map((item) => item.key),
    ['prepare-access', 'athleticism-accelerator', 'programs', 'flip-fit'],
  )
})

test('legacy builder tabs collapse into one Program Planner entry', () => {
  const config = normalizePortalConfig({ coach: {
    hiddenTabs: ['workout', 'training-blocks', 'regimens'],
    navLayout: [
      { type: 'tab', key: 'home' },
      { type: 'section', id: 'session-design', label: 'Session Design' },
      { type: 'tab', key: 'workout' },
      { type: 'tab', key: 'training-blocks' },
      { type: 'tab', key: 'regimens' },
    ],
  } })
  assert.equal(config.coach.navLayout.filter((item) => item.key === 'program-planner').length, 1)
  assert.equal(config.coach.navLayout.some((item) => ['workout', 'training-blocks', 'regimens'].includes(item.key)), false)
  assert.deepEqual(config.coach.hiddenTabs, [])
  assert.deepEqual(normalizePortalConfig(config), config)
})
