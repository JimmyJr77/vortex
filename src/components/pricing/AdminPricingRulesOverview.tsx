import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  adminFetchDiscountRules,
  adminFetchFreePasses,
  DAY_OF_WEEK_LABELS,
  FREE_PASS_BENEFIT_LABELS,
  type DiscountRule,
  type DiscountScopeLevel,
  type DiscountType,
  type FreePassTemplate,
} from '../../utils/schedulingApi'
import { fetchDisciplineTags, fetchTopPrograms, type TopProgram } from '../../utils/programsApi'
import { adminFetchSchedulingForms } from '../../utils/schedulingApi'
import { normalizeProgramPromoCodes } from './ProgramPromoCodesField'
import {
  describeEligibilityRule,
  describePromoRuleBenefit,
  getPromoStatus,
  type EligibilityRule,
} from '../../utils/promoDiscountModel'
import { describeBenefitDateRange } from '../../utils/freePassBenefitDates'

const TYPE_LABELS: Record<DiscountType, string> = {
  promo_code: 'Promo code',
  school: 'School',
  city: 'City',
  multi_class: 'Multi-class',
  multi_child: 'Multi-child',
  free_classes: 'Free classes',
}

const UNIVERSAL_TYPES: DiscountType[] = ['multi_class', 'multi_child', 'school', 'city', 'free_classes']

function describeBenefit(rule: DiscountRule): string {
  if (rule.type === 'promo_code') return describePromoRuleBenefit(rule)
  if (rule.type === 'multi_class' || rule.type === 'multi_child') {
    if (rule.tiers.length === 0) return 'No tiers configured'
    return rule.tiers
      .sort((a, b) => a.threshold - b.threshold)
      .map((t) => {
        const amt =
          t.amountType === 'percent'
            ? `${(t.amountValue / 100).toFixed(0)}%`
            : `$${(t.amountValue / 100).toFixed(2)}`
        return `#${t.threshold}: ${amt}`
      })
      .join(' · ')
  }
  if (rule.type === 'free_classes') {
    return `${rule.config.quantity ?? 1} ${rule.config.grant_unit ?? 'slot'} free`
  }
  return rule.amountType === 'percent'
    ? `${(rule.amountValue / 100).toFixed(rule.amountValue % 100 === 0 ? 0 : 1)}% off`
    : `$${(rule.amountValue / 100).toFixed(2)} off`
}

function describeWhoQualifies(rule: DiscountRule): string {
  if (rule.type === 'promo_code') {
    const rules = rule.config.eligibility_rules as EligibilityRule[] | undefined
    if (rules?.length) return rules.map(describeEligibilityRule).join(' AND ')
    return 'Anyone with the code'
  }
  if (rule.type === 'school') {
    const names = rule.config.school_names
    if (names?.length) return `School: ${names.join(', ')}`
    return '—'
  }
  if (rule.type === 'city') {
    const cities = rule.config.cities
    if (cities?.length) return `City: ${cities.join(', ')}`
    return '—'
  }
  return 'All eligible enrollments'
}

function resolveScopedTarget(
  rule: DiscountRule,
  programsById: Map<number, TopProgram>,
  formsById: Map<number, { title: string; programName?: string | null }>,
  sportsById: Map<number, string>,
): string | null {
  if (rule.scopeRefId == null) return null
  switch (rule.scopeLevel as DiscountScopeLevel) {
    case 'program': {
      const p = programsById.get(rule.scopeRefId)
      return p ? `Program: ${p.displayName}` : `Program #${rule.scopeRefId}`
    }
    case 'class': {
      const f = formsById.get(rule.scopeRefId)
      return f ? `Class: ${f.title}` : `Class #${rule.scopeRefId}`
    }
    case 'sport': {
      const name = sportsById.get(rule.scopeRefId)
      return name ? `Sport: ${name}` : `Sport #${rule.scopeRefId}`
    }
    case 'offering':
      return `Offering #${rule.scopeRefId}`
    default:
      return null
  }
}

function describeProgramsAndClasses(
  rule: DiscountRule,
  programs: TopProgram[],
  formsById: Map<number, { title: string; programName?: string | null }>,
  programsById: Map<number, TopProgram>,
  sportsById: Map<number, string>,
): { primary: string; detail?: string } {
  if (rule.type === 'promo_code') {
    const code = String(rule.config?.code ?? '').trim().toUpperCase()
    const linked = programs.filter((p) =>
      normalizeProgramPromoCodes(p.pricingPromoCodes).includes(code),
    )
    if (linked.length === 0) {
      return {
        primary: 'Not assigned to any program',
        detail: 'Add this code under Costs → program defaults to enable it.',
      }
    }
    return {
      primary: linked.map((p) => p.displayName).join(', '),
      detail: `${linked.length} program${linked.length === 1 ? '' : 's'}`,
    }
  }

  if (UNIVERSAL_TYPES.includes(rule.type) && rule.scopeLevel === 'global') {
    return { primary: 'All programs & classes', detail: 'Universal — always evaluated at enroll' }
  }

  const scoped = resolveScopedTarget(rule, programsById, formsById, sportsById)
  if (scoped) return { primary: scoped }

  if (rule.scopeLevel === 'global') {
    return { primary: 'All programs & classes' }
  }

  return { primary: '—' }
}

function formatDateRange(rule: DiscountRule): string {
  const start = rule.startsAt ? rule.startsAt.slice(0, 10) : null
  const end = rule.endsAt ? rule.endsAt.slice(0, 10) : null
  if (start && end) return `${start} → ${end}`
  if (start) return `From ${start}`
  if (end) return `Through ${end}`
  return 'No date limit'
}

function RuleStatusBadge({ rule }: { rule: DiscountRule }) {
  if (rule.type === 'promo_code') {
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
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs ${
        rule.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
      }`}
    >
      {rule.active ? 'Active' : 'Inactive'}
    </span>
  )
}

const AdminPricingRulesOverview = () => {
  const [rules, setRules] = useState<DiscountRule[]>([])
  const [freePasses, setFreePasses] = useState<FreePassTemplate[]>([])
  const [programs, setPrograms] = useState<TopProgram[]>([])
  const [forms, setForms] = useState<Array<{ id: number; title: string; programsId?: number | null; programDisplayName?: string | null }>>([])
  const [sports, setSports] = useState<Array<{ id: number; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<DiscountType | 'all'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [discountData, passRows, programRows, formRows, sportRows] = await Promise.all([
        adminFetchDiscountRules(),
        adminFetchFreePasses(),
        fetchTopPrograms(false),
        adminFetchSchedulingForms(),
        fetchDisciplineTags(),
      ])
      setRules(discountData.rules)
      setFreePasses(passRows)
      setPrograms(programRows)
      setForms(
        formRows.map((f) => ({
          id: f.id,
          title: f.title,
          programsId: f.programsId,
          programDisplayName: f.programDisplayName,
        })),
      )
      setSports(sportRows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rules')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const programsById = useMemo(
    () => new Map(programs.map((p) => [p.id, p])),
    [programs],
  )
  const formsById = useMemo(
    () =>
      new Map(
        forms.map((f) => [
          f.id,
          { title: f.title, programName: f.programDisplayName },
        ]),
      ),
    [forms],
  )
  const sportsById = useMemo(() => new Map(sports.map((s) => [s.id, s.name])), [sports])

  const visibleRules = useMemo(() => {
    const list = typeFilter === 'all' ? rules : rules.filter((r) => r.type === typeFilter)
    return [...list].sort((a, b) => {
      const typeOrder = (t: DiscountType) => TYPE_LABELS[t]
      const cmp = typeOrder(a.type).localeCompare(typeOrder(b.type))
      if (cmp !== 0) return cmp
      return a.name.localeCompare(b.name)
    })
  }, [rules, typeFilter])

  const activeCount = rules.filter((r) => r.active).length

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="font-bold text-gray-900">Rules in play</h3>
        <p className="text-sm text-gray-600 mt-1">
          Overview of promotions, discounts, and free passes. Create discounts on the{' '}
          <span className="font-medium">Discounts</span> tab; free passes on{' '}
          <span className="font-medium">Free Passes</span>; assign promo codes on{' '}
          <span className="font-medium">Costs</span>.
        </p>
        {!loading && (
          <p className="text-xs text-gray-500 mt-2">
            {rules.length} discount rule{rules.length === 1 ? '' : 's'} · {freePasses.length} free
            pass{freePasses.length === 1 ? '' : 'es'} · {activeCount} active rules
          </p>
        )}
      </div>

      {freePasses.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-emerald-100">
            <h4 className="font-semibold text-emerald-900">Free passes</h4>
          </div>
          <ul className="divide-y divide-emerald-100 text-sm">
            {freePasses.map((p) => (
              <li key={p.id} className="px-4 py-2 flex justify-between gap-4">
                <span className="font-medium text-gray-900">{p.name}</span>
                <span className="text-gray-600 text-right">
                  {p.benefitQuantity} {FREE_PASS_BENEFIT_LABELS[p.benefitUnit]}
                  {p.benefitUnit === 'day' && p.dayOfWeek != null
                    ? ` (${DAY_OF_WEEK_LABELS[p.dayOfWeek]})`
                    : ''}
                  {p.benefitUnit === 'specific_date' && describeBenefitDateRange(p.config)
                    ? ` (${describeBenefitDateRange(p.config)})`
                    : ''}
                  {p.scopeLevel !== 'global' ? ` · ${p.scopeLevel}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold text-gray-600">Filter by type</label>
        <select
          className="h-9 rounded-lg border border-gray-300 px-3 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as DiscountType | 'all')}
        >
          <option value="all">All types</option>
          {(Object.keys(TYPE_LABELS) as DiscountType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {loading ? (
          <p className="px-4 py-8 text-sm text-gray-400 text-center">Loading rules…</p>
        ) : visibleRules.length === 0 ? (
          <p className="px-4 py-8 text-sm text-gray-400 text-center">No rules configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2.5 font-semibold">Rule</th>
                  <th className="px-4 py-2.5 font-semibold">Type</th>
                  <th className="px-4 py-2.5 font-semibold">What it gives</th>
                  <th className="px-4 py-2.5 font-semibold">Programs / classes</th>
                  <th className="px-4 py-2.5 font-semibold">Who qualifies</th>
                  <th className="px-4 py-2.5 font-semibold">Dates</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRules.map((rule) => {
                  const applies = describeProgramsAndClasses(
                    rule,
                    programs,
                    formsById,
                    programsById,
                    sportsById,
                  )
                  return (
                    <tr key={rule.id} className="border-b border-gray-50 align-top hover:bg-gray-50/80">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{rule.name}</div>
                        {rule.type === 'promo_code' && rule.config.code && (
                          <div className="text-xs font-mono text-gray-500 mt-0.5 uppercase">
                            {String(rule.config.code)}
                          </div>
                        )}
                        {rule.description && (
                          <div className="text-xs text-gray-500 mt-1">{rule.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {TYPE_LABELS[rule.type]}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[12rem]">{describeBenefit(rule)}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-[14rem]">
                        <div>{applies.primary}</div>
                        {applies.detail && (
                          <div className="text-xs text-gray-500 mt-0.5">{applies.detail}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[12rem] text-xs">
                        {describeWhoQualifies(rule)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {formatDateRange(rule)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <RuleStatusBadge rule={rule} />
                        <div className="text-xs text-gray-500 mt-1">
                          Used {rule.redeemedCount}
                          {rule.maxRedemptions != null ? ` / ${rule.maxRedemptions}` : ''}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminPricingRulesOverview
