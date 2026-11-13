import { useRef, useState } from 'react'
import { adminApiRequest } from '../../utils/api'
import { confirmArchive, confirmPermanentDelete } from '../../utils/confirmArchive'

type RecordAction = 'archive' | 'restore' | 'delete'
type AccountRecord = { id: number; name: string } & (
  { kind: 'member'; archived: boolean } | { kind: 'login' }
)

const actionClass = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50'

async function checkResponse(response: Response, fallback: string, requireArchiveApproval = false) {
  const data = await response.json().catch(() => null)
  if (response.ok && data?.success !== false && (!requireArchiveApproval || data?.canArchive === true)) return
  const blockers = Array.isArray(data?.blockers)
    ? data.blockers.flatMap((blocker: { message?: unknown } | null) => typeof blocker?.message === 'string' ? [blocker.message] : [])
    : []
  throw new Error(blockers.length ? blockers.join(' ') : data?.message || fallback)
}

export default function MemberRecordActions({ record, onChanged }: { record: AccountRecord; onChanged: (action: RecordAction) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const memberPath = `/api/admin/members/${record.id}`

  const update = async (action: RecordAction) => {
    if (inFlight.current) return
    inFlight.current = true
    setError(null)
    try {
      if (action === 'delete') {
        if (!await confirmPermanentDelete(record.name)) return
        setBusy(true)
        const path = record.kind === 'login' ? `/api/admin/access/users/${record.id}` : memberPath
        await checkResponse(await adminApiRequest(path, { method: 'DELETE' }), 'Unable to permanently delete this record.')
      } else {
        const archived = action === 'archive'
        if (archived ? !await confirmArchive(record.name) : !window.confirm(`Restore ${record.name} from the archive?`)) return
        setBusy(true)
        if (archived) {
          await checkResponse(await adminApiRequest(`${memberPath}/archive-check`), 'Unable to check whether this member can be archived.', true)
        }
        const response = await adminApiRequest(`${memberPath}/archive`, { method: 'PATCH', body: JSON.stringify({ archived }) })
        await checkResponse(response, archived ? 'Unable to archive this member.' : 'Unable to restore this member.')
      }
      onChanged(action)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update this record.')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return <div className="min-w-0">
    <div className="flex flex-wrap gap-1.5">
      {record.kind === 'member' && <button type="button" className={actionClass} disabled={busy}
        aria-label={`${record.archived ? 'Restore' : 'Archive'} ${record.name}`}
        onClick={() => void update(record.archived ? 'restore' : 'archive')}>{record.archived ? 'Restore' : 'Archive'}</button>}
      {(record.kind === 'login' || record.archived) && <button type="button" className={`${actionClass} text-red-700`} disabled={busy}
        aria-label={`Permanently delete ${record.name}`} onClick={() => void update('delete')}>Delete permanently</button>}
    </div>
    {error && <p role="alert" className="mt-2 max-w-80 whitespace-normal text-sm text-red-700">{error}</p>}
  </div>
}
