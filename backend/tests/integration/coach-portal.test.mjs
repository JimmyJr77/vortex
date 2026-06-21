import assert from 'node:assert/strict'
import test from 'node:test'

// Coach Portal integration tests.
//
// These are gated like the rest of the integration suite. To run them against a
// live server, set:
//   RUN_INTEGRATION_TESTS=true
//   INTEGRATION_BASE_URL=https://your-host
//   COACH_JWT=<a valid coach/admin bearer token>   (required for coach routes)
// Optional, for the assignment + member-log round-trip:
//   MEMBER_JWT=<a valid member bearer token>
//   MEMBER_ID=<the member's id>
//   WORKOUT_ID=<an existing coaching.workout id to assign>

const baseUrl = process.env.INTEGRATION_BASE_URL
const coachJwt = process.env.COACH_JWT
const memberJwt = process.env.MEMBER_JWT
const memberId = process.env.MEMBER_ID
const workoutId = process.env.WORKOUT_ID

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true' && Boolean(baseUrl)
const runCoach = runIntegration && Boolean(coachJwt)
const runRoundTrip = runCoach && Boolean(memberJwt) && Boolean(memberId) && Boolean(workoutId)

async function jsonRequest(path, init = {}, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
    ...init,
  })
  const body = await response.json().catch(() => ({}))
  return { response, body }
}

test('coach portal suite gate', () => {
  if (!runCoach) {
    assert.ok(true, 'Coach portal tests are gated. Set RUN_INTEGRATION_TESTS=true, INTEGRATION_BASE_URL and COACH_JWT to run.')
  }
})

test('GET /api/coach/taxonomy returns seeded reference data', { skip: !runCoach }, async () => {
  const { response, body } = await jsonRequest('/api/coach/taxonomy', {}, coachJwt)
  assert.equal(response.status, 200)
  const data = body.data ?? body
  assert.ok(Array.isArray(data.tenets), 'tenets should be an array')
  assert.ok(data.tenets.length >= 8, 'expected the 8 tenets of athleticism to be seeded')
  assert.ok(Array.isArray(data.methodologies))
  assert.ok(Array.isArray(data.physiology))
})

test('GET /api/coach/exercises supports filtering', { skip: !runCoach }, async () => {
  const { response, body } = await jsonRequest('/api/coach/exercises?q=a', {}, coachJwt)
  assert.equal(response.status, 200)
  const data = body.data ?? body
  assert.ok(Array.isArray(data), 'exercise list should be an array')
})

test('POST /api/coach/needs-engine/prescribe returns time-packed blocks', { skip: !runCoach }, async () => {
  const { response, body } = await jsonRequest(
    '/api/coach/needs-engine/prescribe',
    {
      method: 'POST',
      body: JSON.stringify({
        skillLevel: null,
        targets: [],
        blocks: [{ label: 'Main', intentId: null, minutes: 10 }],
      }),
    },
    coachJwt,
  )
  assert.equal(response.status, 200)
  const data = body.data ?? body
  assert.ok(Array.isArray(data.blocks), 'prescription should return blocks')
  assert.equal(data.blocks.length, 1)
  assert.equal(data.blocks[0].label, 'Main')
})

test('assignment + member completion log round-trip', { skip: !runRoundTrip }, async () => {
  // Coach assigns a workout to the member.
  const assignRes = await jsonRequest(
    '/api/coach/assignments',
    {
      method: 'POST',
      body: JSON.stringify({
        target_type: 'member',
        target_id: Number(memberId),
        assignable_type: 'workout',
        assignable_id: Number(workoutId),
        title: 'Integration test assignment',
      }),
    },
    coachJwt,
  )
  assert.equal(assignRes.response.status, 200)
  const assignment = assignRes.body.data ?? assignRes.body
  assert.ok(assignment.id, 'assignment should have an id')

  // Member sees the assignment.
  const listRes = await jsonRequest('/api/member/training/assignments', {}, memberJwt)
  assert.equal(listRes.response.status, 200)
  const assignments = listRes.body.data ?? listRes.body
  assert.ok(Array.isArray(assignments))
  assert.ok(assignments.some((a) => a.id === assignment.id), 'member should see the new assignment')

  // Member logs completion.
  const logRes = await jsonRequest(
    '/api/member/training/log',
    {
      method: 'POST',
      body: JSON.stringify({ assignment_id: assignment.id, workout_id: Number(workoutId), status: 'completed', reps: 10, rpe: 7 }),
    },
    memberJwt,
  )
  assert.equal(logRes.response.status, 200)
  const log = logRes.body.data ?? logRes.body
  assert.ok(log.id, 'completion log should have an id')

  // Coach can read the completion back.
  const completionsRes = await jsonRequest(`/api/coach/completions?memberId=${memberId}`, {}, coachJwt)
  assert.equal(completionsRes.response.status, 200)
  const completions = completionsRes.body.data ?? completionsRes.body
  assert.ok(completions.some((c) => c.id === log.id), 'coach should see the logged completion')
})

test('coach routes reject unauthenticated requests', { skip: !runIntegration }, async () => {
  const { response } = await jsonRequest('/api/coach/taxonomy')
  assert.ok([401, 403].includes(response.status), 'unauthenticated coach request should be rejected')
})
