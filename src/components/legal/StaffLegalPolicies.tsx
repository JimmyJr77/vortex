import { useCallback, useEffect, useRef, useState } from 'react'
import { legalBase as base, legalRequest, downloadLegalDocument, type LegalPortal, type LegalDocument, type Packet } from '../../utils/staffLegalApi'

function PolicySignatureForm({ doc, portal, consentText, onSigned }: { doc: LegalDocument; portal: LegalPortal; consentText: string; onSigned: (packet: Packet) => void }) {
  const [name, setName] = useState(''), [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  return <article className="space-y-3 rounded-xl border border-slate-300 p-4">
    <h3 className="text-lg font-bold">{doc.title}</h3><p className="text-sm">Version {doc.version}</p>
    <details><summary className="cursor-pointer font-semibold underline">Read the complete document</summary><div className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap rounded border bg-slate-50 p-4 text-sm leading-6" tabIndex={0}>{doc.text}</div></details>
    <button type="button" className="font-semibold underline" onClick={() => { setError(''); void downloadLegalDocument(portal, doc).catch(e => setError(e.message)) }}>Download Word document</button>
    {doc.signature ? <p className="text-sm text-emerald-800">Signed by {doc.signature.signer_name} on {new Date(doc.signature.signed_at).toLocaleString()}.</p> : <form className="space-y-3" onSubmit={e => {
      e.preventDefault(); setBusy(true); setError('')
      void legalRequest<Packet>(portal, `${base(portal)}/${doc.id}/sign`, { method: 'POST', body: JSON.stringify({ name, consent, sha256: doc.sha256 }) })
        .then(onSigned).catch(e => setError(e.message)).finally(() => setBusy(false))
    }}><label className="block text-sm font-semibold">Your full name<input required minLength={2} maxLength={200} autoComplete="name" value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full rounded border border-slate-400 p-2" /></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" /><span>{consentText}</span></label>
      <button disabled={busy || !consent || name.trim().length < 2} className="rounded bg-slate-950 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Saving signature…' : 'Sign this document'}</button>
    </form>}
    {error ? <p role="alert" className="text-red-800">{error}</p> : null}
  </article>
}
export default function StaffLegalPolicies({ portal }: { portal: LegalPortal }) {
  const [packet, setPacket] = useState<Packet | null>(null), [error, setError] = useState(''), [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const load = useCallback(async () => {
    try { const p = await legalRequest<Packet>(portal, base(portal)); setPacket(p); setError(''); if (p.documents.some(d => !d.signature)) setOpen(true) }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to check required staff policies.') }
  }, [portal])
  useEffect(() => { void load() }, [load])
  useEffect(() => { if (open && dialog.current && !dialog.current.open) dialog.current.showModal(); else if (!open) dialog.current?.close() }, [open])
  const remaining = packet?.documents.filter(d => !d.signature).length ?? 0
  if (packet?.eligible === false || (portal === 'member' && !packet)) return null
  return <>
    <div className="fixed bottom-4 right-4 z-40 max-w-sm rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-950 shadow-lg" aria-live="polite">
      {error ? <><p role="alert">{error}</p><button className="font-bold underline" onClick={() => void load()}>Retry policy check</button></> : <><p>{remaining ? `${remaining} staff policies require your signature.` : 'Staff legal policies and your signatures'}</p><button className="font-bold underline" onClick={() => setOpen(true)} disabled={!packet}>Review policies</button></>}
    </div>
    <dialog ref={dialog} onCancel={() => setOpen(false)} onClose={() => setOpen(false)} aria-labelledby={`staff-legal-title-${portal}`} className="m-auto max-h-[90dvh] w-[min(95vw,56rem)] overflow-y-auto rounded-2xl p-5 text-slate-950 shadow-2xl backdrop:bg-black/50">
      <div className="mb-4 flex items-start justify-between gap-4"><div><h2 id={`staff-legal-title-${portal}`} className="text-xl font-bold">Required staff legal policies</h2><p className="mt-1 text-sm">Read each document and sign individually. Your signature is recorded to your account.</p></div><button type="button" onClick={() => setOpen(false)} className="rounded border px-3 py-2">Close</button></div>
      <div className="space-y-4">{packet?.documents.map(doc => <PolicySignatureForm key={`${doc.id}:${doc.sha256}`} doc={doc} portal={portal} consentText={packet.consentText} onSigned={setPacket} />)}</div>
      {packet && remaining === 0 ? <p role="status" className="mt-4 font-bold text-emerald-800">All three documents are signed. Thank you.</p> : null}
    </dialog>
  </>
}
