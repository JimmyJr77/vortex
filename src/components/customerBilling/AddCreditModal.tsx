import { useEffect, useRef, useState, type FormEvent } from 'react'
import { adminApiRequest } from '../../utils/api'
import { money } from './format'

export default function AddCreditModal({ familyId, onClose, onSaved }: {
  familyId: number
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement
    dialogRef.current?.showModal()
    return () => { if (previous instanceof HTMLElement) previous.focus() }
  }, [])
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [requestKey] = useState(() => crypto.randomUUID())
  const amountCents = Math.round(Number(amount) * 100)
  const valid = /^\d+(\.\d{1,2})?$/.test(amount) && amountCents > 0 && amountCents <= 2147483647 && reason.trim().length > 0
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid || working) return
    setWorking(true)
    setError('')
    try {
      const response = await adminApiRequest(`/api/admin/customer-billing/families/${familyId}/credits`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey },
        body: JSON.stringify({ amountCents, reason: reason.trim() }),
      })
      const body = await response.json()
      if (!response.ok || !body.success) throw new Error(body.message || 'Credit could not be added.')
      onSaved(`${money(amountCents)} credit added. It will reduce the next payment.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Credit could not be added.')
    } finally { setWorking(false) }
  }
  return <dialog ref={dialogRef} onCancel={event => { event.preventDefault(); if (!working) onClose() }} aria-labelledby="add-credit-title" className="m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-2xl bg-white p-6 shadow-2xl backdrop:bg-black/60">
      <div className="flex items-center justify-between"><h2 id="add-credit-title" className="text-xl font-bold">Add credit</h2><button type="button" aria-label="Close add credit" disabled={working} onClick={onClose} className="rounded p-2 disabled:opacity-40">×</button></div>
      <p className="mt-2 text-sm text-gray-600">This household credit appears in Future credits and Account History and reduces the next payment. Your logged-in staff account is recorded automatically.</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block text-sm font-semibold">Credit amount ($)<input autoFocus required type="number" min="0.01" max="21474836.47" step="0.01" value={amount} disabled={working} onChange={event => setAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="0.00" /></label>
        <label className="block text-sm font-semibold">Reason (required)<textarea required maxLength={2000} rows={3} value={reason} disabled={working} onChange={event => setReason(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <button type="submit" disabled={!valid || working} className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-40">{working ? 'Adding credit…' : 'Add credit'}</button>
      </form>
  </dialog>
}
