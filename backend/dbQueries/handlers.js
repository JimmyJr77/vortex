import { getRegistryForClient } from './registry.js'
import { runQuery, QueryError } from './runner.js'

function toCsvValue(v) {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function createDbQueryHandlers(pool) {
  return {
    getEntities(_req, res) {
      res.json({ success: true, data: getRegistryForClient() })
    },

    async run(req, res) {
      try {
        const result = await runQuery(pool, req.body || {})
        res.json({ success: true, data: result })
      } catch (err) {
        if (err instanceof QueryError) {
          return res.status(400).json({ success: false, message: err.message })
        }
        console.error('[db-queries] run:', err)
        res.status(500).json({ success: false, message: 'Failed to run query' })
      }
    },

    async exportCsv(req, res) {
      try {
        const result = await runQuery(pool, { ...(req.body || {}), limit: req.body?.limit || 50000 })
        const header = result.columns.map((c) => toCsvValue(c.label)).join(',')
        const lines = result.rows.map((row) =>
          result.columns.map((c) => toCsvValue(row[c.key])).join(','),
        )
        const csv = [header, ...lines].join('\r\n')
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', 'attachment; filename="db-query.csv"')
        res.send(csv)
      } catch (err) {
        if (err instanceof QueryError) {
          return res.status(400).json({ success: false, message: err.message })
        }
        console.error('[db-queries] exportCsv:', err)
        res.status(500).json({ success: false, message: 'Failed to export query' })
      }
    },

    async listSaved(_req, res) {
      try {
        const result = await pool.query('SELECT * FROM saved_query ORDER BY name')
        res.json({
          success: true,
          data: result.rows.map((r) => ({
            id: Number(r.id),
            name: r.name,
            baseEntity: r.base_entity,
            config: r.config,
            createdBy: r.created_by,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          })),
        })
      } catch (err) {
        console.error('[db-queries] listSaved:', err)
        res.status(500).json({ success: false, message: 'Failed to load saved queries' })
      }
    },

    async saveQuery(req, res) {
      try {
        const { id, name, baseEntity, config } = req.body || {}
        if (!name || !String(name).trim()) {
          return res.status(400).json({ success: false, message: 'Query name is required' })
        }
        if (!baseEntity || !config) {
          return res.status(400).json({ success: false, message: 'baseEntity and config are required' })
        }
        const createdBy = req.adminEmail || null
        if (id) {
          const upd = await pool.query(
            `UPDATE saved_query SET name = $1, base_entity = $2, config = $3, updated_at = now() WHERE id = $4 RETURNING id`,
            [String(name).trim(), baseEntity, config, id],
          )
          if (upd.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Saved query not found' })
          }
          return res.json({ success: true, data: { id: Number(upd.rows[0].id) } })
        }
        const ins = await pool.query(
          `INSERT INTO saved_query (name, base_entity, config, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
          [String(name).trim(), baseEntity, config, createdBy],
        )
        res.json({ success: true, data: { id: Number(ins.rows[0].id) } })
      } catch (err) {
        console.error('[db-queries] saveQuery:', err)
        res.status(500).json({ success: false, message: 'Failed to save query' })
      }
    },

    async deleteSaved(req, res) {
      try {
        const result = await pool.query('DELETE FROM saved_query WHERE id = $1 RETURNING id', [req.params.id])
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Saved query not found' })
        }
        res.json({ success: true, message: 'Saved query deleted' })
      } catch (err) {
        console.error('[db-queries] deleteSaved:', err)
        res.status(500).json({ success: false, message: 'Failed to delete saved query' })
      }
    },
  }
}
