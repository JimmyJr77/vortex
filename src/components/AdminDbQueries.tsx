import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Save, Play, Trash2, RefreshCw } from 'lucide-react'
import {
  dbQueriesApi,
  type DbQueryEntityMeta,
  type DbQueryColumnRef,
  type DbQueryResult,
  type SavedQuery,
} from '../utils/adminFeaturesApi'

function colId(entity: string, field: string) {
  return `${entity}::${field}`
}

export default function AdminDbQueries() {
  const [entities, setEntities] = useState<DbQueryEntityMeta[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [baseEntity, setBaseEntity] = useState<string>('')
  const [selected, setSelected] = useState<DbQueryColumnRef[]>([])
  const [limit, setLimit] = useState<number>(1000)

  const [result, setResult] = useState<DbQueryResult | null>(null)
  const [running, setRunning] = useState(false)

  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [saveName, setSaveName] = useState('')
  const [exporting, setExporting] = useState(false)
  const [didAutoRun, setDidAutoRun] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        setLoadingMeta(true)
        const [meta, saved] = await Promise.all([dbQueriesApi.entities(), dbQueriesApi.listSaved()])
        setEntities(meta)
        setSavedQueries(saved)
        if (meta.length > 0) {
          const preferred = meta.find((e) => e.key === 'inquiry') ?? meta[0]
          setBaseEntity(preferred.key)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoadingMeta(false)
      }
    })()
  }, [])

  const base = useMemo(() => entities.find((e) => e.key === baseEntity), [entities, baseEntity])

  // Reset selection when base entity changes
  useEffect(() => {
    if (!base) {
      setSelected([])
      return
    }
    // Preselect a few useful base columns so results are visible immediately.
    const preferred = ['first_name', 'last_name', 'email', 'name', 'created_at']
    const defaults = preferred
      .map((k) => base.fields.find((f) => f.key === k))
      .filter(Boolean)
      .slice(0, 3)
      .map((f) => ({ entity: base.key, field: f!.key }))
    const fallback = base.fields.slice(0, Math.min(3, base.fields.length)).map((f) => ({ entity: base.key, field: f.key }))
    setSelected(defaults.length > 0 ? defaults : fallback)
    setResult(null)
    setDidAutoRun(false)
  }, [baseEntity])

  // Auto-run the first query when default columns are populated.
  useEffect(() => {
    if (!base || selected.length === 0 || didAutoRun || running) return
    setDidAutoRun(true)
    void runQuery()
  }, [base, selected, didAutoRun, running])

  const isSelected = (entity: string, field: string) =>
    selected.some((c) => c.entity === entity && c.field === field)

  const toggleColumn = (entity: string, field: string) => {
    setSelected((prev) => {
      const exists = prev.some((c) => c.entity === entity && c.field === field)
      if (exists) return prev.filter((c) => !(c.entity === entity && c.field === field))
      return [...prev, { entity, field }]
    })
  }

  const runQuery = async () => {
    if (!base || selected.length === 0) return
    try {
      setRunning(true)
      setError(null)
      const res = await dbQueriesApi.run({ baseEntity: base.key, columns: selected, limit })
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed')
      setResult(null)
    } finally {
      setRunning(false)
    }
  }

  const exportCsv = async () => {
    if (!base || selected.length === 0) return
    try {
      setExporting(true)
      const blob = await dbQueriesApi.exportCsv({ baseEntity: base.key, columns: selected, limit })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${base.key}-query.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const saveQuery = async () => {
    if (!base || selected.length === 0 || !saveName.trim()) return
    try {
      await dbQueriesApi.save({
        name: saveName.trim(),
        baseEntity: base.key,
        config: { baseEntity: base.key, columns: selected, limit },
      })
      setSaveName('')
      setSavedQueries(await dbQueriesApi.listSaved())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const loadSaved = (q: SavedQuery) => {
    setBaseEntity(q.baseEntity)
    // selection reset happens via effect; restore on next tick
    setTimeout(() => {
      setSelected(q.config.columns || [])
      setLimit(q.config.limit || 1000)
    }, 0)
  }

  const deleteSaved = async (id: number) => {
    try {
      await dbQueriesApi.deleteSaved(id)
      setSavedQueries((prev) => prev.filter((q) => q.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <motion.div
      key="db-queries"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-lg shadow-lg border border-gray-200"
    >
      <div className="p-4 md:p-6 border-b border-gray-200">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-black">DB Queries</h2>
        <p className="text-gray-600 mt-1">
          Build relationship-aware reports. Pick a starting entity, then add only the columns it relates to.
        </p>
      </div>

      {error && (
        <div className="mx-4 md:mx-6 mt-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
          {error}
        </div>
      )}

      {loadingMeta ? (
        <div className="p-8 text-center text-gray-500">Loading…</div>
      ) : (
        <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Builder panel */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Starting entity</label>
              <select
                value={baseEntity}
                onChange={(e) => setBaseEntity(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                {entities.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>

            {base && (
              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                {/* Own fields */}
                <ColumnGroup
                  title={base.label}
                  entityKey={base.key}
                  fields={base.fields}
                  isSelected={isSelected}
                  toggle={toggleColumn}
                />
                {/* Related fields */}
                {base.relations.map((rel) => (
                  <ColumnGroup
                    key={rel.key}
                    title={`${rel.label}${rel.cardinality === 'many' ? ' (list)' : ''}`}
                    entityKey={rel.key}
                    fields={rel.fields}
                    isSelected={isSelected}
                    toggle={toggleColumn}
                  />
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Row limit</label>
              <input
                type="number"
                value={limit}
                min={1}
                max={50000}
                onChange={(e) => setLimit(Number(e.target.value) || 1000)}
                className="w-28 border border-gray-300 rounded-lg px-2 py-1"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={runQuery}
                disabled={running || selected.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-vortex-red text-white font-semibold disabled:opacity-50"
              >
                {running ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
                Run
              </button>
              <button
                onClick={exportCsv}
                disabled={exporting || selected.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 font-semibold disabled:opacity-50"
              >
                <Download size={16} />
                CSV
              </button>
            </div>

            {/* Save / load */}
            <div className="pt-4 border-t border-gray-200 space-y-2">
              <div className="flex gap-2">
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Save query as…"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={saveQuery}
                  disabled={!saveName.trim() || selected.length === 0}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold disabled:opacity-50"
                >
                  <Save size={14} /> Save
                </button>
              </div>
              {savedQueries.length > 0 && (
                <div className="space-y-1">
                  {savedQueries.map((q) => (
                    <div key={q.id} className="flex items-center justify-between gap-2 text-sm bg-gray-50 rounded px-2 py-1">
                      <button onClick={() => loadSaved(q)} className="text-left text-vortex-red hover:underline truncate">
                        {q.name}
                      </button>
                      <button onClick={() => deleteSaved(q.id)} className="text-gray-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Results panel */}
          <div className="min-w-0">
            {selected.length > 0 && (
              <div className="mb-2 text-sm text-gray-500">
                {selected.length} column{selected.length === 1 ? '' : 's'} selected
              </div>
            )}
            {result ? (
              <div className="overflow-auto border border-gray-200 rounded-lg max-h-[640px]">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      {result.columns.map((c) => (
                        <th key={c.key} className="text-left px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.length === 0 ? (
                      <tr>
                        <td colSpan={result.columns.length} className="px-3 py-6 text-center text-gray-500">
                          No rows.
                        </td>
                      </tr>
                    ) : (
                      result.rows.map((row, i) => (
                        <tr key={i} className="border-t border-gray-100 even:bg-gray-50">
                          {result.columns.map((c) => (
                            <td key={c.key} className="px-3 py-2 align-top text-gray-800">
                              {row[c.key] == null ? '' : String(row[c.key])}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <div className="px-3 py-2 text-xs text-gray-500 border-t border-gray-100">
                  {result.rows.length} row{result.rows.length === 1 ? '' : 's'}
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400 border border-dashed border-gray-300 rounded-lg">
                Select columns and Run to see results.
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function ColumnGroup({
  title,
  entityKey,
  fields,
  isSelected,
  toggle,
}: {
  title: string
  entityKey: string
  fields: { key: string; label: string; type: string }[]
  isSelected: (entity: string, field: string) => boolean
  toggle: (entity: string, field: string) => void
}) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">{title}</div>
      <div className="space-y-1">
        {fields.map((f) => (
          <label
            key={colId(entityKey, f.key)}
            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 cursor-pointer text-sm"
          >
            <input
              type="checkbox"
              checked={isSelected(entityKey, f.key)}
              onChange={() => toggle(entityKey, f.key)}
            />
            <span className="text-gray-800">{f.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
