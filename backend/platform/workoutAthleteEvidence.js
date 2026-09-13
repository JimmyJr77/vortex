import { libraryScopeId } from './coachingLibraryContext.js'
import { immutableProgrammingValue, programmingValueHash } from './workoutProgrammingRequest.js'

export const PROGRAMMING_ATHLETE_EVIDENCE_VERSION = '1.0.0'
const key = (entry) => `${entry.kind}:${entry.id}:${entry.memberId}`
const calendarDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const scopedMember = 'JOIN public.member m ON m.id = r.member_id'
const utcTimestamp = (field) => `to_char(${field} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`
// Static, allowlisted source projections: no member names, contact/billing fields,
// medical notes, media URLs, recipient addresses or unrestricted report JSON.
const sources = {
  wellness_checkin: {
    from: `coaching.wellness_checkin r ${scopedMember}`,
    scope: 'r.facility_id = $2', date: 'r.checkin_date', dateOnly: true, historyLimit: 1,
    data: `jsonb_build_object('sleepHours', r.sleep_hours, 'soreness', r.soreness, 'rpe', r.rpe, 'mood', r.mood, 'energy', r.energy,
      'note', r.note, 'updatedAt', ${utcTimestamp('r.updated_at')}, 'sourceType', 'athlete_self_report')`,
  },
  assessment_result: {
    from: `coaching.assessment_result r ${scopedMember} JOIN coaching.assessment a ON a.id = r.assessment_id
      LEFT JOIN public.app_user assessor ON assessor.id = r.coach_user_id`,
    scope: 'a.facility_id = $2 AND (r.coach_user_id IS NULL OR assessor.facility_id = $2)', date: 'r.tested_at',
    data: `jsonb_build_object('assessmentId', a.id::text, 'name', a.name, 'type', a.assessment_type, 'value', r.value_numeric,
      'textValue', r.value_text, 'unit', COALESCE(r.unit, a.unit), 'higherIsBetter', a.higher_is_better,
      'coachUserId', r.coach_user_id::text, 'note', r.note, 'assessmentArchived', a.archived, 'sourceType', 'assessment_observation')`,
  },
  skill_progress: {
    from: `coaching.athlete_skill_progress r ${scopedMember}
      LEFT JOIN coaching.exercise e ON e.id = r.exercise_id
      LEFT JOIN coaching.rubric_criterion rc ON rc.id = r.rubric_criterion_id
      LEFT JOIN coaching.rubric rubric ON rubric.id = rc.rubric_id
      LEFT JOIN public.app_user grader ON grader.id = r.coach_user_id`,
    scope: `(r.exercise_id IS NULL OR e.facility_id = $2) AND (r.rubric_criterion_id IS NULL OR rubric.facility_id = $2)
      AND (r.coach_user_id IS NULL OR grader.facility_id = $2)`, date: 'r.graded_at',
    data: `jsonb_build_object('exerciseId', r.exercise_id::text, 'exerciseName', e.name, 'criterionId', r.rubric_criterion_id::text,
      'skillLabel', r.skill_label, 'score', r.score, 'maxScore', r.max_score, 'coachUserId', r.coach_user_id::text,
      'note', r.note, 'sourceType', 'skill_observation')`,
  },
  gymnastics_evaluation: {
    from: `coaching.gymnastics_evaluation r ${scopedMember} LEFT JOIN public.app_user grader ON grader.id = r.coach_user_id`,
    scope: 'r.facility_id = $2 AND r.published_at <= CURRENT_TIMESTAMP AND (r.coach_user_id IS NULL OR grader.facility_id = $2)', date: 'r.evaluated_at', dateOnly: true,
    data: `jsonb_build_object('coachUserId', r.coach_user_id::text, 'note', r.coach_note, 'publishedAt', ${utcTimestamp('r.published_at')},
      'sourceType', 'gymnastics_observation', 'components', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('movementKey', gm.movement_key, 'variant', gm.variant_label,
          'componentKey', gc.component_key, 'score', gc.score, 'issues', COALESCE((
            SELECT jsonb_agg(gi.issue_label ORDER BY gi.id) FROM coaching.gymnastics_evaluation_issue gi
            WHERE gi.component_evaluation_id = gc.id), '[]'::jsonb)) ORDER BY gm.id, gc.id)
        FROM coaching.gymnastics_evaluation_movement gm JOIN coaching.gymnastics_evaluation_component gc ON gc.movement_evaluation_id = gm.id
        WHERE gm.evaluation_id = r.id), '[]'::jsonb))`,
  },
  completion_log: {
    from: `coaching.completion_log r ${scopedMember}
      LEFT JOIN coaching.workout w ON w.id = r.workout_id
      LEFT JOIN coaching.exercise e ON e.id = r.exercise_id
      LEFT JOIN coaching.session s ON s.id = r.session_id
      LEFT JOIN coaching.plan_assignment pa ON pa.id = r.assignment_id`,
    scope: `(r.workout_id IS NULL OR w.facility_id = $2) AND (r.exercise_id IS NULL OR e.facility_id = $2)
      AND (r.session_id IS NULL OR s.facility_id = $2) AND (r.assignment_id IS NULL OR pa.facility_id = $2)`, date: 'r.logged_at', historyLimit: 25,
    data: `jsonb_build_object('sessionId', r.session_id::text, 'workoutId', r.workout_id::text, 'exerciseId', r.exercise_id::text,
      'status', r.status, 'reps', r.reps, 'load', r.load, 'timeSeconds', r.time_seconds, 'rpe', r.rpe, 'coachGrade', r.coach_grade,
      'athleteNote', r.athlete_note, 'coachNote', r.coach_note, 'sourceType', 'reported_completion')`,
  },
  session: {
    from: `coaching.session_attendance attendance JOIN coaching.session session_source ON session_source.id = attendance.session_id
      CROSS JOIN LATERAL (SELECT session_source.*, attendance.member_id, attendance.status AS attendance_status) r ${scopedMember}
      LEFT JOIN coaching.workout w ON w.id = r.workout_id`,
    scope: 'r.facility_id = $2 AND (r.workout_id IS NULL OR w.facility_id = $2)', date: 'r.session_date', dateOnly: true, historyLimit: 10,
    data: `jsonb_build_object('status', r.status, 'attendanceStatus', r.attendance_status, 'workoutId', r.workout_id::text,
      'title', r.title, 'startTime', r.start_time, 'endTime', r.end_time, 'updatedAt', ${utcTimestamp('r.updated_at')},
      'sourceType', 'session_and_attendance_only')`,
  },
}

function querySource(kind, automatic) {
  const source = sources[kind]
  const observedAt = source.dateOnly ? `${source.date}::text` : utcTimestamp(source.date)
  const date = source.dateOnly ? source.date : `(${source.date} AT TIME ZONE 'UTC')::date`
  const timeWindow = kind === 'session'
    ? `${source.date} BETWEEN $4::date - 35 AND $4::date + 35`
    : `${source.date} <= ${source.dateOnly ? "(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date" : 'CURRENT_TIMESTAMP'} AND ${date} <= $4::date`
      + (kind === 'completion_log' ? ` AND ${date} >= $4::date - 35` : '')
  return `/* programming_athlete_evidence:${kind}:${automatic ? 'history' : 'explicit'} */
    WITH observations AS (
      SELECT r.id::text AS id, r.member_id::text AS member_id, ${observedAt} AS observed_at, ${source.data} AS data,
        row_number() OVER (PARTITION BY r.member_id ORDER BY ${source.date} DESC, r.id DESC) AS position,
        count(*) OVER (PARTITION BY r.member_id)::integer AS source_count
      FROM ${source.from}
      WHERE m.facility_id = $2 AND r.member_id = ANY($1::bigint[]) AND ${source.scope}
        AND $3::jsonb IS NOT NULL AND $4::date IS NOT NULL
        AND ${automatic ? timeWindow : `EXISTS (SELECT 1 FROM jsonb_to_recordset($3::jsonb) AS ref(id bigint, "memberId" bigint)
          WHERE ref.id = r.id AND ref."memberId" = r.member_id)`}
    ) SELECT id, member_id, observed_at, data, source_count FROM observations
      ${automatic ? `WHERE position <= ${source.historyLimit}` : ''} ORDER BY member_id::bigint, observed_at DESC, id::bigint`
}

function compactData(value, state) {
  if (typeof value === 'string' && value.length > 2000) { state.truncated = true; return value.slice(0, 2000) }
  if (Array.isArray(value)) {
    if (value.length > 100) state.truncated = true
    return value.slice(0, 100).map((entry) => compactData(entry, state))
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([field, entry]) => [field, compactData(entry, state)]))
  return value
}

/** Internal read-only adapter. Caller supplies authenticated scope and an already-normalized coach request. */
export async function loadWorkoutAthleteEvidence(client, context, request) {
  const scope = { facilityId: libraryScopeId(context.facilityId, 'facilityId'), userId: libraryScopeId(context.userId, 'userId') }
  const findings = []
  const add = (code, cohortKey, detail, reference = null) => findings.push({ code, cohortKey, detail, ...(reference ? { reference } : {}) })
  const cohorts = request.athletes.map((cohort) => ({ key: cohort.key, memberIds: [...cohort.memberIds], anonymous: !cohort.memberIds.length }))
  for (const cohort of request.athletes) if (cohort.competencyEvidenceIds.length || cohort.recentSessionIds.length || cohort.readiness?.sourceRecordIds.length) {
    add('untyped_athlete_evidence', cohort.key, 'Migrate ambiguous evidence IDs to typed, member-bound references; generated-workout UUIDs are plans, not performed sessions.')
  }
  const memberIds = cohorts.flatMap((cohort) => cohort.memberIds)
  const records = new Map()
  const members = []
  const history = []
  let referenceDate = request.logistics.sessionDate
  if (memberIds.length) {
    const clock = await client.query(`/* programming_athlete_evidence:clock */ SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date::text AS reference_date,
      to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS reference_timestamp`)
    referenceDate ??= clock.rows[0]?.reference_date
    if (!calendarDate(referenceDate)) throw new TypeError('Athlete evidence requires a database reference date')
    const result = await client.query(`/* programming_athlete_evidence:members */
      SELECT m.id::text AS id, EXTRACT(YEAR FROM age($3::date, m.date_of_birth))::integer AS age
      FROM public.member m WHERE m.facility_id = $2 AND m.id = ANY($1::bigint[]) ORDER BY m.id`, [memberIds, scope.facilityId, referenceDate])
    for (const cohort of request.athletes) for (const [athleteIndex, memberId] of cohort.memberIds.entries()) {
      const row = result.rows.find((entry) => String(entry.id) === memberId)
      if (!row) { add('unavailable_cohort_member', cohort.key, 'A requested roster member is unavailable in this facility.'); continue }
      const age = row.age == null ? null : Number(row.age)
      if (age == null || !Number.isInteger(age)) add('unknown_roster_age', cohort.key, 'The roster member has no usable birth-date evidence.')
      else if (age < cohort.ageMin || age > cohort.ageMax) add('roster_age_mismatch', cohort.key, 'A roster member falls outside the immutable cohort age range.')
      members.push({ memberId, cohortKey: cohort.key, athleteKey: `${cohort.key}:${athleteIndex + 1}`, age })
    }
    const availableIds = members.map((entry) => entry.memberId)
    const observe = (kind, rows, automatic) => {
      const source = sources[kind]
      for (const row of rows) {
        const member = members.find((entry) => entry.memberId === String(row.member_id))
        if (!member) throw new TypeError('Evidence reader returned an unscoped member')
        const id = libraryScopeId(row.id, 'evidence ID')
        const observedAt = String(row.observed_at)
        const raw = { kind, id, memberId: member.memberId, observedAt, dateOnly: Boolean(source.dateOnly), data: row.data }
        const sourceHash = programmingValueHash(raw)
        const compact = { truncated: false }
        const record = { ...raw, sourceHash, data: compactData(row.data, compact), truncated: compact.truncated }
        if (compact.truncated) add('athlete_evidence_truncated', member.cohortKey, 'Source evidence exceeds the bounded model context; review the complete source.', { kind, id, memberId: member.memberId })
        if (Number.isNaN(Date.parse(observedAt))) add('invalid_athlete_evidence_time', member.cohortKey, 'Source observation time is invalid.', { kind, id, memberId: member.memberId })
        else if (kind !== 'session' && (source.dateOnly ? observedAt > clock.rows[0].reference_date
          : Date.parse(observedAt) > Date.parse(clock.rows[0].reference_timestamp))) add('future_athlete_observation', member.cohortKey, 'An observed result is dated in the future.', { kind, id, memberId: member.memberId })
        if (kind !== 'session' && observedAt.slice(0, 10) > referenceDate) add('observation_after_session_date', member.cohortKey,
          'An observation recorded after the requested session date cannot establish readiness for that session.', { kind, id, memberId: member.memberId })
        if (kind !== 'session' && request.logistics.sessionStartsAt && [!source.dateOnly ? observedAt : null, row.data?.updatedAt, row.data?.publishedAt]
          .some((time) => time && Date.parse(time) > Date.parse(request.logistics.sessionStartsAt))) add('observation_after_session_start', member.cohortKey,
          'This observation or its current version was recorded after the requested session start.', { kind, id, memberId: member.memberId })
        records.set(key(record), record)
        if (automatic && !history.some((entry) => entry.kind === kind && entry.memberId === member.memberId)) {
          const total = Number(row.source_count)
          const truncated = kind !== 'wellness_checkin' && total > source.historyLimit
          history.push({ kind, memberId: member.memberId, availableCount: total, returnedCount: Math.min(total, source.historyLimit), truncated })
          if (truncated) add('athlete_history_truncated', member.cohortKey, 'Recorded history exceeds this bounded retrieval window; review before relying on adjacent-session load.')
        }
      }
    }
    if (availableIds.length) {
      for (const kind of Object.keys(sources)) {
        const references = request.athletes.flatMap((cohort) => cohort.evidenceReferences.filter((entry) => entry.kind === kind && availableIds.includes(entry.memberId)))
        if (references.length) {
          const result = await client.query(querySource(kind, false), [availableIds, scope.facilityId, JSON.stringify(references), referenceDate])
          // The SQL predicate binds both IDs. Reject accidental broadening by a future adapter.
          if (result.rows.some((row) => !references.some((entry) => entry.id === String(row.id) && entry.memberId === String(row.member_id)))) throw new TypeError('Evidence reader returned an unrequested reference')
          observe(kind, result.rows, false)
        }
        if (sources[kind].historyLimit) {
          observe(kind, (await client.query(querySource(kind, true), [availableIds, scope.facilityId, '[]', referenceDate])).rows, true)
          for (const memberId of availableIds) if (!history.some((entry) => entry.kind === kind && entry.memberId === memberId)) history.push({ kind, memberId, availableCount: 0, returnedCount: 0, truncated: false })
        }
      }
    }
  }
  for (const cohort of request.athletes) for (const reference of cohort.evidenceReferences) {
    const record = records.get(key(reference))
    if (!record) add('unavailable_athlete_evidence', cohort.key, 'A requested record is unavailable for this facility and cohort member.', reference)
    else if (reference.expectedSourceHash && reference.expectedSourceHash !== record.sourceHash) add('stale_athlete_evidence_reference', cohort.key, 'The referenced observation changed; review its current source.', reference)
  }
  const observations = [...records.values()].sort((a, b) => key(a).localeCompare(key(b), 'en', { numeric: true }))
  const content = { schemaVersion: PROGRAMMING_ATHLETE_EVIDENCE_VERSION, referenceDate, cohorts, members, observations, history,
    retrieval: { previousDays: 35, plannedDays: 35, wellness: 'latest_on_or_before_session_date', scope: 'recorded_in_this_facility',
      timestampDateBasis: 'UTC', dateOnlySourceBasis: 'source_calendar_date', outsideActivityKnown: false },
    findings, prerequisiteStatus: 'NOT_ESTABLISHED' }
  return immutableProgrammingValue({ ...content, contentHash: programmingValueHash(content), status: findings.length ? 'NEEDS_COACH_REVIEW' : memberIds.length ? 'HYDRATED' : 'ANONYMOUS' })
}
