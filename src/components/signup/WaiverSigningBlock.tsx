import type { PublicWaiverTemplate } from './waiverSigningUtils'

interface WaiverSigningBlockProps {
  waivers: PublicWaiverTemplate[]
  checkedTemplateIds: number[]
  onToggleTemplate: (templateId: number, checked: boolean) => void
  agreeAll: boolean
  onAgreeAllChange: (checked: boolean) => void
  signatureName: string
  onSignatureNameChange: (value: string) => void
  comments: string
  onCommentsChange: (value: string) => void
  /** @deprecated Jackrabbit payment acknowledgement UI removed; kept for caller compatibility. */
  paymentPolicyAcknowledged?: boolean
  /** @deprecated Jackrabbit payment acknowledgement UI removed; kept for caller compatibility. */
  onPaymentPolicyAcknowledgedChange?: (checked: boolean) => void
  readOnly?: boolean
}

export default function WaiverSigningBlock({
  waivers,
  checkedTemplateIds,
  onToggleTemplate,
  agreeAll,
  onAgreeAllChange,
  signatureName,
  onSignatureNameChange,
  comments,
  onCommentsChange,
  readOnly = false,
}: WaiverSigningBlockProps) {
  const today = new Date().toLocaleDateString()

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        Expand each waiver to read it in full, select the waivers you agree to, then sign once at the bottom.
      </p>

      {waivers.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Waivers could not be loaded. Refresh the page or contact the gym office before creating your account.
        </div>
      )}

      {waivers.length > 0 && waivers.map((waiver) => {
        const alreadySigned = waiver.acceptance_id != null
        const checked = checkedTemplateIds.includes(waiver.id)
        return (
          <details key={waiver.id} className="rounded-xl border border-gray-200 group" open={waivers.length <= 2}>
            <summary className="cursor-pointer list-none p-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-bold text-gray-900 inline">{waiver.name}</h3>
                {waiver.is_required !== false && (
                  <span className="ml-2 text-xs font-semibold text-vortex-red">Required</span>
                )}
                {waiver.is_required === false && (
                  <span className="ml-2 text-xs font-semibold text-gray-500">Optional</span>
                )}
                {alreadySigned && (
                  <p className="text-xs text-green-700 mt-1">
                    Signed {waiver.accepted_at ? new Date(waiver.accepted_at).toLocaleDateString() : ''}
                  </p>
                )}
              </div>
              {waiver.waiver_type && (
                <span className="rounded-full bg-gray-100 text-gray-700 px-2 py-1 text-xs font-medium shrink-0">
                  {waiver.waiver_type.replace(/_/g, ' ')}
                </span>
              )}
            </summary>
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
              <div className="text-sm text-gray-600 whitespace-pre-wrap max-h-64 overflow-y-auto border border-gray-100 rounded-lg p-3 bg-gray-50">
                {waiver.body || 'Waiver text unavailable.'}
              </div>
              {!alreadySigned && !readOnly && (
                <label className="flex items-start gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={(e) => onToggleTemplate(waiver.id, e.target.checked)}
                  />
                  <span>I&apos;ve read the above and agree to {waiver.name}</span>
                </label>
              )}
            </div>
          </details>
        )
      })}

      {!readOnly && (
        <div className="rounded-xl border-2 border-gray-300 bg-gray-50 p-4 space-y-4">
          <label className="flex items-start gap-2 text-sm font-semibold text-gray-900">
            <input
              type="checkbox"
              className="mt-1"
              checked={agreeAll}
              onChange={(e) => onAgreeAllChange(e.target.checked)}
            />
            <span>I AGREE TO THE SELECTED WAIVERS ABOVE</span>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name (signature)</label>
              <input
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm bg-white"
                value={signatureName}
                onChange={(e) => onSignatureNameChange(e.target.value)}
                placeholder="Legal name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
              <input
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm bg-gray-100"
                value={today}
                readOnly
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Comments (optional)</label>
            <textarea
              className="w-full min-h-20 rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
              value={comments}
              onChange={(e) => onCommentsChange(e.target.value)}
              placeholder="Any notes for our records"
            />
          </div>
        </div>
      )}
    </div>
  )
}
