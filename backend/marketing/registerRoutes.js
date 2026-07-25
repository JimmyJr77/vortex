import Joi from 'joi'

const statusValues = ['not_started', 'planned', 'in_progress', 'active', 'needs_attention', 'paused']
const priorityValues = ['critical', 'high', 'medium', 'low']
const objectValue = Joi.object().unknown(true)
const secretReference = Joi.string().trim().pattern(/^[A-Z][A-Z0-9_]{1,127}$/).max(128)
const sensitiveKey = /(?:password|passphrase|access[_-]?token|refresh[_-]?token|api[_-]?key|private[_-]?key|client[_-]?secret|auth[_-]?token|secret)$/i

const channelSchema = Joi.object({
  name: Joi.string().trim().max(160),
  category: Joi.string().trim().max(60),
  description: Joi.string().allow('', null).max(4000),
  websiteUrl: Joi.string().uri().allow('', null),
  accountUrl: Joi.string().uri().allow('', null),
  username: Joi.string().trim().allow('', null).max(255),
  ownerName: Joi.string().trim().allow('', null).max(160),
  status: Joi.string().valid(...statusValues),
  priority: Joi.string().valid(...priorityValues),
  settings: objectValue,
  inputs: objectValue,
  secretRefs: Joi.array().items(secretReference).max(30),
  notes: Joi.string().allow('', null).max(8000),
  lastVerifiedAt: Joi.date().iso().allow(null),
  nextReviewAt: Joi.date().iso().allow(null),
}).min(1)

export const findEmbeddedSecrets = (value, path = []) => {
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, child]) => {
    const nextPath = [...path, key]
    if (sensitiveKey.test(key) && child !== '' && child !== null && child !== undefined) return [nextPath.join('.')]
    return findEmbeddedSecrets(child, nextPath)
  })
}

const isPopulated = (value) => {
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') return Object.values(value).some(isPopulated)
  return value !== '' && value !== null && value !== undefined
}

export const channelReadiness = (channel) => {
  const inputs = channel.inputs || {}
  const missingInputs = Object.entries(inputs).filter(([, value]) => !isPopulated(value)).map(([key]) => key)
  const blockers = []
  if (!channel.ownerName) blockers.push('Internal owner is not assigned')
  if (missingInputs.length) blockers.push(`Missing inputs: ${missingInputs.join(', ')}`)
  if (!channel.nextReviewAt) blockers.push('Next review date is not scheduled')
  if (!['active', 'in_progress'].includes(channel.status)) blockers.push(`Status is ${channel.status.replaceAll('_', ' ')}`)
  return { ready: blockers.length === 0, blockers, completedInputs: Object.keys(inputs).length - missingInputs.length, totalInputs: Object.keys(inputs).length }
}

const validateSafePayload = (value) => {
  const embedded = [...findEmbeddedSecrets(value.inputs), ...findEmbeddedSecrets(value.settings)]
  return embedded.length ? `Credentials cannot be stored in inputs or settings (${embedded.join(', ')}). Add environment-variable names to secretRefs instead.` : null
}

const mapChannel = (row) => ({
  id: Number(row.id),
  key: row.key,
  name: row.name,
  category: row.category,
  description: row.description,
  websiteUrl: row.website_url,
  accountUrl: row.account_url,
  username: row.username,
  ownerName: row.owner_name,
  status: row.status,
  priority: row.priority,
  settings: row.settings || {},
  inputs: row.inputs || {},
  secretRefs: row.secret_refs || [],
  notes: row.notes,
  lastVerifiedAt: row.last_verified_at,
  nextReviewAt: row.next_review_at,
  updatedAt: row.updated_at,
  readiness: channelReadiness({
    ownerName: row.owner_name,
    status: row.status,
    inputs: row.inputs || {},
    nextReviewAt: row.next_review_at,
  }),
})

const channelSelect = `SELECT id, key, name, category, description, website_url, account_url,
  username, owner_name, status, priority, settings, inputs, secret_refs, notes,
  last_verified_at, next_review_at, updated_at FROM marketing_channels`

export function registerMarketingRoutes(app, pool) {
  app.get('/api/admin/marketing/channels', async (_req, res) => {
    try {
      const result = await pool.query(`${channelSelect} ORDER BY category, priority, name`)
      const revisions = await pool.query(
        `SELECT id, version, status, channel_count, notes, created_at, implemented_at
         FROM marketing_publish_revisions ORDER BY version DESC LIMIT 10`,
      )
      res.json({ success: true, data: { channels: result.rows.map(mapChannel), revisions: revisions.rows } })
    } catch (error) {
      console.error('[marketing/channels]', error)
      res.status(500).json({ success: false, message: 'Unable to load marketing channels' })
    }
  })

  app.post('/api/admin/marketing/channels', async (req, res) => {
    const createSchema = channelSchema.keys({
      name: Joi.string().trim().max(160).required(),
      category: Joi.string().trim().max(60).required(),
    })
    const { error, value } = createSchema.validate(req.body, { stripUnknown: true })
    if (error) return res.status(400).json({ success: false, message: error.details[0].message })
    const unsafePayload = validateSafePayload(value)
    if (unsafePayload) return res.status(400).json({ success: false, message: unsafePayload })
    const baseKey = value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'channel'
    try {
      const result = await pool.query(
        `INSERT INTO marketing_channels
          (key, name, category, description, website_url, account_url, username, owner_name,
           status, priority, settings, inputs, secret_refs, notes, next_review_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING *`,
        [
          `${baseKey}-${Date.now().toString(36)}`, value.name, value.category, value.description || null,
          value.websiteUrl || null, value.accountUrl || null, value.username || null, value.ownerName || null,
          value.status || 'not_started', value.priority || 'medium', value.settings || {},
          value.inputs || {}, value.secretRefs || [], value.notes || null, value.nextReviewAt || null,
        ],
      )
      res.status(201).json({ success: true, data: mapChannel(result.rows[0]) })
    } catch (dbError) {
      console.error('[marketing/channel create]', dbError)
      res.status(500).json({ success: false, message: 'Unable to create channel' })
    }
  })

  app.put('/api/admin/marketing/channels/:id', async (req, res) => {
    const { error, value } = channelSchema.validate(req.body, { stripUnknown: true })
    if (error) return res.status(400).json({ success: false, message: error.details[0].message })
    const unsafePayload = validateSafePayload(value)
    if (unsafePayload) return res.status(400).json({ success: false, message: unsafePayload })
    const fieldMap = {
      name: 'name', category: 'category', description: 'description', websiteUrl: 'website_url',
      accountUrl: 'account_url', username: 'username', ownerName: 'owner_name', status: 'status',
      priority: 'priority', settings: 'settings', inputs: 'inputs', secretRefs: 'secret_refs',
      notes: 'notes', lastVerifiedAt: 'last_verified_at', nextReviewAt: 'next_review_at',
    }
    const entries = Object.entries(value)
    const sets = entries.map(([key], index) => `${fieldMap[key]} = $${index + 1}`)
    const values = entries.map(([, item]) => item)
    values.push(req.params.id)
    try {
      const result = await pool.query(
        `UPDATE marketing_channels SET ${sets.join(', ')}, updated_at = now()
         WHERE id = $${values.length} RETURNING *`,
        values,
      )
      if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Channel not found' })
      await pool.query(
        `INSERT INTO audit_log (admin_user_id, action, details) VALUES ($1, 'marketing.channel.updated', $2)`,
        [req.adminId || null, JSON.stringify({ channelId: Number(req.params.id), fields: entries.map(([key]) => key) })],
      )
      res.json({ success: true, data: mapChannel(result.rows[0]) })
    } catch (dbError) {
      console.error('[marketing/channel update]', dbError)
      res.status(500).json({ success: false, message: 'Unable to update channel' })
    }
  })

  app.post('/api/admin/marketing/publish', async (req, res) => {
    let client
    try {
      client = await pool.connect()
      await client.query('BEGIN')
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('marketing_publish_revisions'))`)
      const channels = await client.query(`${channelSelect} ORDER BY category, key`)
      const version = await client.query(`SELECT COALESCE(MAX(version), 0) + 1 AS version FROM marketing_publish_revisions`)
      const mappedChannels = channels.rows.map(mapChannel)
      const criticalBlockers = mappedChannels
        .filter((channel) => channel.priority === 'critical' && !channel.readiness.ready)
        .map((channel) => ({ key: channel.key, name: channel.name, blockers: channel.readiness.blockers }))
      const publicationStatus = criticalBlockers.length ? 'draft' : 'ready'
      const snapshot = {
        schemaVersion: 2,
        generatedAt: new Date().toISOString(),
        publicationStatus,
        readiness: {
          readyChannels: mappedChannels.filter((channel) => channel.readiness.ready).length,
          totalChannels: mappedChannels.length,
          criticalBlockers,
        },
        channels: mappedChannels,
      }
      const result = await client.query(
        `INSERT INTO marketing_publish_revisions (version, status, channel_count, snapshot, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, version, status, channel_count, notes, created_at`,
        [version.rows[0].version, publicationStatus, channels.rowCount, JSON.stringify(snapshot), req.body?.notes || null, req.adminId || null],
      )
      await client.query('COMMIT')
      res.status(201).json({ success: true, data: { revision: result.rows[0], manifest: snapshot } })
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {})
      console.error('[marketing/publish]', error)
      res.status(500).json({ success: false, message: 'Unable to create implementation package' })
    } finally {
      client?.release()
    }
  })

  app.get('/api/admin/marketing/publish/:version', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT version, status, snapshot, notes, created_at FROM marketing_publish_revisions WHERE version = $1`,
        [req.params.version],
      )
      if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Revision not found' })
      res.json({ success: true, data: result.rows[0] })
    } catch {
      res.status(500).json({ success: false, message: 'Unable to load revision' })
    }
  })
}
