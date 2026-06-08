import {
  DEFAULT_SIGNUP_FIELDS,
  isParentFieldLockedByWaiver,
  MANDATE_WAIVER_PARENT_FIELDS,
  SCHEDULING_SIGNUP_FIELD_CATALOG,
  SIGNUP_FIELD_GROUPS,
} from '../../config/schedulingSignupFields'

interface Props {
  selected: string[]
  waiverEnabled: boolean
  onSelectedChange: (fields: string[]) => void
  onWaiverChange: (enabled: boolean) => void
}

const AdminSchedulingSignupFields = ({
  selected,
  waiverEnabled,
  onSelectedChange,
  onWaiverChange,
}: Props) => {
  const toggle = (key: string) => {
    if (DEFAULT_SIGNUP_FIELDS.includes(key as (typeof DEFAULT_SIGNUP_FIELDS)[number])) return
    if (isParentFieldLockedByWaiver(key, waiverEnabled)) return
    onSelectedChange(
      selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key],
    )
  }

  const handleWaiverToggle = (enabled: boolean) => {
    onWaiverChange(enabled)
    if (enabled) {
      onSelectedChange([...new Set([...selected, ...MANDATE_WAIVER_PARENT_FIELDS])])
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-gray-600 text-sm">
        Choose which fields appear on the public signup form. First Name, Last Name, and Email are always included.
      </p>

      <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={waiverEnabled}
            onChange={(e) => handleWaiverToggle(e.target.checked)}
            className="h-5 w-5 mt-0.5 rounded text-vortex-red"
          />
          <span>
            <span className="font-bold text-black block">Mandate Waiver</span>
            <span className="text-sm text-gray-600">
              Requires guardian first name, last name, and email. After signup, the registrant receives a
              confirmation email and the guardian receives a Jackrabbit waiver link.
            </span>
          </span>
        </label>
      </div>

      {SIGNUP_FIELD_GROUPS.map((group) => (
        <div key={group.id}>
          <h3 className="font-bold text-black mb-3">{group.label}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SCHEDULING_SIGNUP_FIELD_CATALOG.filter((f) => f.group === group.id).map((field) => {
              const isDefaultRequired = DEFAULT_SIGNUP_FIELDS.includes(
                field.key as (typeof DEFAULT_SIGNUP_FIELDS)[number],
              )
              const lockedByWaiver = isParentFieldLockedByWaiver(field.key, waiverEnabled)
              const checked = isDefaultRequired || lockedByWaiver || selected.includes(field.key)
              const isRequired = isDefaultRequired || lockedByWaiver
              return (
                <label
                  key={field.key}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                    isRequired ? 'border-gray-200 bg-gray-50 opacity-80' : 'border-gray-200 cursor-pointer hover:border-gray-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isRequired}
                    onChange={() => toggle(field.key)}
                    className="h-4 w-4 rounded text-vortex-red"
                  />
                  <span className="text-sm text-gray-800">
                    {field.label}
                    {isRequired && <span className="text-vortex-red ml-1">*</span>}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default AdminSchedulingSignupFields
