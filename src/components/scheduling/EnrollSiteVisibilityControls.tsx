import {
  ALL_ENROLL_SITES,
  ENROLL_SITE_OPTIONS,
  type EnrollSiteKey,
} from '../../config/enrollSites'

interface Props {
  sites: EnrollSiteKey[]
  disabled?: boolean
  onChange: (sites: EnrollSiteKey[]) => void
  layout?: 'stack' | 'inline'
}

const EnrollSiteVisibilityControls = ({
  sites,
  disabled = false,
  onChange,
  layout = 'stack',
}: Props) => {
  const toggle = (key: EnrollSiteKey, checked: boolean) => {
    if (checked) {
      onChange([...new Set([...sites, key])])
      return
    }
    onChange(sites.filter((site) => site !== key))
  }

  const containerClass =
    layout === 'inline'
      ? 'flex flex-col sm:flex-row sm:flex-wrap gap-x-4 gap-y-2'
      : 'space-y-2'

  return (
    <div className={containerClass}>
      {ENROLL_SITE_OPTIONS.map(({ key, label }) => (
        <label
          key={key}
          className={`flex items-center gap-2 text-sm text-gray-700 ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          <input
            type="checkbox"
            checked={sites.includes(key)}
            disabled={disabled}
            onChange={(e) => toggle(key, e.target.checked)}
            className="rounded border-gray-300"
          />
          {label}
        </label>
      ))}
    </div>
  )
}

export default EnrollSiteVisibilityControls

export function enrollSitesFromLegacyActive(active: boolean | undefined): EnrollSiteKey[] {
  return active ? [...ALL_ENROLL_SITES] : []
}
