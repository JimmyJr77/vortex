import assert from 'node:assert/strict'
import test from 'node:test'

/** Mirrors coachPortalRoutes exercise list difficulty WHERE clauses. */
function difficultyWhere(minOverall, maxOverall, params = []) {
  const where = []
  if (minOverall != null && maxOverall != null) {
    params.push(minOverall, maxOverall)
    where.push(`EXISTS (
      SELECT 1 FROM coaching.exercise_difficulty_profile d
      WHERE d.exercise_id = e.id AND d.overall >= $${params.length - 1} AND d.overall <= $${params.length}
    )`)
  } else if (minOverall != null) {
    params.push(minOverall)
    where.push(`EXISTS (SELECT 1 FROM coaching.exercise_difficulty_profile d WHERE d.exercise_id = e.id AND d.overall >= $${params.length})`)
  } else if (maxOverall != null) {
    params.push(maxOverall)
    where.push(`EXISTS (SELECT 1 FROM coaching.exercise_difficulty_profile d WHERE d.exercise_id = e.id AND d.overall <= $${params.length})`)
  }
  return { where, params }
}

test('difficulty range uses single EXISTS with both bounds', () => {
  const { where, params } = difficultyWhere(5, 6, [])
  assert.equal(params.length, 2)
  assert.match(where[0], /overall >= \$1 AND d\.overall <= \$2/)
})

test('youth-safe preset max only applies upper bound', () => {
  const { where, params } = difficultyWhere(null, 4, [])
  assert.deepEqual(params, [4])
  assert.match(where[0], /overall <= \$1/)
  assert.doesNotMatch(where[0], />=/)
})
