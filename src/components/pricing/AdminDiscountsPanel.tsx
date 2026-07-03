import { useCallback, useEffect, useState } from 'react'
import { Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import {
  adminCreateDiscountRule,
  adminDeleteDiscountRule,
  adminFetchDiscountRules,
  adminUpdateDiscountRule,
  type DiscountRule,
  type DiscountRuleInput,
  type DiscountType,
} from '../../utils/schedulingApi'
import DiscountRuleEditor from './DiscountRuleEditor'
import PromoCodeEditor from './PromoCodeEditor'
import OrderSimulator from './OrderSimulator'
import { describePromoRuleBenefit, getPromoStatus } from '../../utils/promoDiscountModel'
import {
  isAccountSystemRule,
  isMultiClassSystemRule,
  isMonthlySpendSystemRule,
  isHouseholdSpendVolumeRule,
  multiClassDiscountTarget,
  monthlySpendDiscountTarget,
  MULTI_CLASS_TARGET_LABELS,
  describeMultiClassTier,
  describeMonthlySpendTier,
} from '../../utils/systemDiscounts'

interface Props {
  showSimulator?: boolean
}

const TYPE_LABELS: Record<DiscountType, string> = {
  promo_code: 'Promo code',
  school: 'School',
  city: 'City',
  multi_class: 'Multi-class',
  multi_child: 'Multi-child',
  spend_volume: 'Monthly spend',
  free_classes: 'Free classes',
}

function describeAmount(rule: DiscountRule): string {
  if (isMultiClassSystemRule(rule)) {
    const target = MULTI_CLASS_TARGET_LABELS[multiClassDiscountTarget(rule)]
    if (rule.tiers.length === 1) return describeMultiClassTier(rule.tiers[0])
    return `${rule.tiers.length} tiers · ${target}`
  }
  if (isMonthlySpendSystemRule(rule)) {
    const target = MULTI_CLASS_TARGET_LABELS[monthlySpendDiscountTarget(rule)]
    if (rule.tiers.length === 1) return describeMonthlySpendTier(rule.tiers[0])
    return `${rule.tiers.length} tiers · ${target}`
  }
  if (rule.type === 'promo_code') return describePromoRuleBenefit(rule)
  if (rule.type === 'multi_class' || rule.type === 'multi_child' || rule.type === 'spend_volume') {
    return `${rule.tiers.length} tier${rule.tiers.length === 1 ? '' : 's'}`
  }
  if (rule.type === 'free_classes') {
    return `${rule.config.quantity ?? 1} ${rule.config.grant_unit ?? 'slot'} free`
  }
  return rule.amountType === 'percent'
    ? `${(rule.amountValue / 100).toFixed(rule.amountValue % 100 === 0 ? 0 : 1)}%`
    : `$${(rule.amountValue / 100).toFixed(2)}`
}

function typeLabel(rule: DiscountRule): string {
  if (isMultiClassSystemRule(rule)) return 'Multi-class (system)'
  if (isMonthlySpendSystemRule(rule)) return 'Monthly spend (system)'
  return TYPE_LABELS[rule.type]
}

const AdminDiscountsPanel = ({ showSimulator = false }: Props) => {
  const [rules, setRules] = useState<DiscountRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [promoEditorOpen, setPromoEditorOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<DiscountRule | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminFetchDiscountRules()
      setRules(data.rules)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load discounts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visibleRules = rules

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

  const handleToggleActive = async (rule: DiscountRule) => {
    try {
      await adminUpdateDiscountRule(rule.id, {
        name: rule.name,
        description: rule.description,
        type: rule.type,
        amountType: rule.amountType,
        amountValue: rule.amountValue,
        applyTo: rule.applyTo,
        calcBase: rule.calcBase,
        priority: rule.priority,
        stackable: rule.stackable,
        exclusivityGroup: rule.exclusivityGroup,
        maxDiscountCents: rule.maxDiscountCents,
        scopeLevel: rule.scopeLevel,
        scopeRefId: rule.scopeRefId,
        active: !rule.active,
        startsAt: rule.startsAt,
        endsAt: rule.endsAt,
        maxRedemptions: rule.maxRedemptions,
        config: rule.config ?? {},
        tiers: rule.tiers ?? [],
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update')
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Discount rules</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingRule(null)
                setPromoEditorOpen(true)
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Plus className="w-4 h-4" /> New promo code
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingRule(null)
                setEditorOpen(true)
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-vortex-red text-white rounded-lg hover:bg-red-700"
            >
              <Plus className="w-4 h-4" /> New rule
            </button>
          </div>
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
                <th className="px-4 py-2">Type</th>
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
                    {isAccountSystemRule(rule) && (
                      <span
                        className={`ml-2 text-xs font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                          isMonthlySpendSystemRule(rule)
                            ? 'text-emerald-700 bg-emerald-50'
                            : 'text-indigo-700 bg-indigo-50'
                        }`}
                      >
                        System
                      </span>
                    )}
                    {rule.type === 'promo_code' && rule.config.code && (
                      <span className="ml-2 text-xs font-mono uppercase text-gray-500">
                        {String(rule.config.code)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{typeLabel(rule)}</td>
                  <td className="px-4 py-2 text-gray-600">{describeAmount(rule)}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {rule.applyTo === 'order_total' ? 'Order' : 'Each class'}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {rule.redeemedCount}
                    {rule.maxRedemptions != null ? ` / ${rule.maxRedemptions}` : ''}
                  </td>
                  <td className="px-4 py-2">
                    {rule.type === 'promo_code' ? (
                      (() => {
                        const st = getPromoStatus(rule)
                        return (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                              st.usableNow
                                ? 'bg-green-100 text-green-700'
                                : rule.active
                                  ? 'bg-amber-50 text-amber-800'
                                  : 'bg-gray-100 text-gray-500'
                            }`}
                            title={st.detail}
                          >
                            {st.label}
                          </span>
                        )
                      })()
                    ) : (
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                          rule.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {rule.active ? 'Active' : 'Off'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRule(rule)
                          if (rule.type === 'promo_code') setPromoEditorOpen(true)
                          else setEditorOpen(true)
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-900"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {isHouseholdSpendVolumeRule(rule) ? (
                        <button
                          type="button"
                          onClick={() => void handleToggleActive(rule)}
                          className="p-1.5 text-gray-400 hover:text-gray-900"
                          title={rule.active ? 'Pause discount' : 'Resume discount'}
                        >
                          {rule.active ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleDelete(rule)}
                          className="p-1.5 text-gray-400 hover:text-red-600"
                          title="Delete discount"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showSimulator && <OrderSimulator />}

      <PromoCodeEditor
        open={promoEditorOpen}
        rule={editingRule?.type === 'promo_code' ? editingRule : null}
        onSave={handleSave}
        onClose={() => {
          setPromoEditorOpen(false)
          setEditingRule(null)
        }}
      />

      <DiscountRuleEditor
        open={editorOpen}
        rule={editingRule?.type !== 'promo_code' ? editingRule : null}
        onSave={handleSave}
        onClose={() => {
          setEditorOpen(false)
          setEditingRule(null)
        }}
      />
    </div>
  )
}

export default AdminDiscountsPanel
