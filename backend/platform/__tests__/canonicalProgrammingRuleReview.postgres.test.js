import assert from 'node:assert/strict'
import test from 'node:test'
import pg from 'pg'
import { canonicalProgrammingReviewRubric, loadCanonicalProgrammingRuleReviews } from '../canonicalProgrammingRuleReview.js'
import { withCoachingLibrarySnapshot } from '../coachingLibraryContext.js'
import { evaluateCanonicalProgrammingRules } from '../canonicalProgrammingRules.js'
import { ruleFixtures } from './canonicalProgrammingRulesFixtures.js'
import { SCOPE, uuid } from './workoutProgrammingLibrarianFixtures.js'
const connectionString = process.env.WORKOUT_PROGRAMMING_TEST_DATABASE_URL

test('current exact-variant execution rules require a matching real approval record', { skip: !connectionString }, async (t) => {
  const target = new URL(connectionString)
  assert.ok(['postgres:', 'postgresql:'].includes(target.protocol))
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname))
  assert.match(target.pathname, /^\/vortex_programming_test_[a-z0-9_]+$/)
  assert.equal([...target.searchParams].length, 0)
  const pool = new pg.Pool({ connectionString })
  try {
    // Dedicated empty database; no reset/drop and no real approvals are created.
    await pool.query(`CREATE SCHEMA coaching;
      CREATE TABLE coaching.exercise_definition_v1 (id UUID PRIMARY KEY, facility_id BIGINT, card_version INTEGER, status TEXT, approved_by BIGINT);
      CREATE TABLE coaching.exercise_variant_v1 (id UUID PRIMARY KEY, definition_id UUID, status TEXT, programming_profile_json JSONB);
      CREATE TABLE coaching.exercise_card_review_v1 (id BIGSERIAL PRIMARY KEY, definition_id UUID, reviewer_user_id BIGINT,
        reviewed_card_version INTEGER, decision TEXT, rubric_json JSONB, notes TEXT);`)
    const state = await ruleFixtures()
    const card = state.activity.card
    const foreign = { ...structuredClone(card), id: uuid(501), variantId: uuid(601) }
    for (const [entry, facility] of [[card, 9], [foreign, 10]]) {
      await pool.query("INSERT INTO coaching.exercise_definition_v1 VALUES ($1,$2,$3,'published',7)", [entry.id, facility, entry.cardVersion])
      await pool.query("INSERT INTO coaching.exercise_variant_v1 VALUES ($1,$2,'published',$3::jsonb)", [entry.variantId, entry.id, JSON.stringify(entry.programming)])
    }
    const approve = async (entry, actor = 7, version = entry.cardVersion, rubric = null, decision = 'approve') => pool.query(
      'INSERT INTO coaching.exercise_card_review_v1 (definition_id, reviewer_user_id, reviewed_card_version, decision, rubric_json, notes) VALUES ($1,$2,$3,$4,$5::jsonb,$6)',
      [entry.id, actor, version, decision, JSON.stringify(rubric ?? canonicalProgrammingReviewRubric({ variants: [{ id: entry.variantId, programming: entry.programming }] })), 'Synthetic observed review evidence for disposable tests.'])
    const load = () => withCoachingLibrarySnapshot(pool, SCOPE, (client, scope) => loadCanonicalProgrammingRuleReviews(client, scope.facilityId, [card, foreign]))
    await t.test('missing, foreign-actor and old-version reviews do not authorize rule execution', async () => {
      assert.equal((await load()).size, 0)
      await approve(card, 8)
      await approve(card, 7, card.cardVersion + 1)
      await approve(foreign)
      assert.equal((await load()).size, 0)
    })
    await t.test('current approval stamps round-trip through SQL and cover exact source content', async () => {
      await approve(card)
      const reviews = await load()
      assert.equal(reviews.size, 1)
      card.programmingRulesReview = reviews.get(card.variantId)
      assert.equal(evaluateCanonicalProgrammingRules({ ...state, activities: [state.activity] }).status, 'PASS')
      const currentProgramming = structuredClone(card.programming)
      card.programming.executionRules.rules[0].value = 3
      assert.ok(evaluateCanonicalProgrammingRules({ ...state, activities: [state.activity] }).findings.some((entry) => entry.code === 'unapproved_execution_rule_source'))
      card.programming = currentProgramming
      await pool.query("UPDATE coaching.exercise_variant_v1 SET status='draft' WHERE id=$1", [card.variantId])
      assert.equal((await load()).size, 0)
      await pool.query("UPDATE coaching.exercise_variant_v1 SET status='published' WHERE id=$1", [card.variantId])
    })
    await t.test('a newer unstamped approval or request-changes decision cannot fall back to an older stamp', async () => {
      await approve(card, 7, card.cardVersion, {})
      assert.equal((await load()).get(card.variantId).sourceHash, null)
      await approve(card)
      assert.ok((await load()).get(card.variantId).sourceHash)
      await approve(card, 7, card.cardVersion, {}, 'request_changes')
      assert.equal((await load()).get(card.variantId).sourceHash, null)
    })
  } finally { await pool.end() }
})
