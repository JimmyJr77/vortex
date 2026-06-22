import { useState, useEffect, useCallback, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Archive, X, UserPlus, Eye, Edit2, Search, Users, Loader2, Trash2, DollarSign, ChevronDown } from 'lucide-react'
import { adminApiRequest } from '../utils/api'
import { isDefaultMasterEmail } from '../utils/defaultMasterAccount'
import MemberPricingModal from './admin/MemberPricingModal'
import MemberAccountPanel from './admin/memberAccount/MemberAccountPanel'
import type { MemberAccountTab } from './admin/memberAccount/types'
import FamilySignupWizard from './signup/FamilySignupWizard'
import { isAdult } from '../utils/dateUtils'
interface UnifiedMember {
  id: number
  firstName: string
  lastName: string
  email?: string | null
  phone?: string | null
  address?: string | null
  billingStreet?: string | null
  billingCity?: string | null
  billingState?: string | null
  billingZip?: string | null
  dateOfBirth?: string | null
  age?: number | null
  medicalNotes?: string | null
  internalFlags?: string | null
  status: string
  isActive: boolean
  familyIsActive?: boolean
  familyId?: number | null
  familyName?: string | null
  username?: string | null
  isFamilyPayer?: boolean
  roles: Array<{ id: string; role: string }>
  enrollments: Array<{
    id: number
    program_id: number
    program_display_name: string
    days_per_week: number
    selected_days: string[] | string
  }>
  hasCompletedWaivers?: boolean
  waiverCompletionDate?: string | null
  createdAt: string
  updatedAt: string
}

const memberIconBtn =
  'p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none'
const memberIconBtnDanger =
  'p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:pointer-events-none'
const memberThClass = 'py-3 pr-4 font-semibold whitespace-nowrap'
const memberTdClass = 'py-3 pr-4 align-middle'

function formatMemberRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    MEMBER_ATHLETE: 'Member / Athlete',
    MASTER_ADMIN: 'Master Admin',
    ADMIN: 'Admin',
    COACH: 'Coach',
    STAFF: 'Staff',
    // Legacy labels kept so historical data still renders nicely.
    PARENT_GUARDIAN: 'Parent/Guardian',
    ATHLETE: 'Athlete',
  }
  return labels[role] || role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function memberRolesDisplay(member: UnifiedMember): string {
  const roleLabels = member.roles?.map((r) => formatMemberRoleLabel(r.role)) || []
  return roleLabels.length > 0 ? roleLabels.join(', ') : '—'
}

type AccountViewFilter =
  | 'all'
  | 'master_admins'
  | 'admins'
  | 'coaches'
  | 'member_athletes_all'
  | 'member_athletes_parents'
  | 'member_athletes_youth'
  | 'member_athletes_adult'

const ACCOUNT_VIEW_FILTER_OPTIONS: Array<{ value: AccountViewFilter; label: string }> = [
  { value: 'all', label: 'View all' },
  { value: 'master_admins', label: 'View Master Admins' },
  { value: 'admins', label: 'View Admins' },
  { value: 'coaches', label: 'View Coaches' },
  { value: 'member_athletes_all', label: 'View Member / Athletes (All)' },
  { value: 'member_athletes_parents', label: 'View Member / Athletes (Parents / Guardians)' },
  { value: 'member_athletes_youth', label: 'View Member / Athletes (Youth Athletes)' },
  { value: 'member_athletes_adult', label: 'View Member / Athletes (Adult Athletes)' },
]

function memberHasRole(member: UnifiedMember, role: string): boolean {
  return member.roles?.some((r) => r.role === role) ?? false
}

/** Member-side accounts: MEMBER_ATHLETE login role or no staff portal roles. */
function isInMemberAthleteScope(member: UnifiedMember): boolean {
  if (memberHasRole(member, 'MEMBER_ATHLETE')) return true
  const hasStaffRole =
    memberHasRole(member, 'MASTER_ADMIN') ||
    memberHasRole(member, 'ADMIN') ||
    memberHasRole(member, 'COACH')
  return !hasStaffRole
}

function isYouthAthleteMember(member: UnifiedMember): boolean {
  return Boolean(member.dateOfBirth && !isAdult(member.dateOfBirth))
}

function memberDerivedAttributes(member: UnifiedMember): string[] {
  const attrs: string[] = []
  if (member.isFamilyPayer) attrs.push('Parent/Guardian')
  if (isYouthAthleteMember(member)) {
    attrs.push('Youth Athlete')
  } else if (isInMemberAthleteScope(member) && isAdult(member.dateOfBirth)) {
    attrs.push('Athlete (18+)')
  }
  return attrs
}

function memberDerivedAttributesDisplay(member: UnifiedMember): string {
  const attrs = memberDerivedAttributes(member)
  return attrs.length > 0 ? attrs.join(', ') : '—'
}

function matchesAccountViewFilter(member: UnifiedMember, filter: AccountViewFilter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'master_admins':
      return memberHasRole(member, 'MASTER_ADMIN')
    case 'admins':
      return memberHasRole(member, 'ADMIN') && !memberHasRole(member, 'MASTER_ADMIN')
    case 'coaches':
      return memberHasRole(member, 'COACH')
    case 'member_athletes_all':
      return isInMemberAthleteScope(member)
    case 'member_athletes_parents':
      return isInMemberAthleteScope(member) && Boolean(member.isFamilyPayer)
    case 'member_athletes_youth':
      return isInMemberAthleteScope(member) && isYouthAthleteMember(member)
    case 'member_athletes_adult':
      return isInMemberAthleteScope(member) && isAdult(member.dateOfBirth)
    default:
      return true
  }
}

interface AdminMembersProps {
  isMasterAdmin?: boolean
}

export default function AdminMembers({ isMasterAdmin = false }: AdminMembersProps) {
  // Unified members state
  const [members, setMembers] = useState<UnifiedMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [accountViewFilter, setAccountViewFilter] = useState<AccountViewFilter>('all')
  const [showArchivedMembers, setShowArchivedMembers] = useState(false)
  
  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState<{ id: number; name: string } | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [pricingMember, setPricingMember] = useState<UnifiedMember | null>(null)
  const [seedingDevMembers, setSeedingDevMembers] = useState(false)

  const [showFamilySignupWizard, setShowFamilySignupWizard] = useState(false)
  const [showAccountEditWizard, setShowAccountEditWizard] = useState(false)
  const [accountEditMemberId, setAccountEditMemberId] = useState<number | null>(null)
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null)
  const [expandedTab, setExpandedTab] = useState<MemberAccountTab>('details')
  
  // Fetch all members (unified endpoint)
  const fetchMembers = useCallback(async () => {
    try {
      setMembersLoading(true)
      const params = new URLSearchParams()
      if (memberSearchQuery) {
        params.append('search', memberSearchQuery)
      }
      if (showArchivedMembers) {
        params.append('showArchived', 'true')
      }
      const url = `/api/admin/members?${params.toString()}`
      console.log('[AdminMembers] Fetching members from:', url)
      const response = await adminApiRequest(url)
      console.log('[AdminMembers] Response status:', response.status, response.statusText)
      if (!response.ok) {
        setMembers([])
        const errorText = await response.text().catch(() => response.statusText)
        console.error('[AdminMembers] Error fetching members:', response.status, errorText)
        return
      }
      const data = await response.json()
      console.log('[AdminMembers] Response data:', { success: data.success, memberCount: data.data?.length || 0 })
      if (data.success) {
        setMembers(data.data || [])
        console.log('[AdminMembers] Set members:', data.data?.length || 0, 'members')
      } else {
        console.warn('[AdminMembers] Response success was false:', data)
        setMembers([])
      }
    } catch (error) {
      console.error('[AdminMembers] Exception fetching members:', error)
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }, [memberSearchQuery, showArchivedMembers])

  const seedDevTestMembers = useCallback(async () => {
    if (
      !confirm(
        'Load 15 dev-only test members? Existing dev test members will be replaced. Password for all: Vortex25!',
      )
    ) {
      return
    }
    setSeedingDevMembers(true)
    try {
      const response = await adminApiRequest('/api/admin/dev/seed-test-members', {
        method: 'POST',
        body: JSON.stringify({ replace: true }),
      })
      const data = await response.json()
      if (data.success) {
        alert(
          `Created ${data.data?.created ?? 0} dev test members.\n\nPassword for all accounts: Vortex25!\n\nThese members only appear in local/dev — not production.`,
        )
        await fetchMembers()
      } else {
        alert(data.message || 'Failed to seed dev test members')
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to seed dev test members')
    } finally {
      setSeedingDevMembers(false)
    }
  }, [fetchMembers])
  
  const handleArchiveMember = async (id: number, archived: boolean): Promise<boolean> => {
    if (!confirm(archived ? 'Are you sure you want to archive this member?' : 'Are you sure you want to unarchive this member?')) {
      return false
    }
    try {
      const response = await adminApiRequest(`/api/admin/members/${id}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({ archived })
      })
      if (response.ok) {
        await fetchMembers()
        return true
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to archive/unarchive member')
        return false
      }
    } catch (error) {
      console.error('Error archiving member:', error)
      alert('Failed to archive/unarchive member')
      return false
    }
  }
  
  // Delete member handler - opens confirmation dialog
  const handleDeleteMemberClick = (id: number, firstName: string, lastName: string) => {
    setMemberToDelete({ id, name: `${firstName} ${lastName}` })
    setDeleteConfirmText('')
    setDeleteConfirmOpen(true)
  }
  
  // Delete member handler - actually deletes after confirmation
  const handleDeleteMember = async () => {
    if (!memberToDelete) return
    
    // Check if user typed "delete" (case-insensitive)
    if (deleteConfirmText.toLowerCase().trim() !== 'delete') {
      alert('Please type "delete" to confirm deletion')
      return
    }
    
    try {
      const response = await adminApiRequest(`/api/admin/members/${memberToDelete.id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        const data = await response.json()
        setDeleteConfirmOpen(false)
        setMemberToDelete(null)
        setDeleteConfirmText('')
        await fetchMembers()
        alert(data.message || 'Member deleted successfully')
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to delete member')
      }
    } catch (error) {
      console.error('Error deleting member:', error)
      alert('Failed to delete member')
    }
  }
  
  const openAccountEditWizard = (memberId: number) => {
    setExpandedMemberId(null)
    setAccountEditMemberId(memberId)
    setShowAccountEditWizard(true)
  }

  const toggleExpandedMember = (memberId: number, tab: MemberAccountTab = 'details') => {
    if (expandedMemberId === memberId) {
      setExpandedMemberId(null)
      return
    }
    setExpandedMemberId(memberId)
    setExpandedTab(tab)
  }

  // Edit unified member handler
  const handleEditUnifiedMember = async (member: UnifiedMember) => {
    openAccountEditWizard(member.id)
  }
  
  // Effects
  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])
  
  
  // Render function - this is a very large component, so I'll include the main structure
  // Due to size limitations, I'll need to continue with the JSX in the next part
  
  return (
    <>
      <motion.div
        key="membership"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="space-y-6 min-w-0 max-w-full"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-7 h-7 text-vortex-red" />
              Vortex Accounts
              <span className="text-lg font-semibold text-gray-500">
                ({members.filter((m) =>
                  (showArchivedMembers ? !m.isActive : m.isActive) &&
                  matchesAccountViewFilter(m, accountViewFilter),
                ).length})
              </span>
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Search, view, and manage Vortex accounts and family records.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowArchivedMembers(!showArchivedMembers)}
              title={showArchivedMembers ? 'Show active members' : 'Show archived members'}
              aria-label={showArchivedMembers ? 'Show active members' : 'Show archived members'}
              className={`${memberIconBtn} ${showArchivedMembers ? 'bg-gray-200 text-gray-900' : ''}`}
            >
              <Archive className="w-5 h-5" />
            </button>
            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={() => void seedDevTestMembers()}
                disabled={seedingDevMembers}
                title="Load 15 dev test members (password: Vortex25!)"
                aria-label="Load dev test members"
                className={`${memberIconBtn} text-amber-800 hover:bg-amber-50 border border-amber-200`}
              >
                {seedingDevMembers ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="text-xs font-semibold px-1">Dev members</span>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFamilySignupWizard(true)}
              className="inline-flex items-center gap-2 bg-vortex-red text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700"
            >
              <UserPlus className="w-5 h-5" />
              New account
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative w-full max-w-xs shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              placeholder="Search accounts…"
              value={memberSearchQuery}
              onChange={(e) => setMemberSearchQuery(e.target.value)}
              className="w-full h-9 rounded-lg border border-gray-300 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={accountViewFilter}
            onChange={(e) => setAccountViewFilter(e.target.value as AccountViewFilter)}
            aria-label="Filter accounts by type"
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm bg-white min-w-[280px] max-w-full"
          >
            {ACCOUNT_VIEW_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {membersLoading ? (
          <div className="py-12 text-center text-gray-500 inline-flex items-center gap-2 w-full justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading Vortex accounts…
          </div>
        ) : (() => {
          const filteredMembers = members.filter(
            (m) =>
              (showArchivedMembers ? !m.isActive : m.isActive) &&
              matchesAccountViewFilter(m, accountViewFilter),
          )

          if (filteredMembers.length === 0) {
            return (
              <div className="py-12 text-center text-gray-500 border border-dashed rounded-xl">
                No {showArchivedMembers ? 'archived' : 'active'} accounts match this view.
              </div>
            )
          }

          return (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden min-w-0 max-w-full">
              <div className="overflow-x-auto overscroll-x-contain">
                <table className="text-sm border-collapse min-w-[1200px] w-full">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className={`${memberThClass} w-8`} aria-label="Expand" />
                    <th className={memberThClass}>Last name</th>
                    <th className={memberThClass}>First name</th>
                    <th className={memberThClass}>Roles</th>
                    <th className={memberThClass}>Derived attributes</th>
                    <th className={memberThClass}>Username</th>
                    <th className={memberThClass}>Email</th>
                    <th className={memberThClass}>Phone</th>
                    <th className={memberThClass}>Status</th>
                    <th className={memberThClass}>Family</th>
                    <th className={`${memberThClass} w-0`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => {
                    const isExpanded = expandedMemberId === member.id
                    return (
                      <Fragment key={member.id}>
                      <tr
                        onClick={() => toggleExpandedMember(member.id)}
                        className={`border-b border-gray-100 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-blue-50/60' : 'hover:bg-gray-50/80'
                        } ${!member.isActive ? 'bg-gray-50/50' : ''}`}
                      >
                        <td className={`${memberTdClass} w-8`}>
                          <ChevronDown
                            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </td>
                        <td className={`${memberTdClass} whitespace-nowrap`}>{member.lastName}</td>
                        <td className={`${memberTdClass} whitespace-nowrap`}>{member.firstName}</td>
                        <td className={`${memberTdClass} whitespace-nowrap`}>{memberRolesDisplay(member)}</td>
                        <td className={`${memberTdClass} whitespace-nowrap`}>{memberDerivedAttributesDisplay(member)}</td>
                        <td className={`${memberTdClass} whitespace-nowrap`}>{member.username || '—'}</td>
                        <td className={`${memberTdClass} whitespace-nowrap`}>{member.email || '—'}</td>
                        <td className={`${memberTdClass} whitespace-nowrap`}>{member.phone || '—'}</td>
                        <td className={memberTdClass}>
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              member.isActive
                                ? 'bg-green-50 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {member.isActive ? 'Active' : 'Archived'}
                          </span>
                        </td>
                        <td className={`${memberTdClass} whitespace-nowrap`}>
                          {member.familyName ? (
                            <span>
                              {member.familyName}
                              {member.familyId ? ` (#${member.familyId})` : ''}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className={`${memberTdClass} w-0 whitespace-nowrap`} onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              className={memberIconBtn}
                              title="View account details"
                              aria-label="View account details"
                              onClick={() => {
                                setExpandedMemberId(member.id)
                                setExpandedTab('details')
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className={`${memberIconBtn} text-emerald-700 hover:bg-emerald-50`}
                              title="Registrations & pricing"
                              aria-label="Registrations and pricing"
                              onClick={() => setPricingMember(member)}
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className={memberIconBtn}
                              title="Edit member"
                              aria-label="Edit member"
                              onClick={() => handleEditUnifiedMember(member)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {!isDefaultMasterEmail(member.email) && (
                            <button
                              type="button"
                              className={memberIconBtn}
                              title={member.isActive ? 'Archive member' : 'Unarchive member'}
                              aria-label={member.isActive ? 'Archive member' : 'Unarchive member'}
                              onClick={() => handleArchiveMember(member.id, member.isActive)}
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                            )}
                            {isMasterAdmin && !isDefaultMasterEmail(member.email) && (
                              <button
                                type="button"
                                className={memberIconBtnDanger}
                                title="Delete member permanently"
                                aria-label="Delete member permanently"
                                onClick={() =>
                                  handleDeleteMemberClick(
                                    member.id,
                                    member.firstName,
                                    member.lastName,
                                  )
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${member.id}-panel`} className="border-b border-gray-200">
                          <td colSpan={11} className="p-0">
                            <MemberAccountPanel
                              memberId={member.id}
                              memberName={`${member.firstName} ${member.lastName}`.trim()}
                              listRoles={member.roles}
                              initialTab={expandedTab}
                            />
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )
        })()}
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {deleteConfirmOpen && memberToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[200] p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            >
              <h2 className="text-2xl font-bold text-red-600 mb-4">
                Delete Member
              </h2>
              <p className="text-gray-700 mb-4">
                Are you sure you want to permanently delete <strong>{memberToDelete.name}</strong>? This action cannot be undone.
              </p>
              <p className="text-gray-600 mb-4 text-sm">
                To confirm deletion, please type <strong>"delete"</strong> in the box below:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type 'delete' to confirm"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteMember}
                  disabled={deleteConfirmText.toLowerCase().trim() !== 'delete'}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                    deleteConfirmText.toLowerCase().trim() === 'delete'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Delete Member
                </button>
                <button
                  onClick={() => {
                    setDeleteConfirmOpen(false)
                    setMemberToDelete(null)
                    setDeleteConfirmText('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {pricingMember && (
        <MemberPricingModal
          memberId={pricingMember.id}
          memberLabel={`${pricingMember.firstName} ${pricingMember.lastName}`.trim()}
          onClose={() => setPricingMember(null)}
        />
      )}
      {(showFamilySignupWizard || showAccountEditWizard) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="relative bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setShowFamilySignupWizard(false)
                setShowAccountEditWizard(false)
                setAccountEditMemberId(null)
              }}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 text-gray-500"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            {showAccountEditWizard && accountEditMemberId != null ? (
              <FamilySignupWizard
                mode="admin-edit"
                editMemberId={accountEditMemberId}
                onComplete={() => {
                  setShowAccountEditWizard(false)
                  setAccountEditMemberId(null)
                  void fetchMembers()
                }}
                onCancel={() => {
                  setShowAccountEditWizard(false)
                  setAccountEditMemberId(null)
                }}
              />
            ) : (
              <FamilySignupWizard
                mode="admin"
                onComplete={() => {
                  setShowFamilySignupWizard(false)
                  void fetchMembers()
                }}
                onCancel={() => setShowFamilySignupWizard(false)}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}


