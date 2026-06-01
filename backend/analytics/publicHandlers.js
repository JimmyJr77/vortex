import Joi from 'joi'
import {
  ANALYTICS_POLICY_VERSION,
  stripEventProperties,
  upsertVisitorSession,
} from './helpers.js'

const eventSchema = Joi.object({
  eventId: Joi.string().uuid().required(),
  eventName: Joi.string().max(80).required(),
  occurredAt: Joi.string().isoDate().required(),
  pagePath: Joi.string().max(500).allow('', null),
  hostname: Joi.string().max(255).allow('', null),
  visitorId: Joi.string().max(64).required(),
  sessionId: Joi.string().max(64).required(),
  referrer: Joi.string().max(2000).allow('', null),
  consentAnalytics: Joi.boolean().default(false),
  consentMarketing: Joi.boolean().default(false),
  isStaff: Joi.boolean().default(false),
  properties: Joi.object().unknown(true).optional(),
  utm: Joi.object({
    source: Joi.string().max(100).allow('', null),
    medium: Joi.string().max(100).allow('', null),
    campaign: Joi.string().max(100).allow('', null),
    content: Joi.string().max(100).allow('', null),
    term: Joi.string().max(100).allow('', null),
    clickIds: Joi.object().unknown(true).optional(),
  }).optional(),
}).unknown(false)

const batchSchema = Joi.object({
  events: Joi.array().items(eventSchema).min(1).max(50).required(),
})

const consentSchema = Joi.object({
  visitorId: Joi.string().max(64).required(),
  analytics: Joi.boolean().required(),
  marketing: Joi.boolean().required(),
  policyVersion: Joi.string().max(20).optional(),
})

export function createPublicAnalyticsHandlers(pool) {
  const ingestEvents = async (req, res) => {
    try {
      const { error, value } = batchSchema.validate(req.body)
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.details.map((d) => d.message).join('; '),
        })
      }

      let accepted = 0
      for (const ev of value.events) {
        const properties = stripEventProperties(ev.properties)
        const occurredAt = new Date(ev.occurredAt)

        try {
          await pool.query(
            `INSERT INTO analytics_events (
              event_id, event_name, occurred_at, visitor_id, session_id,
              page_path, hostname, properties, consent_analytics, consent_marketing, is_staff
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (event_id) DO NOTHING`,
            [
              ev.eventId,
              ev.eventName,
              occurredAt,
              ev.visitorId,
              ev.sessionId,
              ev.pagePath || '/',
              ev.hostname || null,
              JSON.stringify(properties),
              !!ev.consentAnalytics,
              !!ev.consentMarketing,
              !!ev.isStaff,
            ],
          )
          accepted++

          if (ev.eventName === 'page_view' || ev.consentAnalytics) {
            await upsertVisitorSession(pool, {
              sessionId: ev.sessionId,
              visitorId: ev.visitorId,
              pagePath: ev.pagePath || '/',
              hostname: ev.hostname,
              referrer: ev.referrer,
              utm: ev.utm,
              isStaff: ev.isStaff,
              occurredAt,
            })
          }
        } catch (insertErr) {
          console.warn('[analytics/event] skip', ev.eventId, insertErr.message)
        }
      }

      res.json({ success: true, accepted })
    } catch (err) {
      console.error('[analytics/event]', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  const recordConsent = async (req, res) => {
    try {
      const { error, value } = consentSchema.validate(req.body)
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.details.map((d) => d.message).join('; '),
        })
      }

      const ipCountry =
        (req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || '')
          .toString()
          .slice(0, 2) || null

      await pool.query(
        `INSERT INTO consent_records (visitor_id, policy_version, analytics, marketing, ip_country, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          value.visitorId,
          value.policyVersion || ANALYTICS_POLICY_VERSION,
          value.analytics,
          value.marketing,
          ipCountry,
          (req.headers['user-agent'] || '').slice(0, 500),
        ],
      )

      res.json({
        success: true,
        policyVersion: ANALYTICS_POLICY_VERSION,
      })
    } catch (err) {
      console.error('[consent]', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  return { ingestEvents, recordConsent }
}
