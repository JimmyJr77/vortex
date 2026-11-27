import { useId } from 'react'
import type { ClassChangeEmailPreview as EmailPreview } from '../../utils/classChangeNotification'

export default function ClassChangeEmailPreview({ preview, body, onChange, disabled = false }: {
  preview: EmailPreview
  body: string
  onChange: (body: string) => void
  disabled?: boolean
}) {
  const messageId = useId()
  return <section aria-label="Parent class-change email" className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
    <p><span className="font-semibold">Subject:</span> {preview.subject}</p>
    <p>{preview.recipientCount ? `This update will be emailed to ${preview.recipientCount} parent or account contact${preview.recipientCount === 1 ? '' : 's'} after the class change is saved.` : 'No parent or account email address was found for this update.'}</p>
    {preview.missingContactCount > 0 ? <p role="status" className="text-amber-800">{preview.missingContactCount} student{preview.missingContactCount === 1 ? ' has' : 's have'} no valid parent or account email on file.</p> : null}
    <label htmlFor={messageId} className="block font-semibold">Email message to parents</label>
    <textarea id={messageId} rows={11} maxLength={20000} required disabled={disabled} value={body} onChange={event => onChange(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white p-3 font-normal leading-relaxed text-gray-900 disabled:opacity-60" />
    <p className="text-xs text-gray-500">Review or edit the message before confirming. This text will be the email body.</p>
  </section>
}
