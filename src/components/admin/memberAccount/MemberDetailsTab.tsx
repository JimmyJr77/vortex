import { formatDateForDisplay, formatTimestampDate, formatTimeSince, getMostRecentEnrollmentDate } from '../../../utils/dateUtils'
import type { MemberDetailData, MemberFamilyData } from './types'

function formatMemberRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    MEMBER_ATHLETE: 'Member / Athlete',
    MASTER_ADMIN: 'Master Admin',
    ADMIN: 'Admin',
    COACH: 'Coach',
    STAFF: 'Staff',
    PARENT_GUARDIAN: 'Parent/Guardian',
    ATHLETE: 'Athlete',
  }
  return labels[role] || role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatAddress(member: MemberDetailData): string {
  if (member.address?.trim()) return member.address.trim()
  const parts = [member.billingStreet, member.billingCity, member.billingState, member.billingZip]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
  return parts.length ? parts.join(', ') : 'N/A'
}

interface Props {
  member: MemberDetailData
  familyData: MemberFamilyData | null
}

export default function MemberDetailsTab({ member, familyData }: Props) {
  return (
    <div className="space-y-5">
      {member.familyId && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Family information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600">Family name</span>
              <div className="text-gray-900">{member.familyName || 'N/A'}</div>
            </div>
            <div>
              <span className="text-gray-600">Family username</span>
              <div className="text-gray-900">{member.familyUsername || familyData?.familyUsername || 'N/A'}</div>
            </div>
            <div>
              <span className="text-gray-600">Family ID</span>
              <div className="text-gray-900">{member.familyId}</div>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Contact &amp; profile</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-600">First name</span><div className="text-gray-900">{member.firstName}</div></div>
          <div><span className="text-gray-600">Last name</span><div className="text-gray-900">{member.lastName}</div></div>
          <div><span className="text-gray-600">Email</span><div className="text-gray-900">{member.email || 'N/A'}</div></div>
          <div><span className="text-gray-600">Phone</span><div className="text-gray-900">{member.phone || 'N/A'}</div></div>
          <div><span className="text-gray-600">Username</span><div className="text-gray-900">{member.username || 'N/A'}</div></div>
          <div>
            <span className="text-gray-600">Date of birth</span>
            <div className="text-gray-900">
              {member.dateOfBirth ? formatDateForDisplay(member.dateOfBirth) : 'N/A'}
            </div>
          </div>
          {member.age != null && (
            <div><span className="text-gray-600">Age</span><div className="text-gray-900">{member.age}</div></div>
          )}
          <div className="md:col-span-2">
            <span className="text-gray-600">Address</span>
            <div className="text-gray-900">{formatAddress(member)}</div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Status &amp; roles</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-600">Account status</span>
            <div className="mt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${member.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {member.isActive ? 'Active' : 'Archived'}
              </span>
            </div>
          </div>
          <div>
            <span className="text-gray-600">Enrollment status</span>
            <div className="mt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                member.status === 'athlete' || member.status === 'enrolled'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {member.status || 'Non-participant'}
              </span>
            </div>
          </div>
          <div className="md:col-span-2">
            <span className="text-gray-600">Roles</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {member.roles && member.roles.length > 0 ? (
                member.roles.map((role) => (
                  <span key={role.id} className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700">
                    {formatMemberRoleLabel(role.role)}
                  </span>
                ))
              ) : (
                <span className="text-gray-500">No roles assigned</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {member.parentGuardians && member.parentGuardians.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Parent / guardians</h4>
          <div className="space-y-2">
            {member.parentGuardians.map((g) => (
              <div key={g.id} className="text-sm border border-gray-100 rounded-lg p-3">
                <div className="font-medium text-gray-900">{g.firstName} {g.lastName}</div>
                <div className="text-gray-600">{[g.email, g.phone, g.username].filter(Boolean).join(' · ') || '—'}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {member.children && member.children.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Linked children</h4>
          <div className="space-y-2">
            {member.children.map((c) => (
              <div key={c.id} className="text-sm border border-gray-100 rounded-lg p-3">
                <div className="font-medium text-gray-900">{c.firstName} {c.lastName}</div>
                <div className="text-gray-600">
                  {[c.email, c.phone, c.dateOfBirth ? formatDateForDisplay(c.dateOfBirth) : null].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {familyData?.members && familyData.members.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Family members ({familyData.members.length})
          </h4>
          <div className="space-y-2">
            {familyData.members.map((fm) => (
              <div
                key={fm.id}
                className={`text-sm border rounded-lg p-3 ${fm.id === member.id ? 'border-blue-300 bg-blue-50/40' : 'border-gray-100'}`}
              >
                {fm.id === member.id && (
                  <div className="text-xs text-blue-700 font-semibold mb-1">This account</div>
                )}
                <div className="font-medium text-gray-900">{fm.firstName} {fm.lastName}</div>
                <div className="text-gray-600 text-xs mt-0.5">
                  {[fm.email, fm.phone, fm.isFamilyPayer ? 'Family payer' : null, fm.isActive === false ? 'Archived' : null]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {member.emergencyContacts && member.emergencyContacts.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Emergency contacts</h4>
          <div className="space-y-2">
            {member.emergencyContacts.map((c, idx) => (
              <div key={c.id ?? idx} className="text-sm border border-gray-100 rounded-lg p-3">
                <div className="font-medium text-gray-900">{c.name || 'Contact'}</div>
                <div className="text-gray-600">
                  {[c.relationship, c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(member.medicalNotes || member.internalFlags) && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Additional information</h4>
          {member.medicalNotes && (
            <div className="text-sm mb-2">
              <span className="text-gray-600">Medical notes</span>
              <div className="text-gray-900 whitespace-pre-wrap">{member.medicalNotes}</div>
            </div>
          )}
          {member.internalFlags && (
            <div className="text-sm">
              <span className="text-gray-600">Internal flags</span>
              <div className="text-gray-900 whitespace-pre-wrap">{member.internalFlags}</div>
            </div>
          )}
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Waivers</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-600">Completed</span>
            <div className="mt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                member.hasCompletedWaivers ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {member.hasCompletedWaivers ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
          {member.waiverCompletionDate && (
            <div>
              <span className="text-gray-600">Completion date</span>
              <div className="text-gray-900">{formatTimestampDate(member.waiverCompletionDate)}</div>
            </div>
          )}
        </div>
      </section>

      {member.enrollments && member.enrollments.length > 0 && (
        <p className="text-xs text-gray-500">
          Last enrollment: {formatTimeSince(
            getMostRecentEnrollmentDate(
              member.enrollments.map((e) => ({ created_at: e.created_at, createdAt: e.createdAt })),
            ),
          )}
        </p>
      )}

      {(member.createdAt || member.updatedAt) && (
        <p className="text-xs text-gray-400">
          {member.createdAt && <>Created {formatTimestampDate(member.createdAt)}</>}
          {member.createdAt && member.updatedAt && ' · '}
          {member.updatedAt && <>Updated {formatTimestampDate(member.updatedAt)}</>}
        </p>
      )}
    </div>
  )
}
