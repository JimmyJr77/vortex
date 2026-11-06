import { useCallback, useEffect, useState } from 'react'
import { downloadLegalDocument, legalRequest, type LegalDocument, type LegalSignature } from '../../utils/staffLegalApi'
type Staff = { key: string; name: string; email: string | null; roles: string; documents: { id: string; signature: LegalSignature | null }[] }
type Report = { documents: Pick<LegalDocument, 'id' | 'title' | 'version' | 'sha256'>[]; staff: Staff[] }
const csvCell = (value: string) => `"${(/^[=+@\-\t\r]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`
export default function AdminStaffLegal() {
  const [report, setReport] = useState<Report | null>(null), [error, setError] = useState(''), [pendingOnly, setPendingOnly] = useState(false)
  const load = useCallback(async () => { try { setReport(await legalRequest<Report>('admin', '/api/admin/legal/signatures')); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load signature tracking.') } }, [])
  useEffect(() => { void load() }, [load])
  const staff = report?.staff.filter(s => !pendingOnly || s.documents.some(d => !d.signature)) ?? []
  return <section className="space-y-5 p-4 text-slate-950">
    <h1 className="text-2xl font-bold">Staff legal policies and signatures</h1><p>Required for all active coach and admin accounts and current payroll employees. Explicitly linked accounts share signature status.</p>
    {error ? <p role="alert" className="text-red-800">{error}</p> : null}
    <div className="flex flex-wrap gap-4"><button className="rounded border px-3 py-2 font-semibold" onClick={() => void load()}>Refresh tracking</button><label className="flex items-center gap-2"><input type="checkbox" checked={pendingOnly} onChange={e => setPendingOnly(e.target.checked)} />Show staff missing signatures</label>
      <button disabled={!report} className="rounded border px-3 py-2 font-semibold disabled:opacity-50" onClick={() => {
        if (!report) return
        const rows = [['Name', 'Email', 'Roles', 'Document', 'Version', 'Status', 'Signer', 'Signed at', 'Document SHA256'], ...staff.flatMap(s => report.documents.map(d => {
          const sig = s.documents.find(x => x.id === d.id)?.signature
          return [s.name, s.email || '', s.roles, d.title, d.version, sig ? 'SIGNED' : 'PENDING', sig?.signer_name || '', sig?.signed_at || '', d.sha256]
        }))]
        const url = URL.createObjectURL(new Blob([rows.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'vortex-staff-legal-signatures.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      }}>Export tracking CSV</button></div>
    <div className="grid gap-3 md:grid-cols-3">{report?.documents.map(d => <article key={d.id} className="rounded border bg-white p-4"><h2 className="font-bold">{d.title}</h2><p className="my-2 text-sm">Version {d.version}</p><button className="font-semibold underline" onClick={() => void downloadLegalDocument('admin', d).catch(e => setError(e.message))}>Download document</button></article>)}</div>
    {report ? <><p>{report.staff.filter(s => s.documents.every(d => d.signature)).length} of {report.staff.length} staff have signed all three documents.</p><div className="overflow-x-auto"><table className="w-full border-collapse bg-white text-left text-sm"><caption className="sr-only">Staff signature completion by document</caption><thead><tr><th className="border p-3" scope="col">Staff member</th>{report.documents.map(d => <th className="border p-3" scope="col" key={d.id}>{d.title}</th>)}</tr></thead><tbody>{staff.map(s => <tr key={s.key}><th scope="row" className="border p-3 font-normal"><p className="font-bold">{s.name}</p><p>{s.email}</p><p>{s.roles}</p></th>{report.documents.map(d => { const sig = s.documents.find(x => x.id === d.id)?.signature; return <td className="border p-3" key={d.id}>{sig ? <><p className="font-semibold text-emerald-800">Signed</p><p>{sig.signer_name}</p><time dateTime={sig.signed_at}>{new Date(sig.signed_at).toLocaleString()}</time></> : <span className="font-semibold text-amber-900">Pending signature</span>}</td> })}</tr>)}</tbody></table></div>{staff.length === 0 ? <p>No staff match this view.</p> : null}</> : <p role="status">Loading signature tracking…</p>}
  </section>
}
