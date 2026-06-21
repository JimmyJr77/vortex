import { useCallback, useEffect, useState } from 'react'
import { Loader2, Users } from 'lucide-react'
import { coachFetch } from '../../coach/api'
import { useCoachClasses, type RosterMember } from './useCoachClasses'

export default function RosterPanel() {
  const classes = useCoachClasses()
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [roster, setRoster] = useState<RosterMember[]>([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<number | null>(null)

  useEffect(() => {
    if (selectedClassId == null && classes.length > 0) setSelectedClassId(classes[0].id)
  }, [classes, selectedClassId])

  const loadRoster = useCallback(async () => {
    if (selectedClassId == null) return
    setLoading(true)
    try {
      const data = await coachFetch<RosterMember[]>(`/api/coach/classes/${selectedClassId}/roster`)
      setRoster(data)
    } catch {
      setRoster([])
    } finally {
      setLoading(false)
    }
  }, [selectedClassId])

  useEffect(() => {
    void loadRoster()
  }, [loadRoster])

  const saveNote = async (member: RosterMember, updates: Partial<RosterMember>) => {
    if (selectedClassId == null) return
    setSavingId(member.id)
    try {
      await coachFetch(`/api/coach/classes/${selectedClassId}/roster/${member.id}/note`, {
        method: 'PUT',
        body: JSON.stringify({
          attendanceStatus: updates.attendance_status ?? member.attendance_status ?? null,
          note: updates.note ?? member.note ?? null,
        }),
      })
      setRoster((cur) => cur.map((m) => (m.id === member.id ? { ...m, ...updates } : m)))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Roster</h2>
        <p className="text-sm text-gray-500">Attendance, notes, and waiver status by class.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden h-fit">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold">Assigned Classes</div>
          <div className="divide-y divide-gray-100">
            {classes.map((c) => (
              <button key={c.id} type="button" onClick={() => setSelectedClassId(c.id)} className={`w-full px-4 py-3 text-left hover:bg-gray-50 ${selectedClassId === c.id ? 'bg-red-50' : ''}`}>
                <div className="font-semibold text-gray-900">{c.assignment_label || c.class_name || c.program_name || 'Class'}</div>
                {c.class_name && c.program_name && (
                  <div className="text-xs text-gray-500">{c.program_name}</div>
                )}
                {!c.class_name && c.program_name && (
                  <div className="text-xs text-gray-500">All classes in program</div>
                )}
              </button>
            ))}
            {classes.length === 0 && <div className="p-4 text-sm text-gray-500">No assigned classes yet.</div>}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 font-semibold"><Users className="w-4 h-4" /> Members</div>
          {loading ? (
            <div className="p-4 flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading roster...</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {roster.map((m) => (
                <div key={m.id} className="p-4 grid gap-3 lg:grid-cols-[1fr_150px_1fr_auto] lg:items-center">
                  <div>
                    <div className="font-semibold text-gray-900">{m.first_name} {m.last_name}</div>
                    <div className="text-xs text-gray-500">{[m.email, m.phone].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold text-center ${m.has_completed_waivers ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {m.has_completed_waivers ? 'Waivers complete' : `Waivers ${m.accepted_count ?? 0}/${m.required_count ?? 0}`}
                  </span>
                  <select value={m.attendance_status || ''} onChange={(e) => void saveNote(m, { attendance_status: e.target.value || null })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">Attendance</option>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="excused">Excused</option>
                  </select>
                  <div className="flex gap-2">
                    <input type="text" value={m.note || ''} onChange={(e) => setRoster((cur) => cur.map((x) => x.id === m.id ? { ...x, note: e.target.value } : x))} placeholder="Coach note" className="min-w-0 flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    <button type="button" onClick={() => void saveNote(m, { note: m.note || null })} disabled={savingId === m.id} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-60">Save</button>
                  </div>
                </div>
              ))}
              {roster.length === 0 && <div className="p-4 text-sm text-gray-500">No roster members found.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
