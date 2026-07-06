import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { CriticalComposeFlags } from './types'

interface CriticalMessageToggleProps {
  value: CriticalComposeFlags
  onChange: (value: CriticalComposeFlags) => void
  disabled?: boolean
}

const SMS_CONFIRM_WORD = 'sms'

export default function CriticalMessageToggle({ value, onChange, disabled = false }: CriticalMessageToggleProps) {
  const [smsConfirmText, setSmsConfirmText] = useState('')
  const [showSmsOption, setShowSmsOption] = useState(false)

  useEffect(() => {
    if (!value.is_critical) {
      setSmsConfirmText('')
      setShowSmsOption(false)
    }
  }, [value.is_critical])

  const applySmsConfirmText = (text: string) => {
    setSmsConfirmText(text)
    onChange({
      ...value,
      send_critical_sms: text === SMS_CONFIRM_WORD,
    })
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 space-y-2">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.is_critical}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.checked) {
              onChange({ is_critical: true, requires_ack: false, send_critical_sms: false })
              return
            }
            setShowSmsOption(false)
            setSmsConfirmText('')
            onChange({ is_critical: false, requires_ack: false, send_critical_sms: false })
          }}
          className="rounded border-gray-300 text-vortex-red focus:ring-vortex-red"
        />
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-800">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden />
          Critical message
        </span>
      </label>
      {value.is_critical && (
        <p className="pl-6 text-xs text-gray-600">
          Sends as critical and emails recipients who opted in under notification preferences.
        </p>
      )}
      {value.is_critical && (
        <div className="pl-6 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showSmsOption || value.send_critical_sms}
              disabled={disabled}
              onChange={(e) => {
                if (e.target.checked) {
                  setShowSmsOption(true)
                  return
                }
                setShowSmsOption(false)
                setSmsConfirmText('')
                onChange({ ...value, send_critical_sms: false })
              }}
              className="rounded border-gray-300 text-vortex-red focus:ring-vortex-red"
            />
            <span className="text-sm font-medium text-gray-800">Also send SMS alerts</span>
          </label>
          {(showSmsOption || value.send_critical_sms) && (
            <label className="block text-xs font-medium text-gray-700">
              Type <span className="font-mono">{SMS_CONFIRM_WORD}</span> to confirm SMS
              <input
                type="text"
                value={smsConfirmText}
                disabled={disabled}
                onChange={(e) => applySmsConfirmText(e.target.value)}
                placeholder={SMS_CONFIRM_WORD}
                autoComplete="off"
                spellCheck={false}
                className="mt-1 w-full max-w-xs border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
              />
            </label>
          )}
          {smsConfirmText.length > 0 && smsConfirmText !== SMS_CONFIRM_WORD && (
            <p className="text-xs text-red-600">Enter exactly &ldquo;{SMS_CONFIRM_WORD}&rdquo; in lowercase.</p>
          )}
        </div>
      )}
    </div>
  )
}
