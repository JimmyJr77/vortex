import Joi from 'joi'
import {
  parseDateRange,
  hostnameFilterClause,
  normalizeLeadStatus,
  hashEmail,
  logAudit,
  recordUtmAttribution,
} from './helpers.js'
import { syncExternalAnalytics } from './syncExternal.js'

function staffExclusion(alias = '') {
  const p = alias ? `${alias}.` : ''
  return ` AND (${p}is_staff IS NOT TRUE OR ${p}is_staff IS NULL)`
}

export function createAdminAnalyticsHandlers(pool) {
  const getOverview = async (req, res) => {
    try {
      const range = parseDateRange(req.query)
      if (!range) {
        return res.status(400).json({ success: false, message: 'Invalid date range' })
      }
      const { from, to } = range
      const host = hostnameFilterClause(req.query, 3, 'vs')
      const hostReg = req.query.hostname && req.query.hostname !== 'all'
        ? ` AND landing_page LIKE $3`
        : ''
      const regParams = hostReg
        ? [from, to, `%${req.query.hostname}%`]
        : [from, to]

      const inquiries = await pool.query(
        `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE contacted = true)::int AS contacted
         FROM registrations
         WHERE archived IS NOT TRUE AND created_at >= $1 AND created_at <= $2${hostReg}`,
        regParams,
      )

      const inquiryTrend = await pool.query(
        `SELECT DATE(created_at) AS day, COUNT(*)::int AS count
         FROM registrations
         WHERE archived IS NOT TRUE AND created_at >= $1 AND created_at <= $2${hostReg}
         GROUP BY DATE(created_at) ORDER BY day`,
        regParams,
      )

      const newsletter = await pool.query(
        `SELECT COUNT(*)::int AS count FROM newsletter_subscribers
         WHERE created_at >= $1 AND created_at <= $2`,
        [from, to],
      )

      let enrollments = { rows: [{ count: 0 }] }
      try {
        enrollments = await pool.query(
          `SELECT COUNT(*)::int AS count FROM scheduling_signup
           WHERE orphaned_at IS NULL AND created_at >= $1 AND created_at <= $2`,
          [from, to],
        )
      } catch {
        enrollments = await pool.query(
          `SELECT COUNT(*)::int AS count FROM scheduling_signup WHERE orphaned_at IS NULL`,
        )
      }

      const sessionParams = [from, to, ...host.params]
      const sessions = await pool.query(
        `SELECT COUNT(*)::int AS count FROM visitor_sessions vs
         WHERE started_at >= $1 AND started_at <= $2${host.clause}${staffExclusion('vs')}`,
        sessionParams,
      )

      const uncontacted = await pool.query(
        `SELECT COUNT(*)::int AS count FROM registrations
         WHERE archived IS NOT TRUE AND contacted IS NOT TRUE
         AND created_at < now() - interval '48 hours'`,
      )

      let capacity = []
      try {
        const capResult = await pool.query(`
          SELECT p.id, p.display_name,
            COALESCE(SUM(c.current_enrollment), 0)::int AS enrolled,
            COALESCE(SUM(c.max_capacity), 0)::int AS capacity
          FROM program p
          LEFT JOIN class c ON c.program_id = p.id AND c.is_active = true
          WHERE p.is_active = true
          GROUP BY p.id, p.display_name
          HAVING COALESCE(SUM(c.max_capacity), 0) > 0
        `)
        capacity = capResult.rows.map((row) => {
          const fill = row.capacity > 0 ? row.enrolled / row.capacity : 0
          return {
            programId: row.id,
            name: row.display_name,
            enrolled: row.enrolled,
            capacity: row.capacity,
            fillRate: Math.round(fill * 1000) / 10,
            alert: fill >= 0.85 ? 'near_full' : fill <= 0.5 ? 'underfilled' : null,
          }
        }).filter((r) => r.alert)
      } catch (e) {
        console.warn('[overview capacity]', e.message)
      }

      const inq = inquiries.rows[0]
      res.json({
        success: true,
        data: {
          range: { from: from.toISOString(), to: to.toISOString() },
          inquiries: {
            total: inq.total,
            contacted: inq.contacted,
            contactedRate: inq.total
              ? Math.round((inq.contacted / inq.total) * 1000) / 10
              : 0,
            trend: inquiryTrend.rows,
          },
          newsletterSignups: newsletter.rows[0].count,
          newEnrollments: enrollments.rows[0].count,
          sessions: sessions.rows[0].count,
          uncontactedOver48h: uncontacted.rows[0].count,
          capacityAlerts: capacity,
        },
      })
    } catch (err) {
      console.error('[analytics/overview]', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  const getTraffic = async (req, res) => {
    try {
      const range = parseDateRange(req.query)
      if (!range) return res.status(400).json({ success: false, message: 'Invalid date range' })
      const { from, to } = range
      const host = hostnameFilterClause(req.query, 3, 'ae')

      const byDay = await pool.query(
        `SELECT DATE(occurred_at) AS day, COUNT(*)::int AS page_views
         FROM analytics_events ae
         WHERE event_name = 'page_view' AND occurred_at >= $1 AND occurred_at <= $2${host.clause}${staffExclusion('ae')}
         GROUP BY DATE(occurred_at) ORDER BY day`,
        [from, to, ...host.params],
      )

      const topPages = await pool.query(
        `SELECT page_path, COUNT(*)::int AS views
         FROM analytics_events ae
         WHERE event_name = 'page_view' AND occurred_at >= $1 AND occurred_at <= $2${host.clause}${staffExclusion('ae')}
         GROUP BY page_path ORDER BY views DESC LIMIT 20`,
        [from, to, ...host.params],
      )

      res.json({
        success: true,
        data: { pageViewsByDay: byDay.rows, topPages: topPages.rows },
      })
    } catch (err) {
      console.error('[analytics/traffic]', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  const getFunnel = async (req, res) => {
    try {
      const range = parseDateRange(req.query)
      if (!range) return res.status(400).json({ success: false, message: 'Invalid date range' })
      const { from, to } = range
      const host = hostnameFilterClause(req.query, 3, 'ae')
      const params = [from, to, ...host.params]
      const staff = staffExclusion('ae')

      const countEvent = async (name) => {
        const r = await pool.query(
          `SELECT COUNT(DISTINCT visitor_id)::int AS c FROM analytics_events ae
           WHERE event_name = $${params.length + 1} AND occurred_at >= $1 AND occurred_at <= $2${host.clause}${staff}`,
          [...params, name],
        )
        return r.rows[0].c
      }

      const sessions = await pool.query(
        `SELECT COUNT(DISTINCT session_id)::int AS c FROM visitor_sessions vs
         WHERE started_at >= $1 AND started_at <= $2${hostnameFilterClause(req.query, 3, 'vs').clause}${staffExclusion('vs')}`,
        [from, to, ...hostnameFilterClause(req.query, 3, 'vs').params],
      )

      const formSubmit = await pool.query(
        `SELECT COUNT(*)::int AS c FROM registrations
         WHERE archived IS NOT TRUE AND created_at >= $1 AND created_at <= $2`,
        [from, to],
      )

      const contacted = await pool.query(
        `SELECT COUNT(*)::int AS c FROM registrations
         WHERE archived IS NOT TRUE AND contacted = true AND created_at >= $1 AND created_at <= $2`,
        [from, to],
      )

      let enrolled = { rows: [{ c: 0 }] }
      try {
        enrolled = await pool.query(
          `SELECT COUNT(DISTINCT s.member_id)::int AS c FROM scheduling_signup s
           WHERE s.orphaned_at IS NULL AND s.created_at >= $1 AND s.created_at <= $2`,
          [from, to],
        )
      } catch {
        enrolled = { rows: [{ c: 0 }] }
      }

      const steps = [
        { name: 'Sessions', count: sessions.rows[0].c },
        { name: 'Program page views', count: await countEvent('program_page_view') },
        { name: 'Schedule views', count: await countEvent('schedule_view') },
        { name: 'Inquiry started', count: await countEvent('inquiry_form_start') },
        { name: 'Inquiry submitted', count: formSubmit.rows[0].c },
        { name: 'Contacted', count: contacted.rows[0].c },
        { name: 'Enrolled', count: enrolled.rows[0].c },
      ]

      let prev = steps[0].count || 1
      const withRates = steps.map((s, i) => {
        const rate = i === 0 ? 100 : prev > 0 ? Math.round((s.count / prev) * 1000) / 10 : 0
        if (i > 0) prev = s.count || prev
        return { ...s, conversionFromPrevious: rate }
      })

      res.json({ success: true, data: { steps: withRates } })
    } catch (err) {
      console.error('[analytics/funnel]', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  const getPrograms = async (req, res) => {
    try {
      const range = parseDateRange(req.query)
      if (!range) return res.status(400).json({ success: false, message: 'Invalid date range' })
      const { from, to } = range

      const inquiries = await pool.query(
        `SELECT interests_array, interests FROM registrations
         WHERE archived IS NOT TRUE AND created_at >= $1 AND created_at <= $2`,
        [from, to],
      )

      const interestCounts = {}
      for (const row of inquiries.rows) {
        const list =
          row.interests_array?.length > 0
            ? row.interests_array
            : row.interests
              ? row.interests.split(',').map((s) => s.trim())
              : []
        for (const i of list) {
          if (i) interestCounts[i] = (interestCounts[i] || 0) + 1
        }
      }

      let enrollmentsByProgram = []
      try {
        const er = await pool.query(
          `SELECT COALESCE(p.display_name, sf.title, 'Unknown') AS display_name, COUNT(s.id)::int AS count
           FROM scheduling_signup s
           JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
           LEFT JOIN program p ON p.id = sf.program_id
           WHERE s.orphaned_at IS NULL AND s.created_at >= $1 AND s.created_at <= $2
           GROUP BY COALESCE(p.display_name, sf.title, 'Unknown') ORDER BY count DESC`,
          [from, to],
        )
        enrollmentsByProgram = er.rows
      } catch {
        enrollmentsByProgram = []
      }

      let capacity = []
      try {
        const cr = await pool.query(`
          SELECT p.id, p.display_name,
            COALESCE(SUM(c.current_enrollment), 0)::int AS enrolled,
            COALESCE(SUM(c.max_capacity), 0)::int AS capacity
          FROM program p
          LEFT JOIN class c ON c.program_id = p.id AND c.is_active = true
          WHERE p.is_active = true
          GROUP BY p.id, p.display_name
        `)
        capacity = cr.rows.map((r) => ({
          programId: r.id,
          name: r.display_name,
          enrolled: r.enrolled,
          capacity: r.capacity,
          fillRate:
            r.capacity > 0 ? Math.round((r.enrolled / r.capacity) * 1000) / 10 : null,
        }))
      } catch {
        capacity = []
      }

      res.json({
        success: true,
        data: {
          inquiriesByInterest: Object.entries(interestCounts)
            .map(([interest, count]) => ({ interest, count }))
            .sort((a, b) => b.count - a.count),
          enrollmentsByProgram,
          capacity,
        },
      })
    } catch (err) {
      console.error('[analytics/programs]', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  const getInquiries = async (req, res) => {
    try {
      const range = parseDateRange(req.query)
      if (!range) return res.status(400).json({ success: false, message: 'Invalid date range' })
      const { from, to } = range

      const result = await pool.query(
        `SELECT id, first_name, last_name, email, phone, created_at, contacted, admin_notes,
          visitor_id, landing_page, utm_source, utm_medium, utm_campaign, lead_status,
          interests_array, interests
         FROM registrations
         WHERE archived IS NOT TRUE AND created_at >= $1 AND created_at <= $2
         ORDER BY created_at DESC`,
        [from, to],
      )

      res.json({
        success: true,
        data: result.rows.map((r) => ({
          ...r,
          lead_status: normalizeLeadStatus(r),
        })),
      })
    } catch (err) {
      console.error('[analytics/inquiries]', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  const getConversion = async (req, res) => {
    try {
      const range = parseDateRange(req.query)
      if (!range) return res.status(400).json({ success: false, message: 'Invalid date range' })
      const { from, to } = range

      let newFamilies = { rows: [{ count: 0 }] }
      try {
        newFamilies = await pool.query(
          `SELECT COUNT(*)::int AS count FROM family WHERE created_at >= $1 AND created_at <= $2`,
          [from, to],
        )
      } catch {
        newFamilies = { rows: [{ count: 0 }] }
      }

      const notEnrolled = await pool.query(
        `SELECT r.id, r.first_name, r.last_name, r.email, r.created_at, r.contacted,
          r.utm_source, r.landing_page
         FROM registrations r
         WHERE r.archived IS NOT TRUE AND r.created_at >= $1 AND r.created_at <= $2
         AND NOT EXISTS (
           SELECT 1 FROM member m WHERE LOWER(TRIM(m.email)) = LOWER(TRIM(r.email))
         )
         ORDER BY r.created_at DESC
         LIMIT 200`,
        [from, to],
      )

      res.json({
        success: true,
        data: {
          newFamilies: newFamilies.rows[0].count,
          inquiriesNotEnrolled: notEnrolled.rows,
        },
      })
    } catch (err) {
      console.error('[analytics/conversion]', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  const exportReport = async (req, res) => {
    try {
      const reportType = req.query.reportType || 'inquiries'
      const range = parseDateRange(req.query)
      if (!range) return res.status(400).json({ success: false, message: 'Invalid date range' })
      const { from, to } = range

      await logAudit(pool, {
        adminUserId: req.adminId,
        action: 'analytics_export',
        details: { reportType, from, to },
      })

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="vortex-${reportType}-${from.toISOString().slice(0, 10)}.csv"`,
      )

      if (reportType === 'inquiries') {
        const result = await pool.query(
          `SELECT created_at, first_name, last_name, email, phone, contacted,
            utm_source, utm_medium, utm_campaign, landing_page, visitor_id, lead_status,
            interests_array
           FROM registrations
           WHERE archived IS NOT TRUE AND created_at >= $1 AND created_at <= $2
           ORDER BY created_at DESC`,
          [from, to],
        )
        const header =
          'created_at,first_name,last_name,email,phone,contacted,utm_source,utm_medium,utm_campaign,landing_page,visitor_id,lead_status,interests\n'
        res.write(header)
        for (const row of result.rows) {
          const interests = (row.interests_array || []).join('; ')
          const line = [
            row.created_at?.toISOString?.() || row.created_at,
            csvEscape(row.first_name),
            csvEscape(row.last_name),
            csvEscape(row.email),
            csvEscape(row.phone),
            row.contacted,
            csvEscape(row.utm_source),
            csvEscape(row.utm_medium),
            csvEscape(row.utm_campaign),
            csvEscape(row.landing_page),
            csvEscape(row.visitor_id),
            normalizeLeadStatus(row),
            csvEscape(interests),
          ].join(',')
          res.write(line + '\n')
        }
        return res.end()
      }

      if (reportType === 'programs') {
        const result = await pool.query(`
          SELECT p.display_name,
            COALESCE(SUM(c.current_enrollment), 0) AS enrolled,
            COALESCE(SUM(c.max_capacity), 0) AS capacity
          FROM program p
          LEFT JOIN class c ON c.program_id = p.id
          GROUP BY p.display_name
        `)
        res.write('program,enrolled,capacity,fill_rate\n')
        for (const row of result.rows) {
          const fill =
            row.capacity > 0
              ? Math.round((row.enrolled / row.capacity) * 1000) / 10
              : ''
          res.write(
            `${csvEscape(row.display_name)},${row.enrolled},${row.capacity},${fill}\n`,
          )
        }
        return res.end()
      }

      res.status(400).json({ success: false, message: 'Unknown reportType' })
    } catch (err) {
      console.error('[analytics/export]', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  const getSeo = async (req, res) => {
    try {
      const range = parseDateRange(req.query)
      if (!range) return res.status(400).json({ success: false, message: 'Invalid date range' })
      const { from, to } = range

      const keywords = await pool.query(
        `SELECT k.query, k.page, r.date, r.impressions, r.clicks, r.position, r.ctr
         FROM seo_rankings r
         JOIN seo_keywords k ON k.id = r.keyword_id
         WHERE r.date >= $1::date AND r.date <= $2::date
         ORDER BY r.clicks DESC LIMIT 100`,
        [from, to],
      )

      const landingConv = await pool.query(
        `SELECT landing_page, COUNT(*)::int AS inquiries
         FROM registrations
         WHERE archived IS NOT TRUE AND created_at >= $1 AND created_at <= $2
         AND landing_page IS NOT NULL
         GROUP BY landing_page ORDER BY inquiries DESC LIMIT 20`,
        [from, to],
      )

      const dailyGa = await pool.query(
        `SELECT date, sessions, users, page_views, source
         FROM analytics_daily_traffic
         WHERE date >= $1::date AND date <= $2::date
         ORDER BY date`,
        [from, to],
      )

      const configured = Boolean(
        process.env.GA4_PROPERTY_ID || process.env.GSC_SITE_URL,
      )

      res.json({
        success: true,
        data: {
          configured,
          keywords: keywords.rows,
          inquiriesByLandingPage: landingConv.rows,
          dailyTraffic: dailyGa.rows,
        },
      })
    } catch (err) {
      console.error('[analytics/seo]', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  const postSync = async (req, res) => {
    try {
      const result = await syncExternalAnalytics(pool)
      res.json({ success: true, data: result })
    } catch (err) {
      console.error('[analytics/sync]', err)
      res.status(500).json({ success: false, message: err.message || 'Sync failed' })
    }
  }

  const listCompetitors = async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT c.*,
          (SELECT row_to_json(s) FROM (
            SELECT rating, review_count, programs_json, notes, captured_at, source
            FROM competitor_snapshots
            WHERE competitor_id = c.id
            ORDER BY captured_at DESC LIMIT 1
          ) s) AS latest_snapshot
        FROM competitors c ORDER BY c.name
      `)
      res.json({ success: true, data: result.rows })
    } catch (err) {
      console.error('[competitors]', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  const createCompetitor = async (req, res) => {
    try {
      const schema = Joi.object({
        name: Joi.string().required(),
        websiteUrl: Joi.string().uri().allow('', null),
        gbpPlaceId: Joi.string().allow('', null),
        notes: Joi.string().allow('', null),
      })
      const { error, value } = schema.validate(req.body)
      if (error) return res.status(400).json({ success: false, message: error.message })

      const r = await pool.query(
        `INSERT INTO competitors (name, website_url, gbp_place_id, notes)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [value.name, value.websiteUrl || null, value.gbpPlaceId || null, value.notes || null],
      )
      res.json({ success: true, data: r.rows[0] })
    } catch (err) {
      console.error('[competitors POST]', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  const updateCompetitor = async (req, res) => {
    try {
      const schema = Joi.object({
        name: Joi.string(),
        websiteUrl: Joi.string().uri().allow('', null),
        gbpPlaceId: Joi.string().allow('', null),
        notes: Joi.string().allow('', null),
      })
      const { error, value } = schema.validate(req.body)
      if (error) return res.status(400).json({ success: false, message: error.message })

      const r = await pool.query(
        `UPDATE competitors SET
          name = COALESCE($1, name),
          website_url = COALESCE($2, website_url),
          gbp_place_id = COALESCE($3, gbp_place_id),
          notes = COALESCE($4, notes),
          updated_at = now()
         WHERE id = $5 RETURNING *`,
        [
          value.name,
          value.websiteUrl,
          value.gbpPlaceId,
          value.notes,
          req.params.id,
        ],
      )
      if (!r.rows.length) return res.status(404).json({ success: false, message: 'Not found' })
      res.json({ success: true, data: r.rows[0] })
    } catch (err) {
      console.error('[competitors PUT]', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  const addSnapshot = async (req, res) => {
    try {
      const schema = Joi.object({
        rating: Joi.number().min(0).max(5).allow(null),
        reviewCount: Joi.number().integer().min(0).allow(null),
        programsJson: Joi.object().unknown(true).allow(null),
        notes: Joi.string().allow('', null),
      })
      const { error, value } = schema.validate(req.body)
      if (error) return res.status(400).json({ success: false, message: error.message })

      const r = await pool.query(
        `INSERT INTO competitor_snapshots (competitor_id, rating, review_count, programs_json, notes, source)
         VALUES ($1, $2, $3, $4, $5, 'manual') RETURNING *`,
        [
          req.params.id,
          value.rating,
          value.reviewCount,
          value.programsJson ? JSON.stringify(value.programsJson) : null,
          value.notes || null,
        ],
      )
      res.json({ success: true, data: r.rows[0] })
    } catch (err) {
      console.error('[competitor snapshot]', err)
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  const listCampaigns = async (req, res) => {
    try {
      const r = await pool.query(`SELECT * FROM marketing_campaigns ORDER BY start_date DESC NULLS LAST`)
      res.json({ success: true, data: r.rows })
    } catch (err) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  const createCampaign = async (req, res) => {
    try {
      const schema = Joi.object({
        name: Joi.string().required(),
        channel: Joi.string().allow('', null),
        utmCampaign: Joi.string().allow('', null),
        budget: Joi.number().allow(null),
        startDate: Joi.date().allow(null),
        endDate: Joi.date().allow(null),
        notes: Joi.string().allow('', null),
      })
      const { error, value } = schema.validate(req.body)
      if (error) return res.status(400).json({ success: false, message: error.message })

      const r = await pool.query(
        `INSERT INTO marketing_campaigns (name, channel, utm_campaign, budget, start_date, end_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          value.name,
          value.channel,
          value.utmCampaign,
          value.budget,
          value.startDate,
          value.endDate,
          value.notes,
        ],
      )
      res.json({ success: true, data: r.rows[0] })
    } catch (err) {
      res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }

  return {
    getOverview,
    getTraffic,
    getFunnel,
    getPrograms,
    getInquiries,
    getConversion,
    exportReport,
    getSeo,
    postSync,
    listCompetitors,
    createCompetitor,
    updateCompetitor,
    addSnapshot,
    listCampaigns,
    createCampaign,
  }
}

function csvEscape(val) {
  if (val == null) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** Attach attribution fields when creating a registration (used from server.js). */
export async function applyRegistrationAttribution(pool, inquiryId, body) {
  const visitorId = body.visitorId || body.visitor_id || null
  const landingPage = body.landingPage || body.landing_page || null
  const utm = {
    source: body.utmSource || body.utm_source || null,
    medium: body.utmMedium || body.utm_medium || null,
    campaign: body.utmCampaign || body.utm_campaign || null,
    content: body.utmContent || body.utm_content || null,
    term: body.utmTerm || body.utm_term || null,
    clickIds: body.clickIds || null,
  }

  await pool.query(
    `UPDATE registrations SET
      visitor_id = COALESCE($1, visitor_id),
      landing_page = COALESCE($2, landing_page),
      utm_source = COALESCE($3, utm_source),
      utm_medium = COALESCE($4, utm_medium),
      utm_campaign = COALESCE($5, utm_campaign),
      utm_content = COALESCE($6, utm_content),
      utm_term = COALESCE($7, utm_term)
     WHERE id = $8`,
    [
      visitorId,
      landingPage,
      utm.source,
      utm.medium,
      utm.campaign,
      utm.content,
      utm.term,
      inquiryId,
    ],
  )

  if (visitorId) {
    await pool.query(
      `INSERT INTO visitor_identities (visitor_id, inquiry_id, link_method)
       VALUES ($1, $2, 'inquiry_form')`,
      [visitorId, inquiryId],
    )
    await recordUtmAttribution(pool, {
      visitorId,
      inquiryId,
      touchType: 'last',
      utm,
      landingPage,
    })
  }

  if (body.visitorId) {
    await pool.query(
      `INSERT INTO analytics_events (
        event_id, event_name, occurred_at, visitor_id, session_id,
        page_path, hostname, properties, consent_analytics, consent_marketing, is_staff
      ) VALUES (gen_random_uuid(), 'inquiry_form_submit', now(), $1, $2, $3, $4, $5, true, false, false)
      ON CONFLICT DO NOTHING`,
      [
        visitorId,
        body.sessionId || visitorId,
        landingPage || '/',
        body.hostname || null,
        JSON.stringify({ inquiryId }),
      ],
    ).catch(() => {})
  }
}

export { hashEmail, normalizeLeadStatus }
