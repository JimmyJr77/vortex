import type { ChangeEventHandler } from 'react'

interface DateOfBirthInputProps {
  value: string
  onChange: ChangeEventHandler<HTMLInputElement>
  /** Styling for the input itself (border, padding, text size…). */
  className?: string
  /** Layout classes for the wrapper (grid spans etc.). */
  containerClassName?: string
  label?: string
  required?: boolean
}

/**
 * Native `type="date"` inputs can't show placeholder text — iOS Safari renders
 * an unlabeled gray pill and desktop browsers show only "mm/dd/yyyy" — so this
 * overlays the label inside the field while it's empty and forces a white
 * background over the platform's default tint.
 */
export default function DateOfBirthInput({
  value,
  onChange,
  className = '',
  containerClassName = '',
  label = 'Date of Birth',
  required = false,
}: DateOfBirthInputProps) {
  const text = required ? `${label} *` : label
  return (
    <div className={`relative ${containerClassName}`}>
      <input
        type="date"
        value={value}
        onChange={onChange}
        aria-label={text}
        className={`w-full appearance-none bg-white [&::-webkit-date-and-time-value]:text-left ${className}`}
      />
      {!value && (
        <span className="pointer-events-none absolute inset-y-[3px] left-[3px] right-10 flex items-center rounded-md bg-white pl-3 text-sm text-gray-500">
          {text}
        </span>
      )}
    </div>
  )
}
