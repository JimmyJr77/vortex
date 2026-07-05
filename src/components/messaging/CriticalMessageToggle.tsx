import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { CriticalComposeFlags } from './types'

interface CriticalMessageToggleProps {
  value: CriticalComposeFlags
  onChange: (value: CriticalComposeFlags) => void
  disabled?: boolean
}

const CONFIRM_WORD = 'critical'

export default function CriticalMessageToggle({ value, onChange, disabled = false }: CriticalMessageToggleProps) {
  const [confirmText, setConfirmText] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (!value.is_critical) {
      setConfirmText('')
      setShowConfirm(false)
    }
  }, [value.is_critical])

  const applyConfirmText = (text: string) => {
    setConfirmText(text)
    const confirmed = text === CONFIRM_WORD
    onChange({
      is_critical: confirmed,
      requires_ack: false,
    })
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 space-y-2">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.is_critical || showConfirm}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.checked) {
              setShowConfirm(true)
              return
            }
            setShowConfirm(false)
            setConfirmText('')
            onChange({ is_critical: false, requires_ack: false })
          }}
          className="rounded border-gray-300 text-vortex-red focus:ring-vortex-red"
        />
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-800">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" aria-hidden />
          Critical message
        </span>
      </label>
      {(showConfirm || value.is_critical) && (
        <div className="pl-6 space-y-2">
          <label className="block text-xs font-medium text-gray-700">
            Type <span className="font-mono">{CONFIRM_WORD}</span> to confirm
            <input
              type="text"
              value={confirmText}
              disabled={disabled}
              onChange={(e) => applyConfirmText(e.target.value)}
              placeholder={CONFIRM_WORD}
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full max-w-xs border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
            />
          </label>
          {confirmText.length > 0 && confirmText !== CONFIRM_WORD && (
            <p className="text-xs text-red-600">Enter exactly &ldquo;{CONFIRM_WORD}&rdquo; in lowercase.</p>
          )}
        </div>
      )}
    </div>
  )
}
