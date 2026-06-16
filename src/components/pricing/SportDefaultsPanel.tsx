import { useCallback, useEffect, useState } from 'react'
import {
  COST_UNIT_LABELS,
  adminFetchSportDefaults,
  adminUpsertSportDefault,
  type CostUnit,
  type SportPricingDefault,
} from '../../utils/schedulingApi'

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm'

const SportDefaultsPanel = () => {
  const [rows, setRows] = useState<SportPricingDefault[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await adminFetchSportDefaults())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sport defaults')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const patch = (id: number, patchRow: Partial<SportPricingDefault>) => {
    setRows((prev) => prev.map((r) => (r.disciplineTagId === id ? { ...r, ...patchRow } : r)))
  }

  const save = async (row: SportPricingDefault) => {
    setSavingId(row.disciplineTagId)
    try {
      await adminUpsertSportDefault(row.disciplineTagId, {
        costAmountCents: row.costAmountCents,
        costUnit: row.costUnit,
        freeSlotsPerUser: row.freeSlotsPerUser,
        maxFreeSlotsTotal: row.maxFreeSlotsTotal,
        maxDiscountRedemptions: row.maxDiscountRedemptions,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="font-bold text-gray-900 mb-1">Primary sport defaults</h3>
      <p className="text-sm text-gray-500 mb-3">
        Base pricing used by programs whose primary sport matches, when the program has no cost of its
        own. Programs and classes override these.
      </p>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-2 py-2">Sport</th>
                <th className="px-2 py-2">Cost ($)</th>
                <th className="px-2 py-2">Cadence</th>
                <th className="px-2 py-2">Free / user</th>
                <th className="px-2 py-2">Max free total</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.disciplineTagId} className="border-b border-gray-50">
                  <td className="px-2 py-2 font-medium text-gray-900">{row.name}</td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className={inputClass}
                      value={row.costAmountCents / 100}
                      onChange={(e) =>
                        patch(row.disciplineTagId, {
                          costAmountCents: Math.round((Number(e.target.value) || 0) * 100),
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      className={inputClass}
                      value={row.costUnit}
                      onChange={(e) => patch(row.disciplineTagId, { costUnit: e.target.value as CostUnit })}
                    >
                      {(Object.keys(COST_UNIT_LABELS) as CostUnit[]).map((u) => (
                        <option key={u} value={u}>
                          {COST_UNIT_LABELS[u]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      className={inputClass}
                      value={row.freeSlotsPerUser}
                      onChange={(e) =>
                        patch(row.disciplineTagId, { freeSlotsPerUser: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      placeholder="∞"
                      className={inputClass}
                      value={row.maxFreeSlotsTotal ?? ''}
                      onChange={(e) =>
                        patch(row.disciplineTagId, {
                          maxFreeSlotsTotal: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void save(row)}
                      disabled={savingId === row.disciplineTagId}
                      className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                    >
                      {savingId === row.disciplineTagId ? 'Saving…' : 'Save'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default SportDefaultsPanel
