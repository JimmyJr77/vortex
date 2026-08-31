import test from 'node:test'
import assert from 'node:assert/strict'
import { CANONICAL_WAIVER_TEMPLATES } from '../canonicalWaiverBodies.js'
import { seedCanonicalWaivers } from '../seedCanonicalWaivers.js'

test('the canonical media release is voluntary', () => {
  const mediaRelease = CANONICAL_WAIVER_TEMPLATES.find(
    (template) => template.waiverType === 'MEDIA_RELEASE',
  )

  assert.ok(mediaRelease)
  assert.equal(mediaRelease.isRequired, false)
  assert.match(mediaRelease.body, /optional and is not a condition of enrollment or participation/i)
})

test('the canonical seed persists the media release as optional', async () => {
  const queries = []
  const pool = {
    query: async (sql, params = []) => {
      queries.push({ sql, params })
      if (/SELECT id FROM facility/.test(sql)) return { rows: [{ id: 17 }] }
      if (/RETURNING id/.test(sql)) return { rows: [] }
      return { rows: [] }
    },
  }

  await seedCanonicalWaivers(pool)

  const mediaReleaseInsert = queries.find(
    ({ sql, params }) => /INSERT INTO waiver_template/.test(sql) && params[4] === 'MEDIA_RELEASE',
  )
  assert.ok(mediaReleaseInsert)
  assert.equal(mediaReleaseInsert.params[5], false)
})
