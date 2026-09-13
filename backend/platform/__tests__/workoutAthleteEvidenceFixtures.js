import assert from 'node:assert/strict'
import { normalizeCoachWorkoutRequest } from '../workoutProgrammingRequest.js'
import { coachRequest } from './workoutProgrammingStaffFixtures.js'
import { libraryPool } from './workoutProgrammingLibrarianFixtures.js'

export function rosterRequest(patch = {}) {
  return normalizeCoachWorkoutRequest(coachRequest({ athletes: [{ key: 'youth', ageMin: 12, ageMax: 14, athleteCount: 2,
    trainingExperience: 'intermediate', memberIds: ['101', '102'], evidenceReferences: [{ kind: 'skill_progress', id: '71', memberId: '101' }] }], ...patch }))
}
export function evidenceFixtures(memberIds = ['101', '102']) {
  return { referenceDate: '2026-09-12', members: memberIds.map((id) => ({ id, age: 13 })),
    'skill_progress:explicit': [{ id: '71', member_id: '101', observed_at: '2026-09-11T13:00:00.000000Z', source_count: 1,
      data: { skillLabel: 'Landing quality', score: 4, maxScore: 5, sourceType: 'skill_observation', note: 'Repeat with a quiet controlled landing.' } }],
    'wellness_checkin:history': [{ id: '81', member_id: '101', observed_at: '2026-09-12', source_count: 1,
      data: { sleepHours: 8, soreness: 3, energy: 7, note: 'Training yesterday.', sourceType: 'athlete_self_report' } }],
    'completion_log:history': [{ id: '91', member_id: '101', observed_at: '2026-09-11T17:00:00.000000Z', source_count: 1,
      data: { sessionId: '301', status: 'partial', reps: 8, timeSeconds: 120, rpe: 5, sourceType: 'reported_completion' } }],
    'session:history': [{ id: '301', member_id: '101', observed_at: '2026-09-11', source_count: 1,
      data: { status: 'completed', attendanceStatus: 'present', workoutId: '501', sourceType: 'session_and_attendance_only' } }],
  }
}
export function evidencePool(fixtures, base = libraryPool()) {
  const calls = []
  return { calls, base, async connect() {
    const client = await base.connect()
    return { async query(sql, params = []) {
      calls.push({ sql, params })
      if (!sql.includes('programming_athlete_evidence:')) return client.query(sql, params)
      if (sql.includes('programming_athlete_evidence:clock')) return { rows: [{ reference_date: fixtures.referenceDate, reference_timestamp: `${fixtures.referenceDate}T18:00:00.000000Z` }] }
      assert.equal(params[1], '9')
      if (sql.includes('programming_athlete_evidence:members')) return { rows: structuredClone(fixtures.members.filter((entry) => params[0].includes(entry.id))) }
      const match = sql.match(/programming_athlete_evidence:([a-z_]+):([a-z]+)/)
      assert.ok(match, 'Unknown evidence fixture query')
      assert.ok(sql.includes('m.facility_id = $2'))
      const rows = fixtures[`${match[1]}:${match[2]}`] ?? []
      return { rows: structuredClone(rows) }
    }, release(error) { calls.push({ sql: 'RELEASE' }); client.release(error) } }
  } }
}
