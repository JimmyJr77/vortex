import { useEffect, useId, useState } from 'react'
import { adminPreviewCalendarCancellation, type CalendarCancellationPreview } from '../../utils/schedulingApi'
import EmailSignaturePreview from './EmailSignaturePreview'

export default function CalendarCancellationEmail({ date, slotId, onChange, disabled = false }: {
  date: string
  slotId?: number
  onChange: (body: string | null) => void
  disabled?: boolean
}) {
  const messageId = useId()
  const [preview, setPreview] = useState<CalendarCancellationPreview | null>(null)
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setPreview(null)
    setError(null)
    onChange(null)
    void adminPreviewCalendarCancellation({ date, slotId }, controller.signal).then(data => {
      if (controller.signal.aborted) return
      setPreview(data)
      setBody(data.body)
      onChange(data.body)
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to prepare the cancellation email.')
    })
    return () => controller.abort()
  }, [date, slotId, attempt, onChange])

  if (error) return <div role="alert" className="space-y-2 text-sm text-red-700"><p>{error}</p><button type="button" disabled={disabled} onClick={() => setAttempt(value => value + 1)} className="rounded-lg border border-red-300 px-3 py-2 font-semibold disabled:opacity-50">Retry email preview</button></div>
  if (!preview) return <p role="status" className="text-sm text-gray-600">Preparing the parent notification…</p>

  return <section aria-label="Cancellation email" className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
    <p><span className="font-semibold">Subject:</span> {preview.subject}</p>
    <p>{preview.recipientCount ? `This message will be emailed to ${preview.recipientCount} parent or account contact${preview.recipientCount === 1 ? '' : 's'}.` : 'No registered families with an email address need notification.'}</p>
    {preview.missingContactCount > 0 ? <p role="status" className="text-amber-800">{preview.missingContactCount} student{preview.missingContactCount === 1 ? ' has' : 's have'} no valid parent or account email on file.</p> : null}
    <label htmlFor={messageId} className="block font-semibold">Email message to parents</label>
    <textarea id={messageId} rows={10} maxLength={20000} required disabled={disabled} value={body} onChange={event => { setBody(event.target.value); onChange(event.target.value) }} className="w-full rounded-lg border border-gray-300 bg-white p-3 font-normal leading-relaxed text-gray-900 disabled:opacity-60" />
    <p className="text-xs text-gray-500">Review or edit this message before confirming. The full Vortex signature below is added automatically.</p>
    <EmailSignaturePreview signature={preview.signature} />
  </section>
}
