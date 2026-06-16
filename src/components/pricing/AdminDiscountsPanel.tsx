import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import {
  adminCreateDiscountRule,
  adminDeleteDiscountRule,
  adminFetchDiscountRules,
  adminUpdateDiscountRule,
  adminUpdateDiscountSettings,
  type DiscountGlobalSettings,
  type DiscountRule,
  type DiscountRuleInput,
  type DiscountType,
} from '../../utils/schedulingApi'
import DiscountRuleEditor from './DiscountRuleEditor'
import OrderSimulator from './OrderSimulator'

interface Props {
  /** When set, only show + create rules of this type (used for the Promo Codes tab). */
  typeFilter?: DiscountType
  showFacilityCaps?: boolean
  showSimulator?: boolean
}

const TYPE_LABELS: Record<DiscountType, string> = {
  promo_code: 'Promo code',
  school: 'School',
  city: 'City',
  multi_class: 'Multi-class',
  multi_child: 'Multi-child',
  free_classes: 'Free classes',
}

function describeAmount(rule: DiscountRule): string {
  if (rule.type === 'multi_class' || rule.type === 'multi_child') {
    return `${rule.tiers.length} tier${rule.tiers.length === 1 ? '' : 's'}`
  }
  if (rule.type === 'free_classes') {
    return `${rule.config.quantity ?? 1} ${rule.config.grant_unit ?? 'slot'} free`
  }
  return rule.amountType === 'percent'
    ? `${(rule.amountValue / 100).toFixed(rule.amountValue % 100 === 0 ? 0 : 1)}%`
    : `$${(rule.amountValue / 100).toFixed(2)}`
}

const AdminDiscountsPanel = ({ typeFilter, showFacilityCaps = false, showSimulator = false }: Props) => {
  const [rules, setRules] = useState<DiscountRule[]>([])
  const [settings, setSettings] = useState<DiscountGlobalSettings>({
    maxFreeUnitsTotal: null,
    maxDiscountRedemptionsTotal: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<DiscountRule | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminFetchDiscountRules()
      setRules(data.rules)
      setSettings(data.globalSettings)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load discounts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visibleRules = typeFilter ? rules.filter((r) => r.type === typeFilter) : rules

  const handleSave = async (input: DiscountRuleInput) => {
    if (editingRule) {
      await adminUpdateDiscountRule(editingRule.id, input)
    } else {
      await adminCreateDiscountRule(input)
    }
    await load()
  }

  const handleDelete = async (rule: DiscountRule) => {
    if (!window.confirm(`Delete "${rule.name}"?`)) return
    try {
      await adminDeleteDiscountRule(rule.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  const saveSettings = async (next: DiscountGlobalSettings) => {
    setSettings(next)
    setSavingSettings(true)
    try {
      await adminUpdateDiscountSettings(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save caps')
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div className="space-y-6">
      {showFacilityCaps && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="font-bold text-gray-900 mb-1">Facility-wide caps</h3>
          <p className="text-sm text-gray-500 mb-3">
            Hard limits across all classes and programs (first-come, first-served). Leave empty for
            unlimited.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">
                Max free items total
              </label>
              <input
                type="number"
                min={0}
                placeholder="Unlimited"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={settings.maxFreeUnitsTotal ?? ''}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    maxFreeUnitsTotal: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                  }))
                }
                onBlur={() => void saveSettings(settings)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">
                Max discount redemptions total
              </label>
              <input
                type="number"
                min={0}
                placeholder="Unlimited"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={settings.maxDiscountRedemptionsTotal ?? ''}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    maxDiscountRedemptionsTotal:
                      e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
                  }))
                }
                onBlur={() => void saveSettings(settings)}
              />
            </div>
          </div>
          {savingSettings && <p className="text-xs text-gray-400 mt-2">Saving…</p>}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">
            {typeFilter ? TYPE_LABELS[typeFilter] : 'Discount'} rules
          </h3>
          <button
            type="button"
            onClick={() => {
              setEditingRule(null)
              setEditorOpen(true)
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-vortex-red text-white rounded-lg hover:bg-red-700"
          >
            <Plus className="w-4 h-4" /> New
          </button>
        </div>

        {error && <p className="px-4 py-2 text-sm text-red-600">{error}</p>}
        {loading ? (
          <p className="px-4 py-6 text-sm text-gray-400">Loading…</p>
        ) : visibleRules.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400">No rules yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2">Name</th>
                {!typeFilter && <th className="px-4 py-2">Type</th>}
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Scope</th>
                <th className="px-4 py-2">Used</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {visibleRules.map((rule) => (
                <tr key={rule.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">
                    {rule.name}
                    {rule.type === 'promo_code' && rule.config.code && (
                      <span className="ml-2 text-xs font-mono uppercase text-gray-500">
                        {String(rule.config.code)}
                      </span>
                    )}
                  </td>
                  {!typeFilter && <td className="px-4 py-2 text-gray-600">{TYPE_LABELS[rule.type]}</td>}
                  <td className="px-4 py-2 text-gray-600">{describeAmount(rule)}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {rule.applyTo === 'order_total' ? 'Order' : 'Each class'}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {rule.redeemedCount}
                    {rule.maxRedemptions != null ? ` / ${rule.maxRedemptions}` : ''}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                        rule.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {rule.active ? 'Active' : 'Off'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRule(rule)
                          setEditorOpen(true)
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-900"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(rule)}
                        className="p-1.5 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showSimulator && <OrderSimulator />}

      <DiscountRuleEditor
        open={editorOpen}
        rule={editingRule}
        lockedType={typeFilter}
        onSave={handleSave}
        onClose={() => setEditorOpen(false)}
      />
    </div>
  )
}

export default AdminDiscountsPanel
