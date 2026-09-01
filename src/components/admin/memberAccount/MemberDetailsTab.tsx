import type { ReactNode } from 'react'
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

function DetailItem({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex min-w-0 items-baseline gap-2 text-sm ${className}`}>
      <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      <span className="min-w-0 break-words text-gray-900">{children}</span>
    </div>
  )
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
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <DetailItem label="Family name">{member.familyName || 'N/A'}</DetailItem>
            <DetailItem label="Family username">{member.familyUsername || familyData?.familyUsername || 'N/A'}</DetailItem>
            <DetailItem label="Family ID">{member.familyId}</DetailItem>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Contact &amp; profile</h4>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <DetailItem label="First name">{member.firstName}</DetailItem>
          <DetailItem label="Last name">{member.lastName}</DetailItem>
          <DetailItem label="Email">{member.email || 'N/A'}</DetailItem>
          <DetailItem label="Phone">{member.phone || 'N/A'}</DetailItem>
          <DetailItem label="Username">{member.username || 'N/A'}</DetailItem>
          <DetailItem label="Date of birth">{member.dateOfBirth ? formatDateForDisplay(member.dateOfBirth) : 'N/A'}</DetailItem>
          {member.age != null && <DetailItem label="Age">{member.age}</DetailItem>}
          <DetailItem label="Address" className="basis-full">{formatAddress(member)}</DetailItem>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Status &amp; roles</h4>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <DetailItem label="Account status">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${member.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {member.isActive ? 'Active' : 'Archived'}
            </span>
          </DetailItem>
          <DetailItem label="Enrollment status">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
              member.status === 'athlete' || member.status === 'enrolled'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {member.status || 'Non-participant'}
            </span>
          </DetailItem>
          <DetailItem label="Waiver completion">
            {member.hasCompletedWaivers
              ? member.waiverCompletionDate
                ? formatTimestampDate(member.waiverCompletionDate)
                : 'Completed'
              : 'Not completed'}
          </DetailItem>
          <DetailItem label="Roles" className="basis-full">
            <span className="flex flex-wrap gap-1.5">
              {member.roles && member.roles.length > 0 ? (
                member.roles.map((role) => (
                  <span key={role.id} className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700">
                    {formatMemberRoleLabel(role.role)}
                  </span>
                ))
              ) : (
                <span className="text-gray-500">No roles assigned</span>
              )}
            </span>
          </DetailItem>
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
