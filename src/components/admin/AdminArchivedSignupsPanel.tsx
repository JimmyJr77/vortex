import { useState } from 'react'
import { ArchiveRestore } from 'lucide-react'
import {
  adminArchiveSignup,
  type SchedulingSignup,
} from '../../utils/schedulingApi'

interface Props {
  signups: SchedulingSignup[]
  onRefresh: () => void | Promise<void>
}

const iconActionClass =
  'p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none'

const AdminArchivedSignupsPanel = ({ signups, onRefresh }: Props) => {
  const [actionId, setActionId] = useState<number | null>(null)

  if (signups.length === 0) {
    return <p className="text-sm text-gray-600">No archived signups.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-600">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Email</th>
            <th className="py-2 pr-4">Category</th>
            <th className="py-2 pr-4">Slot</th>
            <th className="py-2 pr-4">Archived</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {signups.map((s) => (
            <tr key={s.id} className="border-b border-gray-100">
              <td className="py-3 pr-4">
                {s.firstName || String(s.responses.first_name || '')}{' '}
                {s.lastName || String(s.responses.last_name || '')}
              </td>
              <td className="py-3 pr-4">{s.email || String(s.responses.email || '')}</td>
              <td className="py-3 pr-4">{s.categoryName}</td>
              <td className="py-3 pr-4">{s.slotLabel || '—'}</td>
              <td className="py-3 pr-4 text-xs text-gray-600">
                {s.archivedAt ? new Date(s.archivedAt).toLocaleString() : '—'}
              </td>
              <td className="py-3">
                <button
                  type="button"
                  title="Unarchive signup"
                  disabled={actionId === s.id}
                  onClick={async () => {
                    setActionId(s.id)
                    try {
                      await adminArchiveSignup(s.id, false)
                      await onRefresh()
                    } catch (e) {
                      alert(e instanceof Error ? e.message : 'Failed to unarchive signup')
                    } finally {
                      setActionId(null)
                    }
                  }}
                  className={`${iconActionClass} text-blue-600 hover:text-blue-800`}
                  aria-label="Unarchive signup"
                >
                  <ArchiveRestore className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default AdminArchivedSignupsPanel
