import type { ReactNode } from 'react'
import { formatDateForDisplay, formatTimestampDate } from '../../../utils/dateUtils'
import type { MemberDetailData, MemberDirectorySummary, MemberFamilyData } from './types'

function formatAddress(member: MemberDetailData): string {
  if (member.address?.trim()) return member.address.trim()
  const parts = [member.billingStreet, member.billingCity, member.billingState, member.billingZip]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
  return parts.length ? parts.join(', ') : 'N/A'
}

function DetailItem({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-40 text-sm ${className}`}>
      <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      <span className="mt-1 block min-w-0 break-words text-gray-900">{children}</span>
    </div>
  )
}

function StatusPill({
  children,
  tone = 'gray',
}: {
  children: string
  tone?: 'green' | 'blue' | 'cyan' | 'amber' | 'purple' | 'red' | 'gray'
}) {
  const tones = {
    green: 'bg-green-50 text-green-700',
    blue: 'bg-blue-50 text-blue-700',
    cyan: 'bg-cyan-50 text-cyan-700',
    amber: 'bg-amber-50 text-amber-800',
    purple: 'bg-purple-50 text-purple-700',
    red: 'bg-red-50 text-red-700',
    gray: 'bg-gray-100 text-gray-600',
  }
  return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>
}

function ParticipationSummary({ summary }: { summary: MemberDirectorySummary }) {
  const values = [
    summary.participation.current > 0
      ? <StatusPill key="current" tone="blue">{`${summary.participation.current} current`}</StatusPill>
      : null,
    summary.participation.upcoming > 0
      ? <StatusPill key="upcoming" tone="cyan">{`${summary.participation.upcoming} upcoming`}</StatusPill>
      : null,
    summary.participation.waitlisted > 0
      ? <StatusPill key="waitlisted" tone="amber">{`${summary.participation.waitlisted} waitlisted`}</StatusPill>
      : null,
    summary.participation.paused > 0
      ? <StatusPill key="paused">{`${summary.participation.paused} paused`}</StatusPill>
      : null,
    summary.participation.former > 0 && summary.participation.current === 0 && summary.participation.upcoming === 0
      ? <StatusPill key="former">Former</StatusPill>
      : null,
  ].filter(Boolean)

  return values.length > 0 ? <span className="flex flex-wrap gap-1.5">{values}</span> : <span>Never enrolled</span>
}

function PortalStatus({ status }: { status: MemberDirectorySummary['portalAccess']['status'] }) {
  if (status === 'active') return <StatusPill tone="green">Active</StatusPill>
  if (status === 'setup_required') return <StatusPill tone="amber">Setup required</StatusPill>
  if (status === 'suspended') return <StatusPill tone="red">Suspended</StatusPill>
  return <StatusPill>No login</StatusPill>
}

function formatDataQualityIssue(issue: string): string {
  const normalized = issue.replaceAll('_', ' ')
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

interface Props {
  member: MemberDetailData
  familyData: MemberFamilyData | null
  directorySummary: MemberDirectorySummary
}

export default function MemberDetailsTab({ member, familyData, directorySummary }: Props) {
  const recordIsActive = directorySummary.recordStatus === 'active'
  const portalStatus = directorySummary.portalAccess.status
  const staffLabels = directorySummary.staffAccess.labels
  const householdLabels = [
    directorySummary.household.isPayer ? 'Payer' : null,
    directorySummary.household.isGuardian ? 'Guardian' : null,
    directorySummary.household.isDependent ? 'Dependent' : null,
  ].filter((label): label is string => Boolean(label))
  const waiverCompletedAt = directorySummary.waiver.lastAcceptedAt

  return (
    <div className="space-y-5">
      {member.familyId && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Family information</h4>
          <div className="flex flex-wrap gap-x-10 gap-y-5">
            <DetailItem label="Family name">{member.familyName || 'N/A'}</DetailItem>
            <DetailItem label="Family ID">{member.familyId}</DetailItem>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Contact &amp; profile</h4>
        <div className="flex flex-wrap gap-x-10 gap-y-5">
          <DetailItem label="First name">{member.firstName}</DetailItem>
          <DetailItem label="Last name">{member.lastName}</DetailItem>
          <DetailItem label="Email">{member.email || 'N/A'}</DetailItem>
          <DetailItem label="Phone">{member.phone || 'N/A'}</DetailItem>
          <DetailItem label="Username">{member.username || 'N/A'}</DetailItem>
          <DetailItem label="Date of birth">{member.dateOfBirth ? formatDateForDisplay(member.dateOfBirth) : 'N/A'}</DetailItem>
          {member.age != null && <DetailItem label="Age">{member.age}</DetailItem>}
          <DetailItem label="Address">{formatAddress(member)}</DetailItem>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Status &amp; access</h4>
        <div className="flex flex-wrap gap-x-10 gap-y-5">
          <DetailItem label="Record">
            <StatusPill tone={recordIsActive ? 'green' : 'gray'}>{recordIsActive ? 'Active' : 'Archived'}</StatusPill>
          </DetailItem>
          <DetailItem label="Household">
            <span className="flex flex-wrap gap-1.5">
              {householdLabels.length > 0 ? (
                householdLabels.map((label) => (
                  <StatusPill key={label} tone={label === 'Payer' ? 'purple' : label === 'Guardian' ? 'blue' : 'gray'}>
                    {label}
                  </StatusPill>
                ))
              ) : (
                <span className="text-gray-500">None</span>
              )}
            </span>
          </DetailItem>
          <DetailItem label="Portal access">
            <PortalStatus status={portalStatus} />
          </DetailItem>
          <DetailItem label="Staff access">
            <span className="flex flex-wrap gap-1.5">
              {staffLabels.length > 0
                ? (
                    <>
                      {staffLabels.map((label) => <StatusPill key={label} tone="purple">{label}</StatusPill>)}
                      {directorySummary.staffAccess.status === 'suspended' ? <StatusPill tone="red">Suspended</StatusPill> : null}
                    </>
                  )
                : <span className="text-gray-500">None</span>}
            </span>
          </DetailItem>
          <DetailItem label="Participation">
            <ParticipationSummary summary={directorySummary} />
          </DetailItem>
          <DetailItem label="Waiver">
            {directorySummary.waiver.status === 'not_required' ? (
              <StatusPill>Not required</StatusPill>
            ) : directorySummary.waiver.status === 'action_required' ? (
              <StatusPill tone="amber">Action required</StatusPill>
            ) : (
              <span className="flex flex-col items-start gap-1">
                <StatusPill tone="green">Current</StatusPill>
                {waiverCompletedAt ? (
                  <span className="text-xs text-gray-500">Completed {formatTimestampDate(waiverCompletedAt)}</span>
                ) : null}
              </span>
            )}
          </DetailItem>
        </div>
        {directorySummary.dataQuality.length > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span className="font-semibold">Data review:</span>{' '}
            {directorySummary.dataQuality.map(formatDataQualityIssue).join(' · ')}
          </div>
        ) : null}
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
                  {[fm.email, fm.phone, fm.isFamilyPayer ? 'Payer' : null, fm.isActive === false ? 'Archived' : null]
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

      {member.medicalNotes && (
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Additional information</h4>
          <div className="text-sm">
            <span className="text-gray-600">Medical notes</span>
            <div className="text-gray-900 whitespace-pre-wrap">{member.medicalNotes}</div>
          </div>
        </section>
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
