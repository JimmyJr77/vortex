import rateLimit from 'express-rate-limit'
import { llmGenerateText, isLlmConfigured } from '../platform/aiService.js'
import { OPPORTUNITY_CATEGORIES, seedOpportunities } from './opportunityData.js'

const VALID_STATUS = new Set(['new', 'researching', 'contacted', 'negotiating', 'won', 'passed'])
const VALID_PRIORITY = new Set(['high', 'medium', 'low'])
const clean = (value, max = 2000) => String(value ?? '').trim().slice(0, max)
const LEGACY_ROCHESTER_SEED_URLS = [
  'https://www.fdhbcuclassic.com/become-a-vendor',
  'https://www.swpc.org/events/south-wedge-festival',
  'https://www.cityofrochester.gov/events/great-new-york-state-flea-public-market-2026',
  'https://www.queerartsfest.com/',
  'https://www.sunshinecamp.org/events/',
  'https://www.paullouisarena.com/',
  'https://www.filmrochester.org/guide/esl-sports-centre/',
  'https://www.cityofrochester.gov/departments/department-recreation-and-human-services-drhs/r-central',
]

async function insertSeedOpportunities(pool) {
  for (const item of seedOpportunities) {
    await pool.query(`
      INSERT INTO admin_opportunities (
        name, category, kind, status, priority, location, event_date, deadline,
        contact_name, contact_email, contact_phone, website_url, source_url,
        audience, support_offer, edge_strategy, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    `, [
      item.name, item.category, item.kind, item.status, item.priority, item.location,
      item.eventDate, item.deadline, item.contactName, item.contactEmail, item.contactPhone,
      item.websiteUrl, item.sourceUrl, item.audience, item.supportOffer, item.edgeStrategy, item.notes,
    ])
  }
}

export async function initOpportunityTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_opportunities (
      id SERIAL PRIMARY KEY,
      name VARCHAR(240) NOT NULL,
      category VARCHAR(120) NOT NULL,
      kind VARCHAR(40) NOT NULL DEFAULT 'event',
      status VARCHAR(40) NOT NULL DEFAULT 'new',
      priority VARCHAR(20) NOT NULL DEFAULT 'medium',
      location VARCHAR(300),
      event_date DATE,
      deadline DATE,
      contact_name VARCHAR(200),
      contact_email VARCHAR(240),
      contact_phone VARCHAR(80),
      website_url TEXT,
      source_url TEXT,
      audience TEXT,
      support_offer TEXT,
      edge_strategy TEXT,
      notes TEXT,
      last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by INTEGER,
      updated_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await pool.query(`ALTER TABLE admin_opportunities ADD COLUMN IF NOT EXISTS opportunity_value INTEGER NOT NULL DEFAULT 0`)
  await pool.query(`ALTER TABLE admin_opportunities ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE`)
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM admin_opportunities')
  if (rows[0].count === 0) {
    await insertSeedOpportunities(pool)
    return
  }

  // The original starter catalog was mistakenly seeded for Rochester. Replace only
  // those known seed records; preserve any other records an admin may have created.
  const legacy = await pool.query(
    'DELETE FROM admin_opportunities WHERE source_url = ANY($1::text[]) RETURNING id',
    [LEGACY_ROCHESTER_SEED_URLS],
  )
  if (legacy.rowCount > 0) await insertSeedOpportunities(pool)
}

function payload(body = {}) {
  return {
    name: clean(body.name, 240),
    category: OPPORTUNITY_CATEGORIES.includes(body.category) ? body.category : OPPORTUNITY_CATEGORIES[0],
    kind: ['event', 'venue', 'partner'].includes(body.kind) ? body.kind : 'event',
    status: VALID_STATUS.has(body.status) ? body.status : 'new',
    priority: VALID_PRIORITY.has(body.priority) ? body.priority : 'medium',
    location: clean(body.location, 300),
    eventDate: body.eventDate || null,
    deadline: body.deadline || null,
    contactName: clean(body.contactName, 200),
    contactEmail: clean(body.contactEmail, 240),
    contactPhone: clean(body.contactPhone, 80),
    websiteUrl: clean(body.websiteUrl, 1500),
    sourceUrl: clean(body.sourceUrl, 1500),
    audience: clean(body.audience),
    supportOffer: clean(body.supportOffer),
    edgeStrategy: clean(body.edgeStrategy),
    notes: clean(body.notes, 4000),
    opportunityValue: Math.max(0, Math.min(100, Number(body.opportunityValue) || 0)),
  }
}

const mapRow = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  kind: row.kind,
  status: row.status,
  priority: row.priority,
  location: row.location || '',
  eventDate: row.event_date,
  deadline: row.deadline,
  contactName: row.contact_name || '',
  contactEmail: row.contact_email || '',
  contactPhone: row.contact_phone || '',
  websiteUrl: row.website_url || '',
  sourceUrl: row.source_url || '',
  audience: row.audience || '',
  supportOffer: row.support_offer || '',
  edgeStrategy: row.edge_strategy || '',
  notes: row.notes || '',
  lastVerifiedAt: row.last_verified_at,
  updatedAt: row.updated_at,
  opportunityValue: Number(row.opportunity_value ?? 0),
  isFavorite: Boolean(row.is_favorite),
})

export function registerOpportunityRoutes(app, pool) {
  const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: Number(process.env.OPPORTUNITY_AI_HOURLY_LIMIT) || 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'AI hourly limit reached. Continue with manual research or try again later.' },
  })

  app.get('/api/admin/opportunities', async (_req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT * FROM admin_opportunities
        ORDER BY is_favorite DESC, opportunity_value DESC, event_date NULLS LAST, updated_at DESC
      `)
      res.json({ success: true, data: { opportunities: rows.map(mapRow), categories: OPPORTUNITY_CATEGORIES, aiEnabled: isLlmConfigured() } })
    } catch (error) {
      console.error('[opportunities] list failed:', error)
      res.status(500).json({ success: false, message: 'Unable to load opportunities' })
    }
  })

  app.post('/api/admin/opportunities', async (req, res) => {
    const item = payload(req.body)
    if (!item.name) return res.status(400).json({ success: false, message: 'Name is required' })
    try {
      const duplicate = await pool.query(
        `SELECT id FROM admin_opportunities WHERE LOWER(name)=LOWER($1)
         AND COALESCE(LOWER(location),'')=COALESCE(LOWER($2),'') LIMIT 1`,
        [item.name, item.location],
      )
      if (duplicate.rows[0]) return res.status(409).json({ success: false, message: 'A matching opportunity already exists.' })
      const { rows } = await pool.query(`
        INSERT INTO admin_opportunities (
          name, category, kind, status, priority, location, event_date, deadline,
          contact_name, contact_email, contact_phone, website_url, source_url,
          audience, support_offer, edge_strategy, notes, opportunity_value, created_by, updated_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$19)
        RETURNING *
      `, [...Object.values(item), req.adminId])
      res.status(201).json({ success: true, data: mapRow(rows[0]) })
    } catch (error) {
      console.error('[opportunities] create failed:', error)
      res.status(500).json({ success: false, message: 'Unable to create opportunity' })
    }
  })

  app.put('/api/admin/opportunities/:id', async (req, res) => {
    const item = payload(req.body)
    if (!item.name) return res.status(400).json({ success: false, message: 'Name is required' })
    try {
      const duplicate = await pool.query(
        `SELECT id FROM admin_opportunities WHERE id <> $3 AND LOWER(name)=LOWER($1)
         AND COALESCE(LOWER(location),'')=COALESCE(LOWER($2),'') LIMIT 1`,
        [item.name, item.location, req.params.id],
      )
      if (duplicate.rows[0]) return res.status(409).json({ success: false, message: 'A matching opportunity already exists.' })
      const { rows } = await pool.query(`
        UPDATE admin_opportunities SET
          name=$1, category=$2, kind=$3, status=$4, priority=$5, location=$6,
          event_date=$7, deadline=$8, contact_name=$9, contact_email=$10,
          contact_phone=$11, website_url=$12, source_url=$13, audience=$14,
          support_offer=$15, edge_strategy=$16, notes=$17, opportunity_value=$18, updated_by=$19,
          last_verified_at=CASE WHEN $20::boolean THEN NOW() ELSE last_verified_at END,
          updated_at=NOW()
        WHERE id=$21 RETURNING *
      `, [...Object.values(item), req.adminId, Boolean(req.body.markVerified), req.params.id])
      if (!rows[0]) return res.status(404).json({ success: false, message: 'Opportunity not found' })
      res.json({ success: true, data: mapRow(rows[0]) })
    } catch (error) {
      console.error('[opportunities] update failed:', error)
      res.status(500).json({ success: false, message: 'Unable to update opportunity' })
    }
  })

  app.patch('/api/admin/opportunities/:id/favorite', async (req, res) => {
    try {
      const { rows } = await pool.query(
        'UPDATE admin_opportunities SET is_favorite=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
        [Boolean(req.body?.isFavorite), req.params.id],
      )
      if (!rows[0]) return res.status(404).json({ success: false, message: 'Opportunity not found' })
      res.json({ success: true, data: mapRow(rows[0]) })
    } catch (error) {
      console.error('[opportunities] favorite failed:', error)
      res.status(500).json({ success: false, message: 'Unable to update favorite' })
    }
  })

  app.post('/api/admin/opportunities/ai-support', aiLimiter, async (req, res) => {
    if (!isLlmConfigured()) return res.status(503).json({ success: false, message: 'AI support is not configured' })
    const question = clean(req.body?.question, 800)
    if (!question) return res.status(400).json({ success: false, message: 'Ask a question first' })
    try {
      const { rows } = await pool.query(`
        SELECT name, category, kind, status, priority, location, event_date, deadline,
               contact_name, contact_email, contact_phone, audience, support_offer, edge_strategy, notes
        FROM admin_opportunities ORDER BY updated_at DESC LIMIT 30
      `)
      const answer = await llmGenerateText({
        system:
          'You are a concise business-development assistant for Vortex Athletics, a youth athletic-development organization. ' +
          'Only use facts in the supplied opportunity records. Never claim you browsed the web, verified a contact, or contacted anyone. ' +
          'Flag missing or stale facts. Give practical next actions, outreach angles, or a short draft when asked. ' +
          'Do not include sensitive member data. Keep the answer under 250 words.',
        prompt: `Opportunity records:\n${JSON.stringify(rows).slice(0, 18000)}\n\nAdmin request: ${question}`,
        maxTokens: 350,
      })
      if (!answer) throw new Error('No AI response')
      res.json({ success: true, data: { answer } })
    } catch (error) {
      console.error('[opportunities] AI support failed:', error)
      res.status(502).json({ success: false, message: 'AI support is temporarily unavailable' })
    }
  })
}
