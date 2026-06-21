import { useState } from 'react'
import { Archive, Ban, Calendar, Check, Mail, MailPlus } from 'lucide-react'
import {
  adminArchiveSignup,
  adminResendSignupEmail,
  adminUpdateSignupStatus,
  type SchedulingFormDetail,
  type SchedulingSignup,
} from '../../utils/schedulingApi'
import AdminSignupPasswordResetModal from './AdminSignupPasswordResetModal'

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
  const [passwordResetSignup, setPasswordResetSignup] = useState<SchedulingSignup | null>(null)

  if (signups.length === 0) {
    return (
      <p className="text-gray-600 flex items-center gap-2">
        <Calendar className="w-4 h-4" /> No signups yet.
      </p>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
      <table className="w-max max-w-none text-sm table-auto border-collapse [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap [&_th]:align-top [&_td]:align-top">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-600">
            <th className="py-2 pr-4 w-0">Name</th>
            <th className="py-2 pr-4 w-0">Email</th>
            <th className="py-2 pr-4 w-0">Account</th>
            <th className="py-2 pr-4 w-0">Password</th>
            <th className="py-2 pr-4 w-0">Total slots</th>
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
                      <span
                        className={`ml-1 font-medium ${
                          s.profileComplete === false ? 'text-amber-700' : 'text-green-700'
                        }`}
                      >
                        {s.profileComplete === false ? 'Account Stub' : 'Complete'}
                      </span>
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="py-3 pr-4 w-0">
                  {s.memberId ? (
                    <button
                      type="button"
                      onClick={() => setPasswordResetSignup(s)}
                      className="text-xs text-vortex-red font-semibold hover:underline"
                    >
                      Reset password
                    </button>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="py-3 pr-4 w-0 text-xs font-medium">
                  {s.totalSlotsForUser != null ? s.totalSlotsForUser : '—'}
                </td>
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
                      <>
                        <button
                          type="button"
                          title="Archive signup"
                          disabled={signupActionId === s.id}
                          onClick={async () => {
                            setSignupActionId(s.id)
                            try {
                              await adminArchiveSignup(s.id, true)
                              if (formId) await onRefresh()
                            } catch (e) {
                              alert(e instanceof Error ? e.message : 'Failed to archive signup')
                            } finally {
                              setSignupActionId(null)
                            }
                          }}
                          className={`${iconActionClass} text-gray-700 hover:text-gray-900`}
                          aria-label="Archive signup"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
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
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>

      {passwordResetSignup && (
        <AdminSignupPasswordResetModal
          signup={passwordResetSignup}
          open={Boolean(passwordResetSignup)}
          onClose={() => setPasswordResetSignup(null)}
          onSuccess={onRefresh}
        />
      )}
    </>
  )
}

export default AdminSignupsTable
