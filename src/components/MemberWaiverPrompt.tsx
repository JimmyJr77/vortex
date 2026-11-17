import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import { getApiUrl } from '../utils/api'
import WaiverSigningBlock from './signup/WaiverSigningBlock'
import { validateWaiverSigning, type PublicWaiverTemplate } from './signup/waiverSigningUtils'

interface Props {
  token: string
  onContinue: () => void
  onLogout: () => void
}

export default function MemberWaiverPrompt({ token, onContinue, onLogout }: Props) {
  const [waivers, setWaivers] = useState<PublicWaiverTemplate[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'load-error' | 'finishing' | 'finish-error'>('loading')
  const [checkedIds, setCheckedIds] = useState<number[]>([])
  const [agreeAll, setAgreeAll] = useState(false)
  const [signature, setSignature] = useState('')
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const apiUrl = getApiUrl()

  const finishInitialCheck = useCallback(async (signal?: AbortSignal) => {
    setStatus('finishing')
    setError(null)
    try {
      const response = await fetch(`${apiUrl}/api/members/waivers/initial-check/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal,
      })
      const result = await response.json()
      if (!response.ok || result.success !== true) throw new Error()
      if (!signal?.aborted) onContinue()
    } catch {
      if (signal?.aborted) return
      setError('Unable to finish waiver setup. Please try again.')
      setStatus('finish-error')
    }
  }, [apiUrl, onContinue, token])

  const loadWaivers = useCallback(async (signal?: AbortSignal) => {
    setStatus('loading')
    setError(null)
    try {
      const response = await fetch(`${apiUrl}/api/members/waivers`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      })
      const result = await response.json()
      if (!response.ok || result.success === false || !Array.isArray(result.data)) {
        throw new Error('Unable to check your waivers. Please try again.')
      }
      if (signal?.aborted) return
      const current = result.data as PublicWaiverTemplate[]
      if (current.some(waiver => waiver.is_required !== false && waiver.acceptance_id == null)) {
        setWaivers(current)
        setStatus('ready')
      } else {
        await finishInitialCheck(signal)
      }
    } catch {
      if (signal?.aborted) return
      setError('Unable to check your waivers. Please try again.')
      setStatus('load-error')
    }
  }, [apiUrl, finishInitialCheck, token])

  useEffect(() => {
    const controller = new AbortController()
    void loadWaivers(controller.signal)
    return () => controller.abort()
  }, [loadWaivers])

  useEffect(() => {
    if (status === 'ready' || status === 'load-error' || status === 'finish-error') headingRef.current?.focus()
  }, [status])

  const submit = async () => {
    const validationError = validateWaiverSigning({
      waivers,
      checkedTemplateIds: checkedIds,
      agreeAll,
      signatureName: signature,
    })
    if (validationError) {
      setError(validationError)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const selected = waivers.filter(waiver => waiver.acceptance_id == null && checkedIds.includes(waiver.id))
      const response = await fetch(`${apiUrl}/api/members/waivers/accept-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureName: signature.trim(),
          comments: comments.trim(),
          acceptedTemplateIds: selected.map(waiver => waiver.id),
          paymentPolicyAcknowledged: agreeAll && selected.some(waiver => waiver.waiver_type === 'PAYMENT_POLICY'),
        }),
      })
      const result = await response.json()
      if (!response.ok || result.success === false) throw new Error(result.message || 'Unable to save your waivers. Please try again.')
      setCheckedIds([])
      setAgreeAll(false)
      setSignature('')
      setComments('')
      // Confirm the current required set is complete before continuing.
      await loadWaivers()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save your waivers. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="fixed inset-0 overflow-y-auto bg-gray-100 px-4 py-8 md:py-12" aria-labelledby="login-waivers-title">
      <div className="portal-panel mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-lg md:p-8">
        <FileText className="mb-4 h-9 w-9 text-vortex-red" aria-hidden="true" />
        <h1 ref={headingRef} id="login-waivers-title" tabIndex={-1} className="text-2xl font-bold text-gray-950 outline-none md:text-3xl">
          {status === 'ready' ? 'Please complete your waivers'
            : status === 'load-error' ? 'Unable to check your waivers'
              : status === 'finish-error' ? 'Unable to finish waiver setup' : 'Checking your waivers'}
        </h1>
        {status === 'loading' || status === 'finishing' ? (
          <p role="status" className="mt-4 text-gray-600">Checking that your required waivers are up to date…</p>
        ) : (
          <>
            {status === 'ready' && (
              <p className="mb-6 mt-3 text-gray-600">You have required waivers that are missing or out of date. Review and sign them below to bring your account up to date.</p>
            )}
            {error && <p role="alert" className="my-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            {status === 'load-error' || status === 'finish-error' ? (
              <button type="button" disabled={submitting} onClick={() => {
                if (status === 'load-error') void loadWaivers()
                else void finishInitialCheck()
              }} className="rounded-lg bg-vortex-red px-5 py-3 font-semibold text-white">Try again</button>
            ) : (
              <form onSubmit={event => { event.preventDefault(); if (!submitting) void submit() }}>
                <fieldset disabled={submitting} className="min-w-0 space-y-5">
                  <WaiverSigningBlock
                    waivers={waivers}
                    checkedTemplateIds={checkedIds}
                    onToggleTemplate={(id, checked) => setCheckedIds(previous => checked ? [...previous, id] : previous.filter(value => value !== id))}
                    agreeAll={agreeAll}
                    onAgreeAllChange={setAgreeAll}
                    signatureName={signature}
                    onSignatureNameChange={setSignature}
                    comments={comments}
                    onCommentsChange={setComments}
                  />
                  <button type="submit" className="w-full rounded-lg bg-vortex-red px-5 py-3 font-semibold text-white disabled:opacity-60 sm:w-auto">
                    {submitting ? 'Saving waivers…' : 'Sign waivers and continue'}
                  </button>
                </fieldset>
              </form>
            )}
            <div className="mt-6 flex flex-wrap gap-5 border-t border-gray-100 pt-4 text-sm">
              {status === 'ready' && (
                <button type="button" disabled={submitting} onClick={() => void finishInitialCheck()} className="font-semibold text-gray-600 underline disabled:opacity-60">Continue without signing</button>
              )}
              <button type="button" disabled={submitting} onClick={onLogout} className="font-semibold text-gray-600 underline disabled:opacity-60">Log out</button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
