import { ENTITIES } from './registry.js'

const DEFAULT_LIMIT = 1000
const MAX_LIMIT = 50000
const STATEMENT_TIMEOUT_MS = 15000

const OPS = {
  eq: { sql: '= $', needsValue: true },
  neq: { sql: '<> $', needsValue: true },
  gt: { sql: '> $', needsValue: true },
  lt: { sql: '< $', needsValue: true },
  contains: { sql: 'ILIKE $', needsValue: true, wrap: (v) => `%${v}%` },
  is_null: { sql: 'IS NULL', needsValue: false },
  not_null: { sql: 'IS NOT NULL', needsValue: false },
  is_true: { sql: '= TRUE', needsValue: false },
  is_false: { sql: '= FALSE', needsValue: false },
}

class QueryError extends Error {}

// Resolve a {entity, field} column reference against the base entity.
// `entity` is either the base entity key (own field) or a relation key.
function resolveColumn(base, ref) {
  const { entity, field } = ref || {}
  if (!field) throw new QueryError('Column field is required')

  if (entity === base.key || entity === 'self' || entity == null) {
    const f = base.fields.find((x) => x.key === field)
    if (!f) throw new QueryError(`Unknown field "${field}" on ${base.key}`)
    return { kind: 'self', relKey: null, def: f }
  }

  const rel = base.relations?.[entity]
  if (!rel) throw new QueryError(`Unknown relation "${entity}" on ${base.key}`)
  const f = rel.fields.find((x) => x.key === field)
  if (!f) throw new QueryError(`Unknown field "${field}" on relation ${entity}`)
  return { kind: rel.cardinality === 'many' ? 'many' : 'one', relKey: entity, rel, def: f }
}

export function buildQuery(input) {
  const baseEntity = input?.baseEntity
  const base = ENTITIES[baseEntity]
  if (!base) throw new QueryError('Invalid base entity')

  const columns = Array.isArray(input.columns) ? input.columns : []
  if (columns.length === 0) throw new QueryError('Select at least one column')

  const resolved = columns.map((c) => resolveColumn(base, c))

  const oneRels = new Set()
  const manyRels = new Map() // relKey -> { rel, fields:Set }

  resolved.forEach((r) => {
    if (r.kind === 'one') oneRels.add(r.relKey)
    if (r.kind === 'many') {
      if (!manyRels.has(r.relKey)) manyRels.set(r.relKey, { rel: r.rel, fields: new Map() })
      manyRels.get(r.relKey).fields.set(r.def.key, r.def)
    }
  })

  // SELECT list
  const params = []
  const selectParts = resolved.map((r, idx) => {
    const alias = `c${idx}`
    if (r.kind === 'self' || r.kind === 'one') {
      return `${r.def.expr} AS "${alias}"`
    }
    // many: pull from aggregated subquery
    return `m_${r.relKey}."f_${r.def.key}" AS "${alias}"`
  })

  // FROM + JOINs
  const joins = []
  oneRels.forEach((relKey) => {
    joins.push(base.relations[relKey].joinSql)
  })
  manyRels.forEach((info, relKey) => {
    const rel = info.rel
    const aggSelects = [...info.fields.values()].map(
      (f) => `string_agg(DISTINCT (${f.expr})::text, ', ') AS "f_${f.key}"`,
    )
    const whereSql = rel.extraWhere ? `WHERE ${rel.extraWhere}` : ''
    joins.push(
      `LEFT JOIN (
        SELECT ${rel.baseLink} AS __bid, ${aggSelects.join(', ')}
        FROM ${rel.from}
        ${whereSql}
        GROUP BY ${rel.baseLink}
      ) m_${relKey} ON m_${relKey}.__bid = t0.${base.pk}`,
    )
  })

  // WHERE (filters on self + to-one only)
  const whereClauses = []
  const filters = Array.isArray(input.filters) ? input.filters : []
  filters.forEach((flt) => {
    const r = resolveColumn(base, flt)
    if (r.kind === 'many') throw new QueryError('Filtering on a list relation is not supported')
    const op = OPS[flt.op]
    if (!op) throw new QueryError(`Unsupported filter op "${flt.op}"`)
    if (op.needsValue) {
      const val = op.wrap ? op.wrap(flt.value) : flt.value
      params.push(val)
      whereClauses.push(`${r.def.expr} ${op.sql}${params.length}`)
    } else {
      whereClauses.push(`${r.def.expr} ${op.sql}`)
    }
  })

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''

  let limit = Number.parseInt(input.limit, 10)
  if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_LIMIT
  limit = Math.min(limit, MAX_LIMIT)

  const sql = `
    SELECT ${selectParts.join(', ')}
    FROM ${base.table} t0
    ${joins.join('\n')}
    ${whereSql}
    ORDER BY t0.${base.pk}
    LIMIT ${limit}
  `

  // Column metadata for the response/CSV header
  const meta = resolved.map((r, idx) => ({
    key: `c${idx}`,
    label: r.relKey ? `${base.relations[r.relKey].label}: ${r.def.label}` : r.def.label,
    type: r.def.type,
  }))

  return { sql, params, meta }
}

// Execute a built query inside a read-only transaction with a statement timeout.
export async function runQuery(pool, input) {
  const { sql, params, meta } = buildQuery(input)
  const client = await pool.connect()
  try {
    await client.query('BEGIN READ ONLY')
    await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`)
    const result = await client.query(sql, params)
    await client.query('COMMIT')
    return { columns: meta, rows: result.rows }
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    throw err
  } finally {
    client.release()
  }
}

export { QueryError }
