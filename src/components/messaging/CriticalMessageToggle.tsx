import { AlertTriangle } from 'lucide-react'
import type { CriticalComposeFlags } from './types'

interface CriticalMessageToggleProps {
  value: CriticalComposeFlags
  onChange: (value: CriticalComposeFlags) => void
  disabled?: boolean
}

export default function CriticalMessageToggle({ value, onChange, disabled = false }: CriticalMessageToggleProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 space-y-2">
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.is_critical}
          disabled={disabled}
          onChange={(e) => {
            const is_critical = e.target.checked
            onChange({
              is_critical,
              requires_ack: is_critical ? value.requires_ack : false,
            })
          }}
          className="mt-0.5 rounded border-gray-300 text-vortex-red focus:ring-vortex-red"
        />
        <span className="text-sm text-gray-800">
          <span className="inline-flex items-center gap-1 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden />
            Critical message
          </span>
          <span className="block text-xs text-gray-600 mt-0.5">
            Highlights this message and can trigger urgent notifications.
          </span>
        </span>
      </label>
      {value.is_critical && (
        <label className="flex items-center gap-2 pl-6 cursor-pointer">
          <input
            type="checkbox"
            checked={value.requires_ack}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, requires_ack: e.target.checked })}
            className="rounded border-gray-300 text-vortex-red focus:ring-vortex-red"
          />
          <span className="text-xs font-medium text-gray-700">Require acknowledgment</span>
        </label>
      )}
    </div>
  )
}
