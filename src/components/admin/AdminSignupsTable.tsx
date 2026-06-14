import { useState } from 'react'
import { Ban, Calendar, Check, Mail, MailPlus } from 'lucide-react'
import {
  adminResendSignupEmail,
  adminUpdateSignupMemberPassword,
  adminUpdateSignupStatus,
  type SchedulingFormDetail,
  type SchedulingSignup,
} from '../../utils/schedulingApi'

interface Props {
  signups: SchedulingSignup[]
  detail: SchedulingFormDetail | null
  formId: number | null
  onRefresh: () => void | Promise<void>
}

const iconActionClass =
  'p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none'

const AdminSignupsTable = ({ signups, detail, formId, onRefresh }: Props) => {
  const [signupActionId, setSignupActionId] = useState<number | null>(null)
  const [passwordDrafts, setPasswordDrafts] = useState<Record<number, string>>({})
  const [passwordSavingId, setPasswordSavingId] = useState<number | null>(null)

  if (signups.length === 0) {
    return (
      <p className="text-gray-600 flex items-center gap-2">
        <Calendar className="w-4 h-4" /> No signups yet.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-max max-w-none text-sm table-auto border-collapse [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap [&_th]:align-top [&_td]:align-top">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-600">
            <th className="py-2 pr-4 w-0">Name</th>
            <th className="py-2 pr-4 w-0">Email</th>
            <th className="py-2 pr-4 w-0">Account</th>
            <th className="py-2 pr-4 w-0">Password</th>
            <th className="py-2 pr-4 w-0">Total slots</th>
            <th className="py-2 pr-4 w-0">Category</th>
            <th className="py-2 pr-4 w-0">Slot</th>
            <th className="py-2 pr-4 w-0">Status</th>
            <th className="py-2 pr-4 w-0">Position</th>
            <th className="py-2 pr-4 w-0">Confirm email</th>
            <th className="py-2 pr-4 w-0">Waiver email</th>
            <th className="py-2 pr-4 w-0">Other</th>
            <th className="py-2 w-0">Actions</th>
          </tr>
        </thead>
        <tbody>
          {signups.map((s) => {
            const slotLines = (s.slotLabel || '—')
              .split(';')
              .map((line) => line.trim())
              .filter(Boolean)

            return (
              <tr key={s.id} className="border-b border-gray-100">
                <td className="py-3 pr-4 w-0">
                  {s.firstName || String(s.responses.first_name || '')}{' '}
                  {s.lastName || String(s.responses.last_name || '')}
                </td>
                <td className="py-3 pr-4 w-0">{s.email || String(s.responses.email || '')}</td>
                <td className="py-3 pr-4 w-0 text-xs">
                  {s.memberId ? (
                    <span>
                      #{s.memberId}
                      {s.profileComplete === false && (
                        <span className="ml-1 text-amber-700 font-medium">Incomplete</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="py-3 pr-4 w-0">
                  {s.memberId ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="password"
                        placeholder="New password"
                        value={passwordDrafts[s.id] ?? ''}
                        onChange={(e) =>
                          setPasswordDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))
                        }
                        className="w-28 rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        disabled={
                          passwordSavingId === s.id || !(passwordDrafts[s.id]?.length >= 6)
                        }
                        onClick={async () => {
                          setPasswordSavingId(s.id)
                          try {
                            await adminUpdateSignupMemberPassword(s.id, passwordDrafts[s.id])
                            setPasswordDrafts((prev) => ({ ...prev, [s.id]: '' }))
                          } catch (e) {
                            alert(e instanceof Error ? e.message : 'Failed to save password')
                          } finally {
                            setPasswordSavingId(null)
                          }
                        }}
                        className="text-xs text-vortex-red font-semibold hover:underline disabled:opacity-40"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="py-3 pr-4 w-0 text-xs font-medium">
                  {s.totalSlotsForUser != null ? s.totalSlotsForUser : '—'}
                </td>
                <td className="py-3 pr-4 w-0">{s.categoryName}</td>
                <td className="py-3 pr-4 w-0">
                  <div className="inline-flex flex-col gap-0.5">
                    {slotLines.map((line, lineIndex) => (
                      <span key={lineIndex}>{line}</span>
                    ))}
                  </div>
                </td>
                <td className="py-3 pr-4 w-0 capitalize">
                  {s.status === 'waitlisted' ? (
                    <span className="text-amber-700">Waitlisted</span>
                  ) : (
                    s.status
                  )}
                </td>
                <td className="py-3 pr-4 w-0 text-xs text-gray-700">
                  {s.status === 'confirmed' && s.signupNumber != null && s.maxParticipants != null
                    ? `#${s.signupNumber} of ${s.maxParticipants}`
                    : s.status === 'waitlisted' && s.waitlistPosition != null
                      ? `Waitlist #${s.waitlistPosition}`
                      : '—'}
                </td>
                <td className="py-3 pr-4 w-0 text-xs">
                  {s.confirmationEmailSentAt ? (
                    <span className="text-green-700">Sent</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="py-3 pr-4 w-0 text-xs">
                  {s.waiverEmailSentAt ? (
                    <span className="text-green-700">Sent</span>
                  ) : detail?.mandateWaiver ? (
                    <span className="text-gray-400">—</span>
                  ) : (
                    <span className="text-gray-300">N/A</span>
                  )}
                </td>
                <td className="py-3 pr-4 w-0">
                  {s.adminStub ? (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                      AdminStub
                    </span>
                  ) : null}
                </td>
                <td className="py-3 w-0">
                  <div className="inline-flex items-center gap-1 flex-nowrap">
                    {(s.status === 'confirmed' || s.status === 'waitlisted') && (
                      <button
                        type="button"
                        title="Resend confirmation email"
                        disabled={signupActionId === s.id}
                        onClick={async () => {
                          setSignupActionId(s.id)
                          try {
                            await adminResendSignupEmail(s.id, 'confirmation')
                            await onRefresh()
                          } catch (e) {
                            alert(e instanceof Error ? e.message : 'Failed to resend confirmation email')
                          } finally {
                            setSignupActionId(null)
                          }
                        }}
                        className={`${iconActionClass} text-blue-600 hover:text-blue-800`}
                        aria-label="Resend confirmation email"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                    )}
                    {detail?.mandateWaiver && (
                      <button
                        type="button"
                        title="Resend waiver email"
                        disabled={signupActionId === s.id}
                        onClick={async () => {
                          setSignupActionId(s.id)
                          try {
                            await adminResendSignupEmail(s.id, 'waiver')
                            await onRefresh()
                          } catch (e) {
                            alert(e instanceof Error ? e.message : 'Failed to resend waiver email')
                          } finally {
                            setSignupActionId(null)
                          }
                        }}
                        className={`${iconActionClass} text-indigo-600 hover:text-indigo-800`}
                        aria-label="Resend waiver email"
                      >
                        <MailPlus className="w-4 h-4" />
                      </button>
                    )}
                    {(s.status === 'confirmed' || s.status === 'waitlisted') && (
                      <button
                        type="button"
                        title="Cancel signup"
                        disabled={signupActionId === s.id}
                        onClick={async () => {
                          setSignupActionId(s.id)
                          try {
                            await adminUpdateSignupStatus(s.id, 'cancelled')
                            if (formId) await onRefresh()
                          } catch (e) {
                            alert(e instanceof Error ? e.message : 'Failed to cancel signup')
                          } finally {
                            setSignupActionId(null)
                          }
                        }}
                        className={`${iconActionClass} text-red-600 hover:text-red-800`}
                        aria-label="Cancel signup"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                    {s.status === 'cancelled' && (
                      <button
                        type="button"
                        title="Reconfirm signup"
                        disabled={signupActionId === s.id}
                        onClick={async () => {
                          setSignupActionId(s.id)
                          try {
                            await adminUpdateSignupStatus(s.id, 'confirmed')
                            if (formId) await onRefresh()
                          } catch (e) {
                            alert(e instanceof Error ? e.message : 'Failed to reconfirm signup')
                          } finally {
                            setSignupActionId(null)
                          }
                        }}
                        className={`${iconActionClass} text-green-700 hover:text-green-900`}
                        aria-label="Reconfirm signup"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default AdminSignupsTable
