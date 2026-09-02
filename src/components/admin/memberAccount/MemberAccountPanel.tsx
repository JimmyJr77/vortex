import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { adminApiRequest } from '../../../utils/api'
import MemberDetailsTab from './MemberDetailsTab'
import MemberAccountSecurityTab from './MemberAccountSecurityTab'
import MemberStaffNotesTab from './MemberStaffNotesTab'
import MemberMissedClassesTab from './MemberMissedClassesTab'
import type {
  MemberAccountTab,
  MemberDetailData,
  MemberDirectorySummary,
  MemberFamilyData,
} from './types'

const TABS: Array<{ id: MemberAccountTab; label: string }> = [
  { id: 'details', label: 'Member Details' },
  { id: 'security', label: 'Account Security' },
  { id: 'notes', label: 'Conversations & Comments' },
  { id: 'missed-classes', label: 'Missed Classes' },
]

interface Props {
  memberId: number
  memberName: string
  directorySummary: MemberDirectorySummary
  initialTab?: MemberAccountTab
  onAccountChanged?: () => void | Promise<void>
  canManageSecurity?: boolean
  canManageNotes?: boolean
  canManageMissedClasses?: boolean
}

export default function MemberAccountPanel({
  memberId,
  memberName,
  directorySummary,
  initialTab = 'details',
  onAccountChanged,
  canManageSecurity = false,
  canManageNotes = false,
  canManageMissedClasses = false,
}: Props) {
  const availableTabs = useMemo(() => TABS.filter((tab) => (
    tab.id === 'details'
    || (tab.id === 'security' && canManageSecurity)
    || (tab.id === 'notes' && canManageNotes)
    || (tab.id === 'missed-classes' && canManageMissedClasses)
  )), [canManageMissedClasses, canManageNotes, canManageSecurity])
  const [activeTab, setActiveTab] = useState<MemberAccountTab>(
    availableTabs.some((tab) => tab.id === initialTab) ? initialTab : 'details',
  )
  const [member, setMember] = useState<MemberDetailData | null>(null)
  const [familyData, setFamilyData] = useState<MemberFamilyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const memberRes = await adminApiRequest(`/api/admin/members/${memberId}`)
      if (!memberRes.ok) throw new Error(`Failed to load member (${memberRes.status})`)
      const memberJson = await memberRes.json()
      const detail: MemberDetailData = memberJson.data ?? memberJson
      setMember(detail)

      if (detail.familyId) {
        const familyRes = await adminApiRequest(`/api/admin/families/${detail.familyId}`)
        if (familyRes.ok) {
          const familyJson = await familyRes.json()
          setFamilyData(familyJson.data ?? null)
        } else {
          setFamilyData(null)
        }
      } else {
        setFamilyData(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load account')
      setMember(null)
      setFamilyData(null)
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setActiveTab(availableTabs.some((tab) => tab.id === initialTab) ? initialTab : 'details')
  }, [availableTabs, memberId, initialTab])

  return (
    <div className="border-t border-gray-200 bg-gray-50/80 px-4 py-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-gray-900">{memberName}</h3>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200 mb-4">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-vortex-red text-vortex-red bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-white/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-8">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading account…
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>
      ) : member ? (
        <>
          {activeTab === 'details' && (
            <MemberDetailsTab member={member} familyData={familyData} directorySummary={directorySummary} />
          )}
          {activeTab === 'security' && canManageSecurity && (
            <MemberAccountSecurityTab memberId={memberId} onAccessChange={onAccountChanged} />
          )}
          {activeTab === 'notes' && canManageNotes && <MemberStaffNotesTab memberId={memberId} />}
          {activeTab === 'missed-classes' && canManageMissedClasses && <MemberMissedClassesTab memberId={memberId} />}
        </>
      ) : null}
    </div>
  )
}
