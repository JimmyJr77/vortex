import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import ClassOfferingMultiSelect from './ClassOfferingMultiSelect'
import SchoolMultiSelect from './SchoolMultiSelect'
import {
  DAY_OF_WEEK_LABELS,
  FREE_PASS_BENEFIT_LABELS,
  type FreePassBenefitUnit,
  type FreePassTemplate,
  type FreePassTemplateInput,
} from '../../utils/schedulingApi'
import {
  appliesToAllSchools,
  mergeAppliesToAllSchools,
  mergeMaxRedemptionForSchool,
  mergeSchoolEligibility,
  mergeSchoolLevels,
  maxRedemptionsPerSchoolFromConfig,
  SCHOOL_LEVEL_OPTIONS,
  schoolLevelsFromEligibility,
  schoolNamesFromEligibility,
  type SchoolLevelFilter,
} from '../../utils/freePassEligibility'
import {
  benefitDatesFromConfig,
  mergeBenefitDatesConfig,
} from '../../utils/freePassBenefitDates'

interface Props {
  open: boolean
  template: FreePassTemplate | null
  onSave: (input: FreePassTemplateInput) => Promise<void>
  onClose: () => void
}

const fieldClass =
  'w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:border-vortex-red focus:outline-none box-border'

const textareaClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-vortex-red focus:outline-none box-border'

function dateInputValue(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : ''
}

function startDateToIso(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toISOString()
}

function endDateToIso(dateStr: string): string {
  return new Date(`${dateStr}T23:59:59`).toISOString()
}

function isWithinValidationWindow(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (startsAt && new Date(startsAt).getTime() > now) return false
  if (endsAt && new Date(endsAt).getTime() < now) return false
  return true
}

function validationWindowError(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now = Date.now(),
): string | null {
  if (startsAt && new Date(startsAt).getTime() > now) {
    return 'This pass is not valid yet. Adjust Valid from or turn off Active.'
  }
  if (endsAt && new Date(endsAt).getTime() < now) {
    return 'This pass has expired. Adjust Valid through or turn off Active.'
  }
  return null
}

function effectiveActive(
  active: boolean,
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
): boolean {
  if (!active) return false
  return isWithinValidationWindow(startsAt, endsAt)
}

function toForm(t: FreePassTemplate | null): FreePassTemplateInput {
  if (t) {
    return {
      name: t.name,
      description: t.description,
      active: effectiveActive(t.active, t.startsAt, t.endsAt),
      startsAt: t.startsAt,
      endsAt: t.endsAt,
      benefitUnit: t.benefitUnit,
      benefitQuantity: t.benefitQuantity,
      applicationMethod: t.applicationMethod,
      scopeLevel: t.scopeLevel,
      scopeRefId: t.scopeRefId,
      dayOfWeek: t.dayOfWeek,
      offeringIds: t.offeringIds ?? [],
      eligibility: t.eligibility ?? {},
      issuance: t.issuance ?? {},
      debitsFreeClassAllowance: t.debitsFreeClassAllowance,
      stackable: t.stackable,
      exclusivityGroup: t.exclusivityGroup,
      maxRedemptions: t.maxRedemptions,
      maxRedemptionsPerMember: t.maxRedemptionsPerMember,
      config: t.config ?? {},
    }
  }
  return {
    name: '',
    description: '',
    active: true,
    startsAt: null,
    endsAt: null,
    benefitUnit: 'slot',
    benefitQuantity: 1,
    applicationMethod: 'waive_enrollment',
    scopeLevel: 'global',
    scopeRefId: null,
    dayOfWeek: null,
    offeringIds: [],
    eligibility: {},
    issuance: { auto_on_enroll: false, admin_only: false },
    debitsFreeClassAllowance: false,
    stackable: true,
    exclusivityGroup: null,
    maxRedemptions: null,
    maxRedemptionsPerMember: null,
    config: {},
  }
}

const FreePassEditor = ({ open, template, onSave, onClose }: Props) => {
  const [form, setForm] = useState<FreePassTemplateInput>(() => toForm(template))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      const next = toForm(template)
      setForm(next)
      setError(null)
    }
  }, [open, template])

  if (!open) return null

  const update = (patch: Partial<FreePassTemplateInput>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch }
      if (patch.benefitUnit === 'day' && next.applicationMethod === 'waive_enrollment') {
        next.applicationMethod = 'monthly_prorate'
      }
      if (patch.benefitUnit === 'specific_date') {
        next.applicationMethod = 'monthly_prorate'
        next.dayOfWeek = null
      }
      if (patch.benefitUnit === 'slot' || patch.benefitUnit === 'offering') {
        next.applicationMethod = 'waive_enrollment'
      }
      if (patch.benefitUnit && patch.benefitUnit !== 'specific_date') {
        next.config = mergeBenefitDatesConfig(next.config, { startDate: null, endDate: null })
      }
      if (
        (patch.startsAt !== undefined || patch.endsAt !== undefined) &&
        next.active &&
        !isWithinValidationWindow(next.startsAt ?? null, next.endsAt ?? null)
      ) {
        next.active = false
      }
      return next
    })
  }

  const handleActiveChange = (checked: boolean) => {
    if (checked) {
      const msg = validationWindowError(form.startsAt ?? null, form.endsAt ?? null)
      if (msg) {
        setError(msg)
        return
      }
    }
    setError(null)
    update({ active: checked })
  }

  const updateIssuance = (patch: Record<string, unknown>) => {
    setForm((prev) => ({ ...prev, issuance: { ...prev.issuance, ...patch } }))
  }

  const schoolNames = schoolNamesFromEligibility(form.eligibility)
  const allSchools = appliesToAllSchools(form.eligibility)
  const schoolLevels = schoolLevelsFromEligibility(form.eligibility)
  const perSchoolLimits = maxRedemptionsPerSchoolFromConfig(form.config)
  const benefitDates = benefitDatesFromConfig(form.config)

  const setSchoolNames = (names: string[]) => {
    setForm((prev) => {
      const eligibility = mergeSchoolEligibility(prev.eligibility, names)
      const allowed = new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))
      const limits = maxRedemptionsPerSchoolFromConfig(prev.config)
      const config = { ...(prev.config ?? {}) }
      const pruned: Record<string, number> = {}
      for (const [key, value] of Object.entries(limits)) {
        if (allowed.has(key)) pruned[key] = value
      }
      if (Object.keys(pruned).length > 0) config.max_redemptions_per_school = pruned
      else delete config.max_redemptions_per_school
      return { ...prev, eligibility, config }
    })
  }

  const setAllSchools = (checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      eligibility: mergeAppliesToAllSchools(prev.eligibility, checked),
      config: checked
        ? (() => {
            const next = { ...(prev.config ?? {}) }
            delete next.max_redemptions_per_school
            return next
          })()
        : prev.config,
    }))
  }

  const toggleSchoolLevel = (level: SchoolLevelFilter, checked: boolean) => {
    setForm((prev) => {
      const current = schoolLevelsFromEligibility(prev.eligibility)
      const nextLevels = checked
        ? [...current, level]
        : current.filter((l) => l !== level)
      return {
        ...prev,
        eligibility: mergeSchoolLevels(prev.eligibility, nextLevels),
      }
    })
  }

  const setPerSchoolMax = (schoolName: string, max: number | null) => {
    setForm((prev) => ({
      ...prev,
      config: mergeMaxRedemptionForSchool(prev.config, schoolName, max),
    }))
  }

  const setBenefitDates = (startDate: string | null, endDate: string | null) => {
    setForm((prev) => ({
      ...prev,
      config: mergeBenefitDatesConfig(prev.config, { startDate, endDate }),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = { ...form }
      if (payload.active) {
        const windowError = validationWindowError(payload.startsAt ?? null, payload.endsAt ?? null)
        if (windowError) {
          setError(windowError)
          return
        }
      }
      if (payload.benefitUnit === 'specific_date' && !benefitDatesFromConfig(payload.config).startDate) {
        setError('Select a benefit date (or date range) for Specific date passes.')
        return
      }
      await onSave(payload)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">{template ? 'Edit free pass' : 'New free pass'}</h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-4 space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">Name</label>
            <input
              required
              className={fieldClass}
              value={form.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600">Description</label>
            <textarea
              className={textareaClass}
              rows={2}
              value={form.description ?? ''}
              onChange={(e) => update({ description: e.target.value })}
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600">Issuance</p>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Promo code (optional)</label>
              <input
                className={fieldClass}
                placeholder="TRYFREE"
                value={String(form.issuance?.promo_code ?? '')}
                onChange={(e) => updateIssuance({ promo_code: e.target.value.trim().toUpperCase() })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.issuance?.auto_on_enroll)}
                onChange={(e) => updateIssuance({ auto_on_enroll: e.target.checked, admin_only: false })}
              />
              Auto-apply on enroll (when attached to class/program)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.issuance?.admin_only)}
                onChange={(e) =>
                  updateIssuance({ admin_only: e.target.checked, auto_on_enroll: false })
                }
              />
              Admin issue only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.debitsFreeClassAllowance}
                onChange={(e) => update({ debitsFreeClassAllowance: e.target.checked })}
              />
              Count against member free-class allowance
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.eligibility?.new_member)}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    eligibility: { ...prev.eligibility, new_member: e.target.checked },
                  }))
                }
              />
              First-time enrollees only
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Benefit</label>
              <select
                className={fieldClass}
                value={form.benefitUnit}
                onChange={(e) => update({ benefitUnit: e.target.value as FreePassBenefitUnit })}
              >
                {(Object.keys(FREE_PASS_BENEFIT_LABELS) as FreePassBenefitUnit[]).map((u) => (
                  <option key={u} value={u}>
                    {FREE_PASS_BENEFIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">
                {form.benefitUnit === 'specific_date' ? 'Max sessions' : 'Quantity'}
              </label>
              <input
                type="number"
                min={1}
                className={fieldClass}
                value={form.benefitQuantity}
                onChange={(e) => update({ benefitQuantity: Math.max(1, Number(e.target.value) || 1) })}
              />
              {form.benefitUnit === 'specific_date' && (
                <p className="text-xs text-gray-500 mt-1">
                  Maximum class sessions to credit within the selected dates.
                </p>
              )}
            </div>
          </div>

          {form.benefitUnit === 'specific_date' && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div>
                <p className="text-sm font-bold text-gray-900">Benefit dates</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Pick a single date or a range. Monthly credit is prorated from scheduled class
                  occurrences on those dates within the offering.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-600">Date</label>
                  <input
                    type="date"
                    required
                    className={fieldClass}
                    value={benefitDates.startDate ?? ''}
                    onChange={(e) =>
                      setBenefitDates(
                        e.target.value || null,
                        benefitDates.endDate && benefitDates.endDate >= (e.target.value || '')
                          ? benefitDates.endDate
                          : e.target.value || null,
                      )
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">Required. Start of the free period.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-gray-600">
                    Through (optional)
                  </label>
                  <input
                    type="date"
                    className={fieldClass}
                    min={benefitDates.startDate ?? undefined}
                    value={
                      benefitDates.endDate &&
                      benefitDates.startDate &&
                      benefitDates.endDate !== benefitDates.startDate
                        ? benefitDates.endDate
                        : ''
                    }
                    onChange={(e) =>
                      setBenefitDates(
                        benefitDates.startDate,
                        e.target.value && e.target.value >= (benefitDates.startDate ?? '')
                          ? e.target.value
                          : benefitDates.startDate,
                      )
                    }
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty for a single date. Set an end date for a range.
                  </p>
                </div>
              </div>
            </div>
          )}

          {form.benefitUnit === 'day' && (
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600">Day of week</label>
              <select
                className={fieldClass}
                value={form.dayOfWeek ?? ''}
                onChange={(e) =>
                  update({
                    dayOfWeek: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              >
                <option value="">Any day</option>
                {DAY_OF_WEEK_LABELS.map((label, i) => (
                  <option key={label} value={i}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Monthly credit is prorated from scheduled occurrences in the offering.
              </p>
            </div>
          )}

          <p className="text-xs text-gray-500 rounded-lg border border-dashed border-gray-200 px-3 py-2">
            Wire this pass to sports, programs, classes, or categories under Pricing → Costs.
            Member grants and promo codes still work when configured below.
          </p>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-gray-900">Class offerings (optional)</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Restrict which class sessions this pass can apply to. Search and add active or
                upcoming offerings. Leave empty to allow any offering where this pass is attached
                under Pricing → Costs.
              </p>
            </div>
            <ClassOfferingMultiSelect
              value={form.offeringIds ?? []}
              onChange={(offeringIds) => update({ offeringIds })}
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-gray-900">Schools (optional)</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Restrict by member school from signup. Level filters and named schools only match
                schools in your database — custom write-in schools are excluded.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allSchools}
                onChange={(e) => setAllSchools(e.target.checked)}
              />
              Applies to all schools
            </label>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {SCHOOL_LEVEL_OPTIONS.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={schoolLevels.includes(value)}
                    onChange={(e) => toggleSchoolLevel(value, e.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <SchoolMultiSelect
              value={schoolNames}
              onChange={setSchoolNames}
              disabled={allSchools}
              levelFilter={schoolLevels}
              emptyHint={
                allSchools
                  ? 'All database schools qualify — no individual selection needed.'
                  : undefined
              }
            />
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-gray-900">Max redemptions</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Set either limit alone or both. Example: 1 per person and 20 facility-wide means each
                member can use the pass once, and only 20 total uses are available gym-wide.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-600">Per person</label>
                <input
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  className={fieldClass}
                  value={form.maxRedemptionsPerMember ?? ''}
                  onChange={(e) =>
                    update({
                      maxRedemptionsPerMember:
                        e.target.value === '' ? null : Math.max(1, Number(e.target.value)),
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">Max uses per member. Leave empty for no limit.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-600">Facility max</label>
                <input
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  className={fieldClass}
                  value={form.maxRedemptions ?? ''}
                  onChange={(e) =>
                    update({
                      maxRedemptions: e.target.value === '' ? null : Math.max(1, Number(e.target.value)),
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">Total uses across all members. Leave empty for no limit.</p>
              </div>
            </div>
            {schoolNames.length > 0 && !allSchools && (
              <div className="border-t border-gray-200 pt-3 space-y-2">
                <p className="text-xs font-semibold text-gray-600">Per selected school</p>
                <p className="text-xs text-gray-500">
                  Facility-wide cap for each school listed above. Leave empty for no limit.
                </p>
                {schoolNames.map((name) => {
                  const key = name.trim().toLowerCase()
                  return (
                    <div key={name} className="grid grid-cols-2 gap-3 items-center">
                      <span className="text-sm text-gray-800 truncate" title={name}>
                        {name}
                      </span>
                      <input
                        type="number"
                        min={1}
                        placeholder="Unlimited"
                        className={fieldClass}
                        value={perSchoolLimits[key] ?? ''}
                        onChange={(e) =>
                          setPerSchoolMax(
                            name,
                            e.target.value === '' ? null : Math.max(1, Number(e.target.value)),
                          )
                        }
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div>
              <p className="text-sm font-bold text-gray-900">Validation dates</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Active passes only work within these dates. Outside the window, Active is turned off
                automatically.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-600">Valid from (optional)</label>
                <input
                  type="date"
                  className={fieldClass}
                  value={dateInputValue(form.startsAt)}
                  onChange={(e) =>
                    update({
                      startsAt: e.target.value ? startDateToIso(e.target.value) : null,
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to start immediately.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-600">Valid through (optional)</label>
                <input
                  type="date"
                  className={fieldClass}
                  value={dateInputValue(form.endsAt)}
                  onChange={(e) =>
                    update({
                      endsAt: e.target.value ? endDateToIso(e.target.value) : null,
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty for a permanent pass with no end date.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => handleActiveChange(e.target.checked)}
              />
              Active
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-vortex-red text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default FreePassEditor
