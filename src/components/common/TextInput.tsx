import type {InputHTMLAttributes} from 'react'
import {formatPhoneNumber, PHONE_INPUT_PLACEHOLDER} from '../../utils/phoneUtils'

/** Native input behavior, with consistent US phone formatting for tel fields. */
export default function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  if (props.type !== 'tel') return <input {...props} />
  const {value, defaultValue, onChange, onKeyDown, ...rest} = props
  return <input {...rest} type="tel" inputMode="tel"
    placeholder={PHONE_INPUT_PLACEHOLDER}
    // Normalize after paste, rather than truncating a pasted (###) ###-####
    // before its punctuation and optional US country code can be removed.
    maxLength={undefined}
    value={value == null ? value : formatPhoneNumber(String(value))}
    defaultValue={defaultValue == null ? defaultValue : formatPhoneNumber(String(defaultValue))}
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
      let digitsBeforeCaret = raw.slice(0, input.selectionStart ?? raw.length).replace(/\D/g, '').length
      if (raw.replace(/\D/g, '').length === 11 && raw.replace(/\D/g, '').startsWith('1')) digitsBeforeCaret--
      const formatted = formatPhoneNumber(raw)
      input.value = formatted
      onChange?.(event)
      let caret = 0, digits = 0
      while (caret < formatted.length && digits < digitsBeforeCaret) {
        if (/\d/.test(formatted[caret])) digits++
        caret++
      }
      requestAnimationFrame(() => {
        if (input.isConnected && document.activeElement === input) input.setSelectionRange(caret, caret)
      })
    }} />
}
