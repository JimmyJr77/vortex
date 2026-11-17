import { useEffect, useRef, useState } from 'react'
import {
  cancelStripeTerminalPayment,
  getStripeTerminalAttempt,
  getStripeTerminalReaders,
  simulateStripeTerminalPayment,
  startStripeTerminalPayment,
  type StripeTerminalAttempt,
  type StripeTerminalTarget,
} from '../../utils/stripeTerminalApi'
import { button, Dialog, input, Loading, primary } from '../newAdmin/shared'

type Configuration = Awaited<ReturnType<typeof getStripeTerminalReaders>>

const formatAmount = (cents: number) => `$${(cents / 100).toFixed(2)}`

const statusText: Record<StripeTerminalAttempt['status'], string> = {
  awaiting_card: 'Ask the customer to tap, insert, or swipe their card on the reader.',
  processing: 'Waiting for Stripe to confirm the payment.',
  retryable: 'The reader could not complete the payment. You can try again.',
  succeeded: 'Payment confirmed.',
  canceled: 'The reader payment was canceled.',
}

export default function StripeTerminalDialog({
  kind,
  targetId,
  targetLabel,
  amountCents,
  newPaymentUnavailableReason,
  onRefreshQuote,
  onClose,
  onSucceeded,
}: {
  kind: StripeTerminalTarget
  targetId: number
  targetLabel: string
  amountCents: number
  newPaymentUnavailableReason?: string
  onRefreshQuote?: () => void
  onClose: () => void
  onSucceeded: (attempt: StripeTerminalAttempt) => void
}) {
  const [configuration, setConfiguration] = useState<Configuration | null>(null)
  const [attempt, setAttempt] = useState<StripeTerminalAttempt | null>(null)
  const [hasCheckedAttempt, setHasCheckedAttempt] = useState(false)
  const [selectedReader, setSelectedReader] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [loadVersion, setLoadVersion] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const actionInProgress = useRef(false)
  const reportedSuccess = useRef<StripeTerminalAttempt['id'] | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void Promise.allSettled([
      getStripeTerminalReaders(controller.signal),
      getStripeTerminalAttempt(kind, targetId, controller.signal),
    ]).then(([readers, current]) => {
      if (controller.signal.aborted) return
      if (readers.status === 'fulfilled') setConfiguration(readers.value)
      if (current.status === 'fulfilled') {
        setAttempt(current.value)
        setHasCheckedAttempt(true)
      }
      const failed = [current, readers].find((result) => result.status === 'rejected')
      setLoadError(failed?.reason instanceof Error ? failed.reason.message : failed ? 'Stripe Terminal could not be loaded.' : null)
      setLoading(false)
    })
    return () => controller.abort()
  }, [kind, targetId, loadVersion])

  const waiting = attempt?.status === 'awaiting_card' || attempt?.status === 'processing'

  useEffect(() => {
    if (!waiting || loading || working) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const update = async () => {
      try {
        const current = await getStripeTerminalAttempt(kind, targetId, controller.signal)
        if (controller.signal.aborted || actionInProgress.current) return
        if (!current) throw new Error('The reader status could not be verified. Checking again…')
        setAttempt(current)
        setPollError(null)
        if (current.status !== 'awaiting_card' && current.status !== 'processing') return
      } catch (caught) {
        if (controller.signal.aborted || actionInProgress.current) return
        setPollError(caught instanceof Error ? caught.message : 'Could not check the reader payment. Checking again…')
      }
      timer = setTimeout(() => void update(), 1500)
    }
    timer = setTimeout(() => void update(), 1500)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [kind, targetId, waiting, loading, working])

  useEffect(() => {
    if (attempt?.status !== 'succeeded' || reportedSuccess.current === attempt.id) return
    reportedSuccess.current = attempt.id
    onSucceeded(attempt)
  }, [attempt, onSucceeded])

  const readers = configuration?.readers ?? []
  const allowedReaders = readers.filter((reader) => reader.status === 'online')
  const readerId = allowedReaders.some((reader) => reader.id === selectedReader)
    ? selectedReader
    : (allowedReaders.length === 1 ? allowedReaders[0].id : '')
  const openAttempt = waiting || attempt?.status === 'retryable'
  const isNewAttempt = !openAttempt && !(kind === 'store' && attempt?.status === 'succeeded')
  const availableReader = allowedReaders.find((reader) => reader.id === (openAttempt ? attempt?.readerId : readerId))
  const attemptReader = readers.find((reader) => reader.id === attempt?.readerId)
  const expectedAmountCents = isNewAttempt ? amountCents : (attempt?.amountCents ?? amountCents)

  const refresh = () => {
    setLoading(true)
    setActionError(null)
    setPollError(null)
    setLoadVersion((version) => version + 1)
    onRefreshQuote?.()
  }

  const perform = async (action: () => Promise<StripeTerminalAttempt>) => {
    if (actionInProgress.current) return
    actionInProgress.current = true
    setWorking(true)
    setActionError(null)
    setPollError(null)
    try {
      setAttempt(await action())
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Stripe Terminal could not complete this action.')
    } finally {
      actionInProgress.current = false
      setWorking(false)
    }
  }

  const start = () => {
    if (loading || !hasCheckedAttempt || !availableReader || !configuration?.enabled) return
    if (expectedAmountCents < 50 || (isNewAttempt && newPaymentUnavailableReason)) return
    const previousAttemptId = isNewAttempt ? attempt?.id : undefined
    void perform(() => startStripeTerminalPayment(kind, targetId, availableReader.id, expectedAmountCents, previousAttemptId))
  }

  return (
    <Dialog title="Pay with Stripe card reader" onClose={() => { if (!actionInProgress.current) onClose() }}>
      <div className="mx-auto max-w-lg space-y-4 px-4 pb-3 text-sm text-gray-800">
        <p className="font-semibold">{targetLabel}</p>
        {configuration?.testMode ? <p className="rounded-lg bg-amber-50 p-3 text-amber-900">Stripe test mode. No funds will move.</p> : null}
        {loading ? <Loading label="Checking Stripe card readers…" /> : null}
        {attempt ? (
          <div role="status" className="space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="font-semibold">
              {attempt.amountCents == null ? 'Reader payment' : formatAmount(attempt.amountCents)}
              {attemptReader ? ` · ${attemptReader.label}` : ''}
            </p>
            <p>{attempt.message || statusText[attempt.status]}</p>
            {kind === 'store' && attempt.status === 'canceled' ? <p>To return stock, close this dialog and cancel the order.</p> : null}
          </div>
        ) : null}
        {loadError ? <p role="alert" className="text-red-700">{loadError}</p> : null}
        {actionError ? <p role="alert" className="text-red-700">{actionError}</p> : null}
        {pollError ? <p role="alert" className="text-red-700">{pollError}</p> : null}
        {!loading && openAttempt && attempt ? (
          <div className="flex flex-wrap gap-2">
            {attempt.status === 'retryable' ? <button type="button" className={primary} onClick={start} disabled={working || !availableReader || !configuration?.enabled || expectedAmountCents < 50}>Try {formatAmount(expectedAmountCents)} again</button> : null}
            <button type="button" className={button} disabled={working} onClick={() => void perform(() => cancelStripeTerminalPayment(kind, targetId, attempt.id))}>Cancel reader payment</button>
            {attempt.simulated && configuration?.testMode && attempt.status === 'awaiting_card' ? <>
              <button type="button" className={button} disabled={working} onClick={() => void perform(() => simulateStripeTerminalPayment(kind, targetId, attempt.id, 'approved'))}>Simulate payment</button>
              <button type="button" className={button} disabled={working} onClick={() => void perform(() => simulateStripeTerminalPayment(kind, targetId, attempt.id, 'declined'))}>Simulate decline</button>
            </> : null}
          </div>
        ) : null}
        {!loading && isNewAttempt && hasCheckedAttempt ? (
          !configuration?.enabled ? <p>Stripe Terminal is unavailable for this location.</p>
            : newPaymentUnavailableReason || amountCents <= 0 ? <p>{newPaymentUnavailableReason || 'There is no balance to collect.'}</p>
            : amountCents < 50 ? <p>Card reader payments start at $0.50.</p>
            : allowedReaders.length === 0 ? <p>No card readers are online. Check the reader and refresh.</p>
            : <>
                <label className="block font-semibold">
                  Card reader
                  <select className={input} value={readerId} disabled={working} onChange={(event) => setSelectedReader(event.target.value)}>
                    <option value="">Select a card reader</option>
                    {allowedReaders.map((reader) => <option key={reader.id} value={reader.id}>{reader.label}{reader.simulated ? ' (simulated)' : ''}</option>)}
                  </select>
                </label>
                <button type="button" className={primary} disabled={working || !availableReader} onClick={start}>Send {formatAmount(amountCents)} to reader</button>
              </>
        ) : null}
        {working ? <p role="status">Contacting Stripe…</p> : null}
        {!loading && (loadError || actionError || pollError || !waiting) ? <button type="button" className={button} disabled={working} onClick={refresh}>Refresh reader status</button> : null}
      </div>
    </Dialog>
  )
}
