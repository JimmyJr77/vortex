#!/usr/bin/env node
import pg from 'pg'

const value = (name, fallback) => {
  const prefix = `--${name}=`
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

const connectionString = process.env.DATABASE_URL || process.env.DB_URL || process.env.EXTERNAL_DB_URL
if (!connectionString) {
  console.error('Set DATABASE_URL, DB_URL, or EXTERNAL_DB_URL.')
  process.exit(2)
}

const facilityId = Number(value('facility', process.env.FACILITY_ID || 1))
const requestedLimit = Number(value('limit', 50))
const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 50, 1), 250)
const slugs = String(value('slugs', ''))
  .split(',')
  .map((slug) => slug.trim())
  .filter(Boolean)
const write = process.argv.includes('--write')
const pool = new pg.Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'false' ? false : undefined,
})

async function fetchOembed(candidate) {
  const endpoint = new URL('https://www.youtube.com/oembed')
  endpoint.searchParams.set('url', candidate.url)
  endpoint.searchParams.set('format', 'json')
  const response = await fetch(endpoint, {
    headers: { 'user-agent': 'VortexExerciseMediaReview/1.0' },
  })
  if (!response.ok) {
    return {
      ...candidate,
      ok: false,
      status: response.status,
      error: `YouTube oEmbed returned ${response.status}.`,
    }
  }
  const metadata = await response.json()
  const embedResponded = metadata.type === 'video'
    && String(metadata.html ?? '').includes('/embed/')
  return {
    ...candidate,
    ok: embedResponded,
    status: response.status,
    title: metadata.title ?? null,
    channelName: metadata.author_name ?? null,
    embeddingAllowed: embedResponded,
    error: embedResponded ? null : 'oEmbed response did not contain an embedded video player.',
  }
}

try {
  const params = [facilityId, limit]
  const slugClause = slugs.length > 0 ? 'AND definition.slug=ANY($3::text[])' : ''
  if (slugs.length > 0) params.push(slugs)
  const result = await pool.query(
    `SELECT
       media.id,
       media.url,
       media.video_id AS "videoId",
       definition.slug,
       definition.card_version AS "cardVersion"
     FROM coaching.exercise_media_candidate_v1 media
     JOIN coaching.exercise_definition_v1 definition
       ON definition.id=media.definition_id
      AND definition.status!='archived'
      AND definition.card_version=media.reviewed_card_version
     WHERE definition.facility_id=$1
       AND media.review_status='candidate'
       AND (media.title IS NULL OR media.link_status='unverified')
       ${slugClause}
     ORDER BY definition.canonical_name, media.video_id
     LIMIT $2`,
    params,
  )
  const hydrated = []
  for (let offset = 0; offset < result.rows.length; offset += 5) {
    const batch = result.rows.slice(offset, offset + 5)
    hydrated.push(...await Promise.all(batch.map(fetchOembed)))
  }
  if (write) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const candidate of hydrated) {
        if (!candidate.ok) continue
        await client.query(
          `UPDATE coaching.exercise_media_candidate_v1
           SET title=$2,
               channel_name=$3,
               embedding_allowed=TRUE,
               link_status='healthy',
               notes=concat_ws(
                 E'\\n',
                 notes,
                 'YouTube oEmbed metadata and an embed-player response were verified at '
                   || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
                   || '; exact exercise/version and demonstration-quality review remain pending.'
               ),
               updated_at=now()
           WHERE id=$1 AND review_status='candidate'`,
          [candidate.id, candidate.title, candidate.channelName],
        )
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
  console.log(JSON.stringify({
    mode: write ? 'metadata_write' : 'dry_run',
    facilityId,
    requestedSlugs: slugs,
    candidatesProcessed: hydrated.length,
    successfulEmbeds: hydrated.filter((candidate) => candidate.ok).length,
    unsuccessfulEmbeds: hydrated.filter((candidate) => !candidate.ok).length,
    candidates: hydrated,
    reviewState: 'No candidate was exact-match or demonstration-quality approved.',
  }, null, 2))
} finally {
  await pool.end()
}
