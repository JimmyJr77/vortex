#!/usr/bin/env node
import { google } from 'googleapis'
import pg from 'pg'

import { youtubeEmbedUrl } from '../platform/canonicalResearchReview.js'

const value = (name, fallback) => {
  const prefix = `--${name}=`
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function durationSeconds(value) {
  const match = String(value ?? '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!match) return null
  return (Number(match[1] ?? 0) * 3600) + (Number(match[2] ?? 0) * 60) + Number(match[3] ?? 0)
}

function titleScore(canonicalName, title, seconds) {
  const normalize = (text) => String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  const canonical = normalize(canonicalName)
  const candidate = normalize(title)
  const tokens = [...new Set(canonical.split(' ').filter((token) => token.length > 1))]
  const matched = tokens.filter((token) => candidate.split(' ').includes(token)).length
  let score = tokens.length ? (matched / tokens.length) * 60 : 0
  if (candidate === canonical) score += 30
  else if (candidate.includes(canonical)) score += 20
  if (/\b(how to|form|technique|tutorial|demonstration|demo)\b/.test(candidate)) score += 10
  if (/\b(compilation|challenge|reaction|shorts?)\b/.test(candidate)) score -= 15
  if (seconds != null && (seconds < 20 || seconds > 900)) score -= 10
  return Math.round(score * 100) / 100
}

const apiKey = process.env.YOUTUBE_API_KEY
const connectionString = process.env.DATABASE_URL || process.env.DB_URL || process.env.EXTERNAL_DB_URL
if (!apiKey || !connectionString) {
  console.error('Set YOUTUBE_API_KEY and DATABASE_URL, DB_URL, or EXTERNAL_DB_URL.')
  process.exit(2)
}

const facilityId = Number(value('facility', process.env.FACILITY_ID || 1))
const requestedLimit = Number(value('limit', 10))
const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 10, 1), 25)
const write = process.argv.includes('--write')
const targetCount = 5
const pool = new pg.Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'false' ? false : undefined,
})
const youtube = google.youtube({ version: 'v3', auth: apiKey })

try {
  const queueResult = await pool.query(
    `SELECT d.id, d.slug, d.canonical_name, d.card_version,
       COUNT(DISTINCT m.video_id) FILTER (
         WHERE m.reviewed_card_version=d.card_version
           AND m.review_status IN ('candidate','shortlisted','approved')
       )::int AS current_candidates,
       COALESCE(array_agg(DISTINCT m.video_id) FILTER (
         WHERE m.reviewed_card_version=d.card_version
           AND m.review_status IN ('candidate','shortlisted','approved')
       ), ARRAY[]::text[]) AS existing_video_ids
     FROM coaching.exercise_definition_v1 d
     LEFT JOIN coaching.exercise_media_candidate_v1 m ON m.definition_id=d.id
     WHERE d.facility_id=$1 AND d.status!='archived'
     GROUP BY d.id
     HAVING COUNT(DISTINCT m.video_id) FILTER (
       WHERE m.reviewed_card_version=d.card_version
         AND m.review_status IN ('candidate','shortlisted','approved')
     ) < 3
     ORDER BY current_candidates, d.canonical_name
     LIMIT $2`,
    [facilityId, limit],
  )
  const results = []
  for (const card of queueResult.rows) {
    const sourceQuery = `"${card.canonical_name}" exercise form technique`
    const search = await youtube.search.list({
      part: ['snippet'],
      q: sourceQuery,
      type: ['video'],
      maxResults: 10,
      safeSearch: 'strict',
      relevanceLanguage: 'en',
      videoEmbeddable: 'true',
      videoSyndicated: 'true',
    })
    const ids = (search.data.items ?? []).map((item) => item.id?.videoId).filter(Boolean)
    const videos = ids.length
      ? await youtube.videos.list({
        part: ['snippet', 'contentDetails', 'status'],
        id: ids,
      })
      : { data: { items: [] } }
    const existing = new Set(card.existing_video_ids ?? [])
    const candidates = (videos.data.items ?? [])
      .filter((item) => item.status?.privacyStatus === 'public' && item.status?.embeddable === true)
      .filter((item) => !existing.has(item.id))
      .map((item) => {
        const seconds = durationSeconds(item.contentDetails?.duration)
        return {
          videoId: item.id,
          url: `https://www.youtube.com/watch?v=${item.id}`,
          embedUrl: youtubeEmbedUrl(`https://www.youtube.com/watch?v=${item.id}`),
          title: item.snippet?.title ?? null,
          channelName: item.snippet?.channelTitle ?? null,
          durationSeconds: seconds,
          captionsAvailable: item.contentDetails?.caption === 'true',
          score: titleScore(card.canonical_name, item.snippet?.title, seconds),
        }
      })
      .sort((a, b) => b.score - a.score || a.videoId.localeCompare(b.videoId))
      .slice(0, Math.max(targetCount - Number(card.current_candidates), 0))
    if (write && candidates.length > 0) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        for (const candidate of candidates) {
          await client.query(
            `INSERT INTO coaching.exercise_media_candidate_v1 (
               definition_id, reviewed_card_version, url, embed_url, video_id,
               title, channel_name, duration_seconds, captions_available,
               embedding_allowed, exact_variant_match, link_status, review_status,
               discovery_method, source_query, notes
             ) VALUES (
               $1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,NULL,'healthy','candidate',
               'youtube_api',$10,$11
             )
             ON CONFLICT (definition_id, reviewed_card_version, video_id)
             DO UPDATE SET
               title=EXCLUDED.title,
               channel_name=EXCLUDED.channel_name,
               duration_seconds=EXCLUDED.duration_seconds,
               captions_available=EXCLUDED.captions_available,
               embedding_allowed=TRUE,
               link_status='healthy',
               source_query=EXCLUDED.source_query,
               notes=EXCLUDED.notes,
               updated_at=now()`,
            [
              card.id, card.card_version, candidate.url, candidate.embedUrl,
              candidate.videoId, candidate.title, candidate.channelName,
              candidate.durationSeconds, candidate.captionsAvailable, sourceQuery,
              'Discovered through the YouTube Data API. Availability and embedding were API-verified; exact exercise/version and demonstration-quality review remain pending.',
            ],
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
    results.push({
      slug: card.slug,
      currentCandidates: Number(card.current_candidates),
      discovered: candidates.length,
      reachesTarget: Number(card.current_candidates) + candidates.length >= 3,
      candidates,
    })
  }
  console.log(JSON.stringify({
    mode: write ? 'candidate_write' : 'dry_run',
    facilityId,
    cardsProcessed: results.length,
    apiQuotaNote: 'Each processed card uses one search.list request plus one videos.list request.',
    results,
  }, null, 2))
} finally {
  await pool.end()
}
