import type {InputHTMLAttributes} from 'react'
import {formatPhoneForDisplay, formatPhoneNumber, PHONE_FORMAT_ERROR, PHONE_INPUT_PATTERN, PHONE_INPUT_PLACEHOLDER} from '../../utils/phoneUtils'

/** Native input behavior, with consistent US phone formatting for tel fields. */
export default function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  if (props.type !== 'tel') return <input {...props} />
  const {value, defaultValue, onChange, onKeyDown, ...rest} = props
  return <input {...rest} type="tel" inputMode="tel"
    placeholder={PHONE_INPUT_PLACEHOLDER}
    pattern={props.pattern ?? PHONE_INPUT_PATTERN}
    title={props.title ?? PHONE_FORMAT_ERROR}
    // Normalize after paste, rather than truncating a pasted (###) ###-####
    // before its punctuation and optional US country code can be removed.
    maxLength={undefined}
    value={value == null ? value : formatPhoneForDisplay(String(value))}
    defaultValue={defaultValue == null ? defaultValue : formatPhoneForDisplay(String(defaultValue))}
    onKeyDown={event => {
      onKeyDown?.(event)
      if (event.defaultPrevented) return
      const input = event.currentTarget, start = input.selectionStart, end = input.selectionEnd
      if (start == null || start !== end) return
      if (event.key === 'Backspace' && start > 1 && input.value[start - 1] === '-') {
        input.setSelectionRange(start - 2, start)
      } else if (event.key === 'Delete' && input.value[start] === '-') {
        input.setSelectionRange(start, start + 2)
      }
    }}
    onChange={event => {
      const input = event.currentTarget, raw = input.value
      const formatted = formatPhoneNumber(raw)
      if (formatted === raw) {
        onChange?.(event)
        return
      }
      const digitsBeforeCaret = raw.slice(0, input.selectionStart ?? raw.length).replace(/\D/g, '').length
      const removedCountryCode = raw.replace(/\D/g, '').length - formatted.replace(/\D/g, '').length
      input.value = formatted
      onChange?.(event)
      let caret = 0, digits = 0
      while (caret < formatted.length && digits < digitsBeforeCaret - removedCountryCode) {
        if (/\d/.test(formatted[caret])) digits++
        caret++
      }
      requestAnimationFrame(() => {
        if (document.activeElement === input && input.value === formatted) input.setSelectionRange(caret, caret)
      })
    }} />
}
