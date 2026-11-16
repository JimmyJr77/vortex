import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { adminApiRequest, hasAdminSession } from '../../utils/api'

type ProgramOrder = { id: number; displayName: string; classes: { id: number; displayName: string }[] }
const endpoint = '/api/admin/new-admin/enroll-order'
const button = 'inline-flex items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-40'

function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const result = [...items]
  ;[result[index], result[target]] = [result[target], result[index]]
  return result
}

export default function EnrollmentOrderEditor({ onSaved }: { onSaved: () => Promise<void> }) {
  const [canManage, setCanManage] = useState(false)
  const [draft, setDraft] = useState<ProgramOrder[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const inFlight = useRef(false)

  useEffect(() => {
    if (!hasAdminSession()) return
    let active = true
    void adminApiRequest('/api/admin/access/me').then(async response => {
      if (!response.ok) return
      const body = await response.json()
      const access = body?.data
      if (active) setCanManage(access?.isMasterAdmin === true || access?.permissions?.includes('classes.manage') === true)
    }).catch(() => {})
    return () => { active = false }
  }, [])

  const edit = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true); setError(null); setNotice(null)
    try {
      const response = await adminApiRequest(endpoint)
      const body = await response.json()
      if (!response.ok || body?.success === false) throw new Error(body?.message || 'Unable to load enrollment order.')
      setDraft(body.data.programs)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load enrollment order.') }
    finally { setBusy(false); inFlight.current = false }
  }

  const save = async () => {
    if (!draft || inFlight.current) return
    inFlight.current = true
    setBusy(true); setError(null); setNotice(null)
    try {
      const response = await adminApiRequest(endpoint, { method: 'PUT', body: JSON.stringify({
        programs: draft.map(program => ({ id: program.id, classIds: program.classes.map(klass => klass.id) })),
      }) })
      const body = await response.json()
      if (!response.ok || body?.success === false) throw new Error(body?.message || 'Unable to save enrollment order.')
      setDraft(null)
      setNotice('Enrollment order saved for everyone.')
      try { await onSaved() }
      catch { setError('The order was saved, but this page could not refresh. Reload the page to see the saved order.') }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save enrollment order.') }
    finally { setBusy(false); inFlight.current = false }
  }

  if (!canManage) return null
  return <section aria-label="Enrollment display order" className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold text-gray-900">Enrollment display order</h2><p className="text-sm text-gray-600">Arrange the main sections and their classes. Saving updates the order for all visitors.</p></div>
      {!draft && <button type="button" className={button} disabled={busy} onClick={() => void edit()}>{busy ? 'Loading…' : 'Edit order'}</button>}
    </div>
    {notice && <p role="status" className="text-sm font-medium text-green-800">{notice}</p>}
    {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
    {draft && <>
      <p className="text-sm text-gray-600">All available sections are shown here, regardless of the browsing filters below.</p>
      <ol className="space-y-3">
        {draft.map((program, programIndex) => <li key={program.id} className="rounded-lg border border-blue-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{program.displayName}</h3>
            <div className="flex gap-2">
              <button type="button" className={button} aria-label={`Move section ${program.displayName} up`} disabled={busy || programIndex === 0} onClick={() => setDraft(current => current && move(current, programIndex, -1))}><ArrowUp aria-hidden="true" className="h-4 w-4" />Up</button>
              <button type="button" className={button} aria-label={`Move section ${program.displayName} down`} disabled={busy || programIndex === draft.length - 1} onClick={() => setDraft(current => current && move(current, programIndex, 1))}><ArrowDown aria-hidden="true" className="h-4 w-4" />Down</button>
            </div>
          </div>
          <ol className="mt-2 divide-y divide-gray-100">
            {program.classes.map((klass, classIndex) => <li key={klass.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>{klass.displayName}</span>
              <div className="flex gap-2">
                <button type="button" className={button} aria-label={`Move ${klass.displayName} up in ${program.displayName}`} disabled={busy || classIndex === 0} onClick={() => setDraft(current => current && current.map(item => item.id === program.id ? { ...item, classes: move(item.classes, classIndex, -1) } : item))}><ArrowUp aria-hidden="true" className="h-4 w-4" />Up</button>
                <button type="button" className={button} aria-label={`Move ${klass.displayName} down in ${program.displayName}`} disabled={busy || classIndex === program.classes.length - 1} onClick={() => setDraft(current => current && current.map(item => item.id === program.id ? { ...item, classes: move(item.classes, classIndex, 1) } : item))}><ArrowDown aria-hidden="true" className="h-4 w-4" />Down</button>
              </div>
            </li>)}
          </ol>
        </li>)}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${button} !border-vortex-red !bg-vortex-red !text-white`} disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save order'}</button>
        <button type="button" className={button} disabled={busy} onClick={() => { setDraft(null); setError(null) }}>Cancel</button>
        {error && <button type="button" className={button} disabled={busy} onClick={() => void edit()}>Reload saved order</button>}
      </div>
    </>}
  </section>
}
