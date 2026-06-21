/**
 * Embedding pipeline for coach assistant RAG (pgvector).
 */
import { embed } from 'ai'
import { openai } from '@ai-sdk/openai'
import { isLlmConfigured } from './aiService.js'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIM = 1536

export function isEmbeddingConfigured() {
  return isLlmConfigured()
}

function toVectorLiteral(values) {
  return `[${values.join(',')}]`
}

export async function embedText(text) {
  if (!isEmbeddingConfigured()) return null
  const trimmed = String(text || '').trim()
  if (!trimmed) return null
  try {
    const { embedding } = await embed({
      model: openai.embedding(EMBEDDING_MODEL),
      value: trimmed.slice(0, 8000),
    })
    if (!embedding?.length) return null
    return embedding
  } catch (err) {
    console.warn('[embed] failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Upsert one embedding row keyed by facility + member + source.
 */
export async function upsertEmbeddingChunk(pool, {
  facilityId,
  memberId,
  sourceType,
  sourceId,
  content,
}) {
  const tableCheck = await pool.query(
    `SELECT to_regclass('coaching.embedding_chunk') AS reg`,
  )
  if (!tableCheck.rows[0]?.reg) return false
  const embedding = await embedText(content)
  if (!embedding) return false
  const vector = toVectorLiteral(embedding)
  await pool.query(
    `
      DELETE FROM coaching.embedding_chunk
      WHERE facility_id = $1 AND member_id IS NOT DISTINCT FROM $2
        AND source_type = $3 AND source_id = $4
    `,
    [facilityId, memberId ?? null, sourceType, sourceId],
  )
  await pool.query(
    `
      INSERT INTO coaching.embedding_chunk
        (facility_id, member_id, source_type, source_id, content, embedding, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6::vector, now())
    `,
    [facilityId, memberId ?? null, sourceType, sourceId, content, vector],
  )
  return true
}

export async function searchEmbeddingChunks(pool, {
  facilityId,
  memberId,
  queryText,
  limit = 8,
}) {
  const tableCheck = await pool.query(`SELECT to_regclass('coaching.embedding_chunk') AS reg`)
  if (!tableCheck.rows[0]?.reg) return []
  const embedding = await embedText(queryText)
  if (!embedding) return []
  const vector = toVectorLiteral(embedding)
  const result = await pool.query(
    `
      SELECT id, source_type, source_id, content,
             1 - (embedding <=> $3::vector) AS similarity
      FROM coaching.embedding_chunk
      WHERE facility_id = $1
        AND embedding IS NOT NULL
        AND (member_id = $2 OR member_id IS NULL)
      ORDER BY embedding <=> $3::vector
      LIMIT $4
    `,
    [facilityId, memberId, vector, limit],
  )
  return result.rows
}

export async function syncMemberEmbeddings(pool, facilityId, memberId) {
  if (!isEmbeddingConfigured()) return { synced: 0 }
  let synced = 0

  const completions = await pool.query(
    `
      SELECT cl.id, cl.logged_at, cl.status, cl.reps, cl.rpe, cl.coach_note, cl.athlete_note,
             e.name AS exercise_name, w.title AS workout_title
      FROM coaching.completion_log cl
      LEFT JOIN coaching.exercise e ON e.id = cl.exercise_id
      LEFT JOIN coaching.workout w ON w.id = cl.workout_id
      WHERE cl.member_id = $1
      ORDER BY cl.logged_at DESC
      LIMIT 80
    `,
    [memberId],
  )
  for (const row of completions.rows) {
    const content = [
      row.workout_title ? `Workout: ${row.workout_title}` : null,
      row.exercise_name ? `Exercise: ${row.exercise_name}` : null,
      row.status ? `Status: ${row.status}` : null,
      row.reps != null ? `Reps: ${row.reps}` : null,
      row.rpe != null ? `RPE: ${row.rpe}` : null,
      row.athlete_note ? `Athlete note: ${row.athlete_note}` : null,
      row.coach_note ? `Coach note: ${row.coach_note}` : null,
      row.logged_at ? `Logged: ${row.logged_at}` : null,
    ].filter(Boolean).join(' · ')
    if (!content) continue
    const ok = await upsertEmbeddingChunk(pool, {
      facilityId,
      memberId,
      sourceType: 'completion_log',
      sourceId: Number(row.id),
      content,
    })
    if (ok) synced += 1
  }

  const assessments = await pool.query(
    `
      SELECT ar.id, ar.value_numeric, ar.value_text, ar.unit, ar.tested_at, ar.note,
             a.name AS assessment_name
      FROM coaching.assessment_result ar
      JOIN coaching.assessment a ON a.id = ar.assessment_id
      WHERE ar.member_id = $1
      ORDER BY ar.tested_at DESC
      LIMIT 40
    `,
    [memberId],
  )
  for (const row of assessments.rows) {
    const content = [
      `Assessment: ${row.assessment_name}`,
      row.value_numeric != null ? `Value: ${row.value_numeric}` : null,
      row.value_text ? `Text: ${row.value_text}` : null,
      row.unit ? `Unit: ${row.unit}` : null,
      row.note ? `Note: ${row.note}` : null,
      row.tested_at ? `Tested: ${row.tested_at}` : null,
    ].filter(Boolean).join(' · ')
    const ok = await upsertEmbeddingChunk(pool, {
      facilityId,
      memberId,
      sourceType: 'assessment_result',
      sourceId: Number(row.id),
      content,
    })
    if (ok) synced += 1
  }

  const wellness = await pool.query(
    `
      SELECT id, checkin_date, sleep_hours, soreness, rpe, mood, energy, note
      FROM coaching.wellness_checkin
      WHERE member_id = $1
      ORDER BY checkin_date DESC
      LIMIT 30
    `,
    [memberId],
  )
  for (const row of wellness.rows) {
    const content = [
      `Wellness ${row.checkin_date}`,
      row.sleep_hours != null ? `Sleep ${row.sleep_hours}h` : null,
      row.soreness != null ? `Soreness ${row.soreness}` : null,
      row.mood != null ? `Mood ${row.mood}` : null,
      row.energy != null ? `Energy ${row.energy}` : null,
      row.note ? `Note: ${row.note}` : null,
    ].filter(Boolean).join(' · ')
    const ok = await upsertEmbeddingChunk(pool, {
      facilityId,
      memberId,
      sourceType: 'wellness_checkin',
      sourceId: Number(row.id),
      content,
    })
    if (ok) synced += 1
  }

  const reviews = await pool.query(
    `
      SELECT fr.id AS response_id, frs.subject, e.name AS exercise_name, fr.note, fr.criterion_scores
      FROM coaching.form_review_response fr
      JOIN coaching.form_review_submission frs ON frs.id = fr.submission_id
      LEFT JOIN coaching.exercise e ON e.id = frs.exercise_id
      WHERE frs.member_id = $1 AND frs.status = 'reviewed'
      ORDER BY fr.reviewed_at DESC
      LIMIT 20
    `,
    [memberId],
  )
  for (const row of reviews.rows) {
    const content = [
      row.exercise_name ? `Form review: ${row.exercise_name}` : row.subject ? `Form review: ${row.subject}` : 'Form review',
      row.note ? `Coach feedback: ${row.note}` : null,
      row.criterion_scores && Object.keys(row.criterion_scores).length
        ? `Scores: ${JSON.stringify(row.criterion_scores)}`
        : null,
    ].filter(Boolean).join(' · ')
    const ok = await upsertEmbeddingChunk(pool, {
      facilityId,
      memberId,
      sourceType: 'form_review',
      sourceId: Number(row.response_id),
      content,
    })
    if (ok) synced += 1
  }

  return { synced }
}
