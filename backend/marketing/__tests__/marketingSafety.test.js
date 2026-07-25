import assert from 'node:assert/strict'
import test from 'node:test'
import { channelReadiness, findEmbeddedSecrets } from '../registerRoutes.js'

test('findEmbeddedSecrets reports nested credential values', () => {
  assert.deepEqual(
    findEmbeddedSecrets({
      publicId: '123',
      auth: { access_token: 'do-not-store-this' },
      destinations: [{ apiKey: 'also-sensitive' }],
    }),
    ['auth.access_token', 'destinations.0.apiKey'],
  )
})

test('findEmbeddedSecrets permits public settings and empty credential placeholders', () => {
  assert.deepEqual(
    findEmbeddedSecrets({
      reviews_enabled: true,
      verification_method: 'DNS',
      refresh_token: '',
    }),
    [],
  )
})

test('channelReadiness explains blockers for incomplete critical work', () => {
  assert.deepEqual(
    channelReadiness({
      ownerName: '',
      status: 'planned',
      inputs: { property_url: 'https://vortexathletics.com', sitemap_url: '' },
      nextReviewAt: null,
    }),
    {
      ready: false,
      blockers: [
        'Internal owner is not assigned',
        'Missing inputs: sitemap_url',
        'Next review date is not scheduled',
        'Status is planned',
      ],
      completedInputs: 1,
      totalInputs: 2,
    },
  )
})

test('channelReadiness accepts owned, scheduled, configured active work', () => {
  const readiness = channelReadiness({
    ownerName: 'Marketing lead',
    status: 'active',
    inputs: { platforms: ['Google', 'Facebook'], response_sla_hours: 48 },
    nextReviewAt: '2026-08-01',
  })
  assert.equal(readiness.ready, true)
  assert.deepEqual(readiness.blockers, [])
})
