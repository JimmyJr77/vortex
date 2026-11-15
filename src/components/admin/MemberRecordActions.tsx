import { useRef, useState } from 'react'
import { adminApiRequest } from '../../utils/api'
import { button } from '../newAdmin/shared'
import { confirmArchive, confirmPermanentDelete } from '../../utils/confirmArchive'

type RecordAction = 'archive' | 'restore' | 'delete'
type AccountRecord = { id: number; name: string } & (
  { kind: 'member' | 'lead' | 'family'; archived: boolean } | { kind: 'login' }
)

const actionClass = button

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
  const memberPath = record.kind === 'family' ? `/api/admin/families/${record.id}` : record.kind === 'lead' ? `/api/admin/new-admin/leads/${record.id}` : `/api/admin/members/${record.id}`

  const update = async (action: RecordAction) => {
    if (inFlight.current) return
    inFlight.current = true
    setError(null)
    try {
      if (action === 'delete') {
        const warning = record.kind === 'family'
          ? 'This permanently deletes the original family account, its members, unused logins, and unfinished signup records. It cannot be undone. Accounts with payments or class, attendance, or coaching history are protected. Restore the family to keep using it.'
          : record.kind === 'member'
            ? 'This permanently deletes the original member account, not an archived copy. It cannot be undone. Accounts with payments or class, attendance, or coaching history are protected. Restore this member to keep using the account.'
            : record.kind === 'lead'
              ? 'This permanently deletes only the lead inquiry and its invitations. A linked member account, its enrollments, and its history will remain. This cannot be undone.'
              : undefined
        if (!await confirmPermanentDelete(record.name, warning)) return
        setBusy(true)
        const path = record.kind === 'login' ? `/api/admin/access/users/${record.id}` : record.kind === 'lead' ? `${memberPath}/permanent` : memberPath
        await checkResponse(await adminApiRequest(path, { method: 'DELETE' }), 'Unable to permanently delete this record.')
      } else {
        const archived = action === 'archive'
        if (archived ? !await confirmArchive(record.name, record.kind === 'family' ? 'This archives the family and all current people in it. Their member portal access will be affected.' : undefined) : !window.confirm(record.kind === 'family' ? `Restore ${record.name} and all current people in this family?` : `Restore ${record.name} from the archive?`)) return
        setBusy(true)
        if (archived && record.kind === 'member') {
          await checkResponse(await adminApiRequest(`${memberPath}/archive-check`), 'Unable to check whether this member can be archived.', true)
        }
        const response = await adminApiRequest(`${memberPath}/archive`, { method: 'PATCH', body: JSON.stringify({ archived }) })
        await checkResponse(response, archived ? 'Unable to archive this record.' : 'Unable to restore this record.')
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
      {record.kind !== 'login' && <button type="button" className={actionClass} disabled={busy}
        aria-label={`${record.archived ? 'Restore' : 'Archive'} ${record.name}`}
        onClick={() => void update(record.archived ? 'restore' : 'archive')}>{record.archived ? 'Restore' : 'Archive'}</button>}
      {(record.kind === 'login' || record.archived) && <button type="button" className={`${actionClass} !text-red-700`} disabled={busy}
        aria-label={`Permanently delete ${record.name}`} onClick={() => void update('delete')}>Delete permanently</button>}
    </div>
    {error && <p role="alert" className="mt-2 max-w-80 whitespace-normal text-sm text-red-700">{error}</p>}
  </div>
}
