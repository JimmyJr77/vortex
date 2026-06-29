import {
  PROGRAM_PRICING_OPTION_DEFS,
  PROGRAM_PRICING_SECTION_LABELS,
  type ProgramPricingOption,
  type ProgramPricingOptionSection,
} from '../../utils/programPricingOptions'

interface Props {
  options: ProgramPricingOption[]
  onChange: (options: ProgramPricingOption[]) => void
  disabled?: boolean
}

const SECTION_ORDER: ProgramPricingOptionSection[] = [
  'single',
  'weekly',
  'weekly_discount',
  'unlimited',
  'other',
]

const inputClass =
  'h-9 w-28 rounded-lg border border-gray-300 px-2 text-sm disabled:bg-gray-50'

function patchOption(
  options: ProgramPricingOption[],
  key: ProgramPricingOption['key'],
  patch: Partial<ProgramPricingOption>,
): ProgramPricingOption[] {
  return options.map((o) => (o.key === key ? { ...o, ...patch } : o))
}

const ProgramPricingOptionsFields = ({ options, onChange, disabled = false }: Props) => {
  return (
    <div className="space-y-6">
      {SECTION_ORDER.map((section) => {
        const defs = PROGRAM_PRICING_OPTION_DEFS.filter((d) => d.section === section)
        if (defs.length === 0) return null

        const showWeeklyDiscountNote =
          section === 'weekly_discount' &&
          defs.some((d) => options.find((o) => o.key === d.key)?.enabled)

        return (
          <div key={section}>
            <h5 className="text-sm font-bold text-gray-900 mb-2">
              {PROGRAM_PRICING_SECTION_LABELS[section]}
            </h5>
            {section === 'weekly_discount' && (
              <p className="text-xs text-gray-500 mb-2">
                Saving enabled “$ off” options creates a per-class discount under each class in
                this program.
              </p>
            )}
            <ul className="space-y-2">
              {defs.map((def) => {
                const row = options.find((o) => o.key === def.key)!
                const isPerOffering = def.key === 'per_offering'
                return (
                  <li
                    key={def.key}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2"
                  >
                    <label className="inline-flex items-center gap-2 min-w-[1.5rem]">
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={row.enabled}
                        onChange={(e) => {
                          onChange(
                            patchOption(options, def.key, { enabled: e.target.checked }),
                          )
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
                      <span className="text-sm text-gray-800 flex-1 min-w-[12rem]">{def.label}</span>
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
                          onChange(
                            patchOption(options, def.key, {
                              amountCents: Math.round((Number(e.target.value) || 0) * 100),
                            }),
                          )
                        }}
                        className={inputClass}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
            {showWeeklyDiscountNote && (
              <p className="text-xs text-amber-700 mt-2">
                Weekly “$ off” discounts are created when you save program defaults.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default ProgramPricingOptionsFields
