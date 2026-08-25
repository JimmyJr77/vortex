import type { Ref } from 'react'
import { getTodayDateString } from '../../utils/dateUtils'

interface EnrollmentStartDateFieldProps {
  id: string
  value: string
  onChange: (value: string) => void
  error?: string | null
  inputRef?: Ref<HTMLInputElement>
  className?: string
  helpText?: string
  required?: boolean
}

export default function EnrollmentStartDateField({
  id,
  value,
  onChange,
  error = null,
  inputRef,
  className = '',
  helpText = 'Choose the date you want the class enrollment to take effect.',
  required = true,
}: EnrollmentStartDateFieldProps) {
  const helpId = `${id}-help`
  const errorId = `${id}-error`

  return (
    <label className={`flex flex-col gap-1 ${className}`} htmlFor={id}>
      <span className="text-xs font-semibold text-gray-700">
        Enrollment start date {required ? <span className="text-vortex-red" aria-hidden="true">*</span> : null}
      </span>
      <input
        ref={inputRef}
        id={id}
        type="date"
        required={required}
        min={getTodayDateString()}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={`${helpId}${error ? ` ${errorId}` : ''}`}
        className={`h-10 rounded-lg border bg-white px-3 text-sm ${
          error ? 'border-red-500 ring-1 ring-red-200' : 'border-gray-300'
        }`}
      />
      <span id={helpId} className="text-xs text-gray-500">{helpText}</span>
      {error ? (
        <span id={errorId} role="alert" className="text-xs font-semibold text-red-700">
          {error}
        </span>
      ) : null}
    </label>
  )
}
