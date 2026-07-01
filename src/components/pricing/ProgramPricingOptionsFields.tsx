import { useMemo, useState } from 'react'
import {
  PROGRAM_PRICING_OPTION_DEFS,
  PROGRAM_PRICING_SECTION_LABELS,
  type ProgramPricingOption,
  type ProgramPricingOptionKey,
  type ProgramPricingOptionSection,
} from '../../utils/programPricingOptions'
import type { MultiClassPassPackage } from '../../utils/multiClassPassPackages'
import {
  applyWeeklyTierAutoFill,
  isWeeklyTierKey,
  syncWeeklyTierEnabledFlags,
} from '../../utils/weeklyTierPricing'
import MultiClassPassPackagesField from './MultiClassPassPackagesField'

interface Props {
  options: ProgramPricingOption[]
  onChange: (options: ProgramPricingOption[]) => void
  passPackages?: MultiClassPassPackage[]
  onPassPackagesChange?: (packages: MultiClassPassPackage[]) => void
  disabled?: boolean
}

const SECTION_ORDER: ProgramPricingOptionSection[] = ['single', 'weekly', 'unlimited', 'other']

const inputClass =
  'h-9 w-28 rounded-lg border border-gray-300 px-2 text-sm disabled:bg-gray-50'

function patchOption(
  options: ProgramPricingOption[],
  key: ProgramPricingOption['key'],
  patch: Partial<ProgramPricingOption>,
): ProgramPricingOption[] {
  return options.map((o) => (o.key === key ? { ...o, ...patch } : o))
}

function weeklySlotCount(key: ProgramPricingOptionKey): number | null {
  if (!isWeeklyTierKey(key) || key === 'monthly_1x') return null
  return Number(key.replace('monthly_', '').replace('x', ''))
}

const ProgramPricingOptionsFields = ({
  options,
  onChange,
  passPackages,
  onPassPackagesChange,
  disabled = false,
}: Props) => {
  const [manualWeeklyKeys, setManualWeeklyKeys] = useState<Set<ProgramPricingOptionKey>>(
    () => new Set(),
  )

  const autoFilledKeys = useMemo(() => {
    const manual = manualWeeklyKeys
    return new Set(
      options
        .filter((o) => isWeeklyTierKey(o.key) && o.enabled && !manual.has(o.key))
        .map((o) => o.key),
    )
  }, [options, manualWeeklyKeys])

  const commitOptions = (
    next: ProgramPricingOption[],
    manualOverride?: Set<ProgramPricingOptionKey>,
  ) => {
    const manual = manualOverride ?? manualWeeklyKeys
    onChange(applyWeeklyTierAutoFill(next, manual))
  }

  const handleWeeklyEnabledChange = (key: ProgramPricingOptionKey, enabled: boolean) => {
    if (key === 'monthly_1x') {
      let next = patchOption(options, key, { enabled })
      next = syncWeeklyTierEnabledFlags(next, enabled)
      if (!enabled) {
        setManualWeeklyKeys(new Set())
      }
      commitOptions(next, enabled ? manualWeeklyKeys : new Set())
      return
    }

    let next = patchOption(options, key, { enabled })
    if (!enabled) {
      const slotN = weeklySlotCount(key)
      if (slotN != null) {
        next = next.map((row) => {
          if (!isWeeklyTierKey(row.key)) return row
          const n = weeklySlotCount(row.key)
          if (n != null && n > slotN) return { ...row, enabled: false }
          return row
        })
      }
    }
    commitOptions(next)
  }

  const handleWeeklyAmountChange = (key: ProgramPricingOptionKey, amountCents: number) => {
    const nextManual = new Set(manualWeeklyKeys)
    nextManual.add(key)
    setManualWeeklyKeys(nextManual)
    const next = patchOption(options, key, { amountCents })
    commitOptions(next, nextManual)
  }

  return (
    <div className="space-y-6">
      {SECTION_ORDER.map((section) => {
        const defs = PROGRAM_PRICING_OPTION_DEFS.filter((d) => d.section === section)
        if (defs.length === 0) return null

        return (
          <div key={section}>
            <h5 className="text-sm font-bold text-gray-900 mb-2">
              {PROGRAM_PRICING_SECTION_LABELS[section]}
            </h5>
            <ul className="space-y-2">
              {defs.map((def) => {
                const row = options.find((o) => o.key === def.key)!
                const isPerOffering = def.key === 'per_offering'
                const isWeekly = isWeeklyTierKey(def.key)
                const isAutoFilled = isWeekly && autoFilledKeys.has(def.key)
                return (
                  <li
                    key={def.key}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2"
                  >
                    <label className="inline-flex items-center gap-2 min-w-[1.5rem]">
                      <input
                        type="checkbox"
                        disabled={disabled || (isWeekly && def.key !== 'monthly_1x' && !options.find((o) => o.key === 'monthly_1x')?.enabled)}
                        checked={row.enabled}
                        onChange={(e) => {
                          if (isWeekly) {
                            handleWeeklyEnabledChange(def.key, e.target.checked)
                          } else {
                            onChange(patchOption(options, def.key, { enabled: e.target.checked }))
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-vortex-red focus:ring-vortex-red"
                      />
                      <span className="sr-only">Enable {def.label}</span>
                    </label>
                    {isPerOffering ? (
                      <span className="text-sm text-gray-800 flex flex-wrap items-center gap-2">
                        <span>$ per</span>
                        <select
                          disabled={disabled || !row.enabled}
                          value={row.offeringLabel ?? 'offering'}
                          onChange={(e) => {
                            onChange(
                              patchOption(options, def.key, {
                                offeringLabel: e.target.value as 'offering' | 'event',
                              }),
                            )
                          }}
                          className="h-9 rounded-lg border border-gray-300 px-2 text-sm disabled:bg-gray-50"
                        >
                          <option value="offering">offering</option>
                          <option value="event">event</option>
                        </select>
                      </span>
                    ) : (
                      <span className="text-sm text-gray-800 flex-1 min-w-[12rem]">
                        {def.label}
                        {isAutoFilled && (
                          <span className="ml-2 text-xs font-normal text-gray-400">Auto</span>
                        )}
                      </span>
                    )}
                    <div className="flex items-center gap-1 ml-auto">
                      <span className="text-sm text-gray-500">$</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        disabled={disabled || !row.enabled}
                        value={row.enabled ? row.amountCents / 100 : ''}
                        placeholder="0.00"
                        onChange={(e) => {
                          const cents = Math.round((Number(e.target.value) || 0) * 100)
                          if (isWeekly) {
                            handleWeeklyAmountChange(def.key, cents)
                          } else {
                            onChange(patchOption(options, def.key, { amountCents: cents }))
                          }
                        }}
                        className={inputClass}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
            {section === 'single' && passPackages != null && onPassPackagesChange != null && (
              <div className="mt-6">
                <MultiClassPassPackagesField
                  packages={passPackages}
                  onChange={onPassPackagesChange}
                  disabled={disabled}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default ProgramPricingOptionsFields
