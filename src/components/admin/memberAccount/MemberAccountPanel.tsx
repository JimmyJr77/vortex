import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { adminApiRequest } from '../../../utils/api'
import MemberDetailsTab from './MemberDetailsTab'
import MemberAccountSecurityTab from './MemberAccountSecurityTab'
import MemberEnrollmentsTab from './MemberEnrollmentsTab'
import MemberStaffNotesTab from './MemberStaffNotesTab'
import MemberBillingTab from './MemberBillingTab'
import MemberMissedClassesTab from './MemberMissedClassesTab'
import type { MemberAccountTab, MemberDetailData, MemberFamilyData, MemberRole } from './types'

const TABS: Array<{ id: MemberAccountTab; label: string }> = [
  { id: 'details', label: 'Member Details' },
  { id: 'security', label: 'Account Security' },
  { id: 'enrollments', label: 'Enrollments' },
  { id: 'notes', label: 'Conversations & Comments' },
  { id: 'billing', label: 'Billing & Accounts' },
  { id: 'missed-classes', label: 'Missed Classes' },
]

interface Props {
  memberId: number
  memberName: string
  listRoles?: MemberRole[]
  initialTab?: MemberAccountTab
}

export default function MemberAccountPanel({
  memberId,
  memberName,
  listRoles = [],
  initialTab = 'details',
}: Props) {
  const [activeTab, setActiveTab] = useState<MemberAccountTab>(initialTab)
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
      if (!detail.roles?.length && listRoles.length > 0) {
        detail.roles = listRoles
      }
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
    setActiveTab(initialTab)
  }, [memberId, initialTab])

  return (
    <div className="border-t border-gray-200 bg-gray-50/80 px-4 py-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-gray-900">{memberName}</h3>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200 mb-4">
        {TABS.map((tab) => (
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
          {activeTab === 'details' && <MemberDetailsTab member={member} familyData={familyData} />}
          {activeTab === 'security' && <MemberAccountSecurityTab memberId={memberId} />}
          {activeTab === 'enrollments' && (
            <MemberEnrollmentsTab memberId={memberId} enrollments={member.enrollments ?? []} />
          )}
          {activeTab === 'notes' && <MemberStaffNotesTab memberId={memberId} />}
          {activeTab === 'billing' && (
            <MemberBillingTab memberId={memberId} familyId={member.familyId} />
          )}
          {activeTab === 'missed-classes' && <MemberMissedClassesTab memberId={memberId} />}
        </>
      ) : null}
    </div>
  )
}
