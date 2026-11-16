import { normalizeBrowserEvent } from './eventContract.js'

export async function ingestBrowserEvents(pool, events) {
  const incoming = events.map(normalizeBrowserEvent).filter(Boolean)
  if (incoming.length === 0) return 0

  // Insert the batch and update its sessions atomically. Replays do not extend session duration.
  const { rows } = await pool.query(
    `WITH incoming AS (
       SELECT DISTINCT ON (event_id) input.*, payload.position
       FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY AS payload(event, position)
       CROSS JOIN LATERAL jsonb_to_record(payload.event) AS input(
         event_id uuid, event_name text, occurred_at timestamptz, visitor_id text, session_id text,
         page_path text, hostname text, properties jsonb, consent_marketing boolean,
         referrer text, utm_source text, utm_medium text, utm_campaign text, device_type text
       )
       ORDER BY event_id, payload.position
     ), inserted AS (
       INSERT INTO analytics_events (
         event_id, event_name, occurred_at, visitor_id, session_id, page_path,
         hostname, properties, consent_analytics, consent_marketing, is_staff
       )
       SELECT event_id, event_name, occurred_at, visitor_id, session_id, page_path,
         hostname, properties, true, consent_marketing, false
       FROM incoming ORDER BY position
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id
     ), sessions AS (
       SELECT DISTINCT ON (i.session_id) i.*,
              MAX(i.occurred_at) OVER (PARTITION BY i.session_id) AS ended_at
       FROM incoming i
       JOIN inserted USING (event_id)
       ORDER BY i.session_id, i.occurred_at, (i.event_name = 'page_view') DESC, i.event_id
     ), session_updates AS (
       INSERT INTO visitor_sessions (
         session_id, visitor_id, started_at, ended_at, landing_path, referrer,
         utm_source, utm_medium, utm_campaign, hostname, is_staff, device_type
       )
       SELECT session_id, visitor_id, occurred_at, ended_at, page_path, referrer,
         utm_source, utm_medium, utm_campaign, hostname, false, device_type
       FROM sessions ORDER BY session_id
       ON CONFLICT (session_id) DO UPDATE SET
         started_at = LEAST(visitor_sessions.started_at, EXCLUDED.started_at),
         ended_at = GREATEST(visitor_sessions.ended_at, EXCLUDED.ended_at),
         landing_path = CASE WHEN EXCLUDED.started_at < visitor_sessions.started_at
                             THEN EXCLUDED.landing_path ELSE visitor_sessions.landing_path END,
         referrer = CASE WHEN EXCLUDED.started_at < visitor_sessions.started_at
                         THEN EXCLUDED.referrer ELSE visitor_sessions.referrer END,
         utm_source = CASE WHEN EXCLUDED.started_at < visitor_sessions.started_at
                           THEN EXCLUDED.utm_source ELSE visitor_sessions.utm_source END,
         utm_medium = CASE WHEN EXCLUDED.started_at < visitor_sessions.started_at
                           THEN EXCLUDED.utm_medium ELSE visitor_sessions.utm_medium END,
         utm_campaign = CASE WHEN EXCLUDED.started_at < visitor_sessions.started_at
                             THEN EXCLUDED.utm_campaign ELSE visitor_sessions.utm_campaign END,
         hostname = EXCLUDED.hostname,
         device_type = COALESCE(visitor_sessions.device_type, EXCLUDED.device_type),
         updated_at = now()
       WHERE visitor_sessions.visitor_id = EXCLUDED.visitor_id
         AND REGEXP_REPLACE(LOWER(visitor_sessions.hostname), '^www[.]', '') = EXCLUDED.hostname
     )
     SELECT COUNT(*)::int AS accepted FROM inserted`,
    [JSON.stringify(incoming)],
  )
  return rows[0].accepted
}
