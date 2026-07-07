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
const runMember = runIntegration && Boolean(memberJwt)
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
        blocks: [{ label: 'Main', phaseKey: 'capacity', minutes: 10 }],
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

test('POST /api/coach/needs-engine/prescribe with age 6-8 strength returns audience_profile', { skip: !runCoach }, async () => {
  const strengthTenet = (await jsonRequest('/api/coach/taxonomy', {}, coachJwt)).body?.data?.tenets
    ?.find((t) => String(t.name).toLowerCase() === 'strength')
  const { response, body } = await jsonRequest(
    '/api/coach/needs-engine/prescribe',
    {
      method: 'POST',
      body: JSON.stringify({
        ageMin: 6,
        ageMax: 8,
        sessionObjective: 'strength_priority',
        skillLevel: 'BEGINNER',
        targets: strengthTenet ? [{ facetType: 'tenet', facetId: strengthTenet.id, weight: 5 }] : [],
        blocks: [
          { label: 'Prepare', phaseKey: 'prepare_and_access', minutes: 8 },
          { label: 'Capacity', phaseKey: 'capacity', minutes: 20 },
        ],
      }),
    },
    coachJwt,
  )
  assert.equal(response.status, 200)
  const data = body.data ?? body
  assert.ok(data.audience_profile, 'should return audience_profile')
  assert.equal(data.audience_profile.caps.maxOverall, 5)
  assert.ok(Array.isArray(data.blocks))
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

test('GET /api/coach/notifications returns list + unread count', { skip: !runCoach }, async () => {
  const { response, body } = await jsonRequest('/api/coach/notifications', {}, coachJwt)
  assert.equal(response.status, 200)
  const data = body.data ?? body
  assert.ok(Array.isArray(data.notifications), 'notifications should be an array')
  assert.ok(typeof data.unreadCount === 'number', 'unreadCount should be a number')
})

test('GET /api/member/notifications returns list + unread count', { skip: !runMember }, async () => {
  const { response, body } = await jsonRequest('/api/member/notifications', {}, memberJwt)
  assert.equal(response.status, 200)
  const data = body.data ?? body
  assert.ok(Array.isArray(data.notifications), 'notifications should be an array')
  assert.ok(typeof data.unreadCount === 'number', 'unreadCount should be a number')
})

test('member notification mark-read round-trip', { skip: !runRoundTrip }, async () => {
  const assignRes = await jsonRequest(
    '/api/coach/assignments',
    {
      method: 'POST',
      body: JSON.stringify({
        target_type: 'member',
        target_id: Number(memberId),
        assignable_type: 'workout',
        assignable_id: Number(workoutId),
        title: 'Notification test assignment',
        visibility: 'athlete',
      }),
    },
    coachJwt,
  )
  assert.equal(assignRes.response.status, 200)

  const listRes = await jsonRequest('/api/member/notifications?unreadOnly=true', {}, memberJwt)
  assert.equal(listRes.response.status, 200)
  const listData = listRes.body.data ?? listRes.body
  const unread = listData.notifications.filter((n) => n.kind === 'assignment')
  assert.ok(unread.length > 0, 'assignment should create an in-app notification')
  const notificationId = unread[0].id

  const readRes = await jsonRequest(`/api/member/notifications/${notificationId}/read`, { method: 'PATCH' }, memberJwt)
  assert.equal(readRes.response.status, 200)
  const readRow = readRes.body.data ?? readRes.body
  assert.ok(readRow.read_at, 'notification should be marked read')
})

test('GET /api/coach/skill-tree returns nodes and edges', { skip: !runCoach }, async () => {
  const { response, body } = await jsonRequest('/api/coach/skill-tree', {}, coachJwt)
  assert.equal(response.status, 200)
  const data = body.data ?? body
  assert.ok(Array.isArray(data.nodes))
  assert.ok(Array.isArray(data.edges))
})

test('GET /api/coach/athletes/:id/load returns load metrics', { skip: !runRoundTrip }, async () => {
  const { response, body } = await jsonRequest(`/api/coach/athletes/${memberId}/load`, {}, coachJwt)
  assert.equal(response.status, 200)
  const data = body.data ?? body
  assert.ok(Array.isArray(data.series))
  assert.ok(['high', 'low', 'ok', 'insufficient'].includes(data.flag))
})

test('GET /api/coach/messages returns thread list', { skip: !runCoach }, async () => {
  const { response, body } = await jsonRequest('/api/coach/messages', {}, coachJwt)
  assert.equal(response.status, 200)
  const data = body.data ?? body
  assert.ok(Array.isArray(data))
})

test('coach message thread round-trip', { skip: !runRoundTrip }, async () => {
  const createRes = await jsonRequest(
    '/api/coach/messages',
    {
      method: 'POST',
      body: JSON.stringify({
        member_id: Number(memberId),
        subject: 'Integration test thread',
        body: 'Hello from coach integration test',
      }),
    },
    coachJwt,
  )
  assert.equal(createRes.response.status, 200)
  const created = createRes.body.data ?? createRes.body
  const threadId = created.thread?.id
  assert.ok(threadId)

  const memberList = await jsonRequest('/api/member/messages', {}, memberJwt)
  assert.equal(memberList.response.status, 200)
  const threads = memberList.body.data ?? memberList.body
  assert.ok(threads.some((t) => t.id === threadId))

  const replyRes = await jsonRequest(
    `/api/member/messages/${threadId}`,
    { method: 'POST', body: JSON.stringify({ body: 'Reply from member' }) },
    memberJwt,
  )
  assert.equal(replyRes.response.status, 200)
})

test('video submission assignment round-trip', { skip: !runRoundTrip }, async () => {
  const assignRes = await jsonRequest(
    '/api/coach/assignments',
    {
      method: 'POST',
      body: JSON.stringify({
        target_type: 'member',
        target_id: Number(memberId),
        assignable_type: 'video_submission',
        title: 'Integration handstand check',
        due_date: null,
        notes: 'Show full handstand from side angle.',
      }),
    },
    coachJwt,
  )
  assert.equal(assignRes.response.status, 200)
  const assignment = assignRes.body.data ?? assignRes.body
  assert.equal(assignment.assignable_type, 'video_submission')

  const listRes = await jsonRequest('/api/member/training/video-submission-assignments', {}, memberJwt)
  assert.equal(listRes.response.status, 200)
  const requests = listRes.body.data ?? listRes.body
  assert.ok(Array.isArray(requests))
  assert.ok(requests.some((r) => r.id === assignment.id), 'member should see video submission request')

  const submitRes = await jsonRequest(
    '/api/member/training/form-reviews',
    {
      method: 'POST',
      body: JSON.stringify({
        assignment_id: assignment.id,
        video_url: 'https://res.cloudinary.com/demo/video/upload/sample.mp4',
        duration_seconds: 5,
        athlete_comment: 'First attempt',
        self_critique: 'Need straighter line',
        athlete_questions: 'Is my shoulder open enough?',
      }),
    },
    memberJwt,
  )
  assert.equal(submitRes.response.status, 200)
  const submission = submitRes.body.data ?? submitRes.body
  assert.ok(submission.id)

  const pendingRes = await jsonRequest('/api/coach/form-reviews?status=pending', {}, coachJwt)
  assert.equal(pendingRes.response.status, 200)
  const pending = pendingRes.body.data ?? pendingRes.body
  assert.ok(pending.some((p) => p.id === submission.id), 'coach should see pending submission')

  const reviewRes = await jsonRequest(
    `/api/coach/form-reviews/${submission.id}/review`,
    {
      method: 'POST',
      body: JSON.stringify({ note: 'Good effort — stack hips over shoulders.' }),
    },
    coachJwt,
  )
  assert.equal(reviewRes.response.status, 200)

  const statusRes = await jsonRequest('/api/member/training/assignments', {}, memberJwt)
  const assignments = statusRes.body.data ?? statusRes.body
  const updated = assignments.find((a) => a.id === assignment.id)
  assert.equal(updated?.status, 'completed', 'assignment should complete after coach review')
})

test('GET /api/coach/assign/target-options returns primary sport list', { skip: !runCoach }, async () => {
  const { response, body } = await jsonRequest('/api/coach/assign/target-options?type=primary_sport', {}, coachJwt)
  assert.equal(response.status, 200)
  const data = body.data ?? body
  assert.ok(Array.isArray(data))
})

