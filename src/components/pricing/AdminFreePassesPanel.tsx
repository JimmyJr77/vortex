import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  adminCreateFreePass,
  adminDeleteFreePass,
  adminFetchFreePasses,
  adminUpdateFreePass,
  DAY_OF_WEEK_LABELS,
  FREE_PASS_BENEFIT_LABELS,
  type FreePassTemplate,
  type FreePassTemplateInput,
} from '../../utils/schedulingApi'
import FreePassEditor from './FreePassEditor'
import {
  appliesToAllSchools,
  schoolLevelsFromEligibility,
  schoolNamesFromEligibility,
  SCHOOL_LEVEL_OPTIONS,
} from '../../utils/freePassEligibility'
import { describeBenefitDateRange } from '../../utils/freePassBenefitDates'

function describePass(t: FreePassTemplate): string {
  const unit = FREE_PASS_BENEFIT_LABELS[t.benefitUnit] ?? t.benefitUnit
  let s = `${t.benefitQuantity} ${unit}`
  if (t.benefitUnit === 'day' && t.dayOfWeek != null) {
    s += ` (${DAY_OF_WEEK_LABELS[t.dayOfWeek]})`
  }
  if (t.benefitUnit === 'specific_date') {
    const range = describeBenefitDateRange(t.config)
    if (range) s += ` · ${range}`
  }
  if (t.scopeLevel !== 'global') {
    s += ` · ${t.scopeLevel}${t.scopeRefId != null ? ` #${t.scopeRefId}` : ''}`
  }
  return s
}

const AdminFreePassesPanel = () => {
  const [templates, setTemplates] = useState<FreePassTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<FreePassTemplate | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setTemplates(await adminFetchFreePasses())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load free passes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async (input: FreePassTemplateInput) => {
    if (editing) {
      await adminUpdateFreePass(editing.id, input)
    } else {
      await adminCreateFreePass(input)
    }
    await load()
  }

  const handleDelete = async (t: FreePassTemplate) => {
    if (!window.confirm(`Delete "${t.name}"?`)) return
    try {
      await adminDeleteFreePass(t.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">Free pass templates</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Define entitlements (free days, slots, offerings) and attach them to programs or classes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setEditorOpen(true)
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-vortex-red text-white rounded-lg hover:bg-red-700"
          >
            <Plus className="w-4 h-4" /> New pass
          </button>
        </div>

        {error && <p className="px-4 py-2 text-sm text-red-600">{error}</p>}
        {loading ? (
          <p className="px-4 py-6 text-sm text-gray-400">Loading…</p>
        ) : templates.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400">No free passes yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Benefit</th>
                <th className="px-4 py-2">Valid</th>
                <th className="px-4 py-2">Issuance</th>
                <th className="px-4 py-2">Used</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => {
                const schoolFilterCount = schoolNamesFromEligibility(t.eligibility).length
                const levelFilters = schoolLevelsFromEligibility(t.eligibility)
                const levelLabels = levelFilters
                  .map((l) => SCHOOL_LEVEL_OPTIONS.find((o) => o.value === l)?.label ?? l)
                  .join(', ')
                return (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-2 font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-2 text-gray-600">{describePass(t)}</td>
                  <td className="px-4 py-2 text-gray-600 text-xs">
                    {t.startsAt || t.endsAt ? (
                      <>
                        {t.startsAt ? t.startsAt.slice(0, 10) : '—'}
                        {' → '}
                        {t.endsAt ? t.endsAt.slice(0, 10) : 'Permanent'}
                      </>
                    ) : (
                      'Permanent'
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-600 text-xs">
                    {t.issuance?.admin_only
                      ? 'Admin only'
                      : t.issuance?.auto_on_enroll
                        ? 'Auto on enroll'
                        : t.issuance?.promo_code
                          ? `Promo: ${t.issuance.promo_code}`
                          : 'Manual'}
                    {t.debitsFreeClassAllowance && ' · debits allowance'}
                    {Boolean(t.eligibility?.new_member) && ' · new enrollees only'}
                    {schoolFilterCount > 0 && ` · ${schoolFilterCount} school(s)`}
                    {appliesToAllSchools(t.eligibility) && ' · all database schools'}
                    {levelLabels && ` · ${levelLabels}`}
                    {(t.offeringIds?.length ?? 0) > 0 && ` · ${t.offeringIds!.length} offering(s)`}
                  </td>
                  <td className="px-4 py-2 text-gray-600 text-xs">
                    <span className="block">{t.redeemedCount} used</span>
                    {(t.maxRedemptionsPerMember != null || t.maxRedemptions != null) && (
                      <span className="text-gray-500">
                        {t.maxRedemptionsPerMember != null
                          ? `${t.maxRedemptionsPerMember} per person`
                          : null}
                        {t.maxRedemptionsPerMember != null && t.maxRedemptions != null ? ' · ' : null}
                        {t.maxRedemptions != null ? `${t.maxRedemptions} facility max` : null}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                        t.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {t.active ? 'Active' : 'Off'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(t)
                          setEditorOpen(true)
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-900"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(t)}
                        className="p-1.5 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <FreePassEditor
        open={editorOpen}
        template={editing}
        onSave={handleSave}
        onClose={() => {
          setEditorOpen(false)
          setEditing(null)
        }}
      />
    </div>
  )
}

export default AdminFreePassesPanel
