const identifier = /^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?$/
const quote = value => '"' + String(value).replaceAll('"', '""') + '"'
const qualified = name => {
  if (!identifier.test(name)) throw new Error('Invalid deletion table.')
  return name.split('.').map(quote).join('.')
}

export function deletionBlocked(message = 'This account is linked to records that must be retained. Keep it archived or resolve those links first.') {
  return Object.assign(new Error(message), {
    statusCode: 409, code: 'ACCOUNT_DELETE_BLOCKED',
    blockers: [{ type: 'retained_account_records', message }],
  })
}

// Keys contain text values, preserving PostgreSQL bigint precision in JavaScript.
function matches(alias, parameter) {
  return `EXISTS (SELECT 1 FROM jsonb_array_elements(${parameter}::jsonb) candidate
    WHERE NOT EXISTS (SELECT 1 FROM jsonb_each_text(candidate) field
      WHERE (to_jsonb(${alias})->>field.key) IS DISTINCT FROM field.value))`
}

async function tableInfo(db, name) {
  qualified(name)
  const { rows: [table] } = await db.query(`SELECT c.oid::text AS oid,n.nspname AS schema_name,c.relname AS table_name,
    COALESCE((SELECT array_agg(a.attname::text ORDER BY k.ord)
      FROM (SELECT candidate.* FROM pg_index candidate
        WHERE candidate.indrelid=c.oid AND candidate.indisunique AND candidate.indisvalid
          AND candidate.indpred IS NULL AND candidate.indexprs IS NULL
          AND NOT EXISTS(SELECT 1 FROM unnest(candidate.indkey) WITH ORDINALITY key(num,ord)
            JOIN pg_attribute attribute ON attribute.attrelid=c.oid AND attribute.attnum=key.num
            WHERE key.ord<=candidate.indnkeyatts AND NOT attribute.attnotnull)
        ORDER BY candidate.indisprimary DESC,candidate.indnkeyatts,candidate.indexrelid LIMIT 1) i
      JOIN unnest(i.indkey) WITH ORDINALITY k(num,ord) ON k.ord<=i.indnkeyatts
      JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.num
      WHERE i.indrelid=c.oid),ARRAY[]::text[]) AS primary_key
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid=to_regclass($1)`, [name])
  return table ? { ...table, table: `${table.schema_name}.${table.table_name}` } : null
}

/** Capture and lock an exact deletion set before changing any of its parents. */
export async function captureDeletionTarget(db, table, predicate, values = []) {
  const info = await tableInfo(db, table)
  if (!info) return { table, keys: [], rows: [] }
  if (!info.primary_key.length) throw deletionBlocked(`Records in ${table} cannot be safely removed without a stable unique key.`)
  const { rows } = await db.query(`SELECT * FROM ${qualified(info.table)} WHERE ${predicate} FOR UPDATE`, values)
  const keys = rows.map(row => Object.fromEntries(info.primary_key.map(key => [key, String(row[key])])))
  return { table: info.table, keys, rows }
}

async function normalize(db, entries) {
  const result = []
  for (const entry of entries.filter(item => item.keys?.length)) {
    const info = await tableInfo(db, entry.table)
    if (!info?.primary_key.length) throw deletionBlocked('A deletion dependency no longer has a stable primary key.')
    const keys = entry.keys.map(key => {
      if (Object.keys(key).length !== info.primary_key.length || info.primary_key.some(column => key[column] == null)) {
        throw new Error(`Incomplete deletion key for ${entry.table}.`)
      }
      return Object.fromEntries(info.primary_key.map(column => [column, String(key[column])]))
    })
    result.push({ ...entry, ...info, keys })
  }
  return result
}

/**
 * Fail closed on every unplanned FK dependency, including CASCADE and SET NULL.
 * An explicitly allowed nullable backlink preserves its row and all other data.
 * Also check canonical/legacy identity columns whose schemas have no FK.
 * The caller owns a transaction and must have locked every captured target.
 */
export async function assertNoUnexpectedDeleteReferences(db, targets, { allowedNullReferences = [] } = {}) {
  const planned = await normalize(db, targets)
  if (!planned.length) return
  const allowed = await normalize(db, allowedNullReferences)
  const params = [], types = [], bind = value => { params.push(JSON.stringify(value)); types.push('jsonb'); return `$${params.length}` }
  for (const entry of [...planned, ...allowed]) entry.parameter = bind(entry.keys)
  const permitted = (oid, alias, column = null, nullable = false) => {
    const conditions = planned.filter(item => item.oid === oid).map(item => matches(alias, item.parameter))
    if (nullable) conditions.push(...allowed.filter(item => item.oid === oid && item.column === column).map(item => matches(alias, item.parameter)))
    return conditions.join(' OR ') || 'FALSE'
  }
  const { rows: foreignKeys } = await db.query(`SELECT c.oid::text,c.conrelid::text AS child_oid,c.confrelid::text AS parent_oid,c.confdeltype,
    ns.nspname AS child_schema,child.relname AS child_table,
    array_agg(ca.attname::text ORDER BY k.i) AS child_columns,array_agg(pa.attname::text ORDER BY k.i) AS parent_columns
    FROM pg_constraint c JOIN pg_class child ON child.oid=c.conrelid JOIN pg_namespace ns ON ns.oid=child.relnamespace
    JOIN generate_subscripts(c.conkey,1) k(i) ON TRUE
    JOIN pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=c.conkey[k.i]
    JOIN pg_attribute pa ON pa.attrelid=c.confrelid AND pa.attnum=c.confkey[k.i]
    WHERE c.contype='f' AND c.confrelid=ANY($1::oid[])
    GROUP BY c.oid,ns.nspname,child.relname`, [planned.map(item => item.oid)])
  const checks = foreignKeys.map(fk => {
    const parent = planned.find(item => item.oid === fk.parent_oid)
    const join = fk.child_columns.map((column, i) => `child.${quote(column)}=parent.${quote(fk.parent_columns[i])}`).join(' AND ')
    const nullable = fk.confdeltype === 'n' && fk.child_columns.length === 1
    return `SELECT 1 FROM ${quote(fk.child_schema)}.${quote(fk.child_table)} child
      WHERE (${permitted(fk.child_oid, 'child', fk.child_columns[0], nullable)}) IS NOT TRUE
      AND EXISTS (SELECT 1 FROM ${qualified(parent.table)} parent WHERE ${permitted(parent.oid, 'parent')} AND ${join})`
  })

  const roots = new Map()
  for (const entry of planned) if (entry.primary_key.length === 1 && entry.primary_key[0] === 'id') {
    const ids = roots.get(entry.table_name) || []
    roots.set(entry.table_name, [...ids, ...entry.keys.map(key => key.id)])
  }
  const { rows: columns } = await db.query(`SELECT c.oid::text AS oid,n.nspname AS schema_name,c.relname AS table_name,
    a.attname AS column_name,t.typcategory='A' AS is_array
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped JOIN pg_type t ON t.oid=a.atttypid
    WHERE c.relkind IN('r','p') AND n.nspname=ANY($1::text[])
      AND (a.attname ~ '(member_id|family_id|billing_account_id|user_id|signup_id)$'
        OR a.attname IN('parent_guardian_ids','registration_id','inquiry_id','account_invite_id','author_id','created_by','updated_by','reviewer_id')
        OR (c.relname='account_invite' AND a.attname='pending_payload'))`,
  [[...new Set([...planned.map(item => item.schema_name), ...(planned.some(item => item.schema_name === 'public') ? ['coaching'] : [])])]])
  for (const column of columns) {
    const name = column.column_name
    // Completed invitations replay saved registration results. Their JSON IDs
    // remain references even after relational family/lead links were detached.
    if (name === 'pending_payload') {
      const paths = {
        member: ['memberId','payerMemberId','loginMemberId','memberIds[*]'],
        family: ['familyId'], scheduling_signup: ['signupId'], app_user: ['userId'],
      }
      for (const [root, keys] of Object.entries(paths)) {
        const ids = roots.get(root)
        if (!ids?.length) continue
        params.push(ids)
        types.push('text[]')
        const predicates = keys.map(key => `EXISTS (SELECT 1 FROM jsonb_path_query(child.pending_payload, '$.**.${key}') reference
          WHERE reference #>> '{}' = ANY($${params.length}::text[]))`)
        checks.push(`SELECT 1 FROM ${quote(column.schema_name)}.${quote(column.table_name)} child
          WHERE (${predicates.join(' OR ')}) AND (${permitted(column.oid, 'child')}) IS NOT TRUE`)
      }
      continue
    }
    if (name === 'source_family_id') continue // External-system identifier.
    const root = name.endsWith('billing_account_id') ? 'family_billing_account'
      : name.endsWith('family_id') ? 'family'
        : name.endsWith('member_id') || name === 'parent_guardian_ids' ? 'member'
          : name.endsWith('user_id') || ['author_id','created_by','updated_by','reviewer_id'].includes(name) ? 'app_user'
            : name.endsWith('signup_id') ? 'scheduling_signup'
              : name === 'account_invite_id' ? 'account_invite' : 'registrations'
    const ids = roots.get(root)
    if (!ids?.length) continue
    // Covered constrained columns must obey their FK's actual delete action.
    if (foreignKeys.some(fk => fk.child_oid === column.oid && fk.child_columns.includes(name))) continue
    params.push(ids)
    types.push('text[]')
    const array = `$${params.length}::text[]`
    const predicate = column.is_array ? `child.${quote(name)}::text[] && ${array}` : `child.${quote(name)}::text=ANY(${array})`
    checks.push(`SELECT 1 FROM ${quote(column.schema_name)}.${quote(column.table_name)} child
      WHERE (${predicate}) AND (${permitted(column.oid, 'child')}) IS NOT TRUE`)
  }
  if (checks.length) {
    const declared = params.map((_, index) => `$${index + 1}::${types[index]} AS p${index}`).join(',')
    const { rows: [result] } = await db.query(`WITH deletion_parameters AS (SELECT ${declared})
      SELECT EXISTS (${checks.map(check => `(${check} LIMIT 1)`).join(' UNION ALL ')}) AS blocked`, params)
    if (result.blocked) throw deletionBlocked()
  }
}

/** Delete a captured set; deferred/restrict dependencies roll back the caller. */
export async function deleteCapturedTarget(db, target) {
  if (!target.keys.length) return
  await db.query(`DELETE FROM ${qualified(target.table)} owned WHERE ${matches('owned', '$1')}`, [JSON.stringify(target.keys)])
}
