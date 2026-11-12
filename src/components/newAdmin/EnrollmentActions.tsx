import { Suspense } from 'react'
import { lazyWithRetry } from '../../utils/chunkLoadRecovery'
import type { AdminMemberEnrollments } from '../../utils/schedulingApi'
import { Dialog, ErrorNotice, Loading } from './shared'
import { useRead } from './api'

const Actions = lazyWithRetry(() => import('../admin/memberAccount/AdminEnrollmentActionModal'))

/** Load the canonical lifecycle/discount metadata only when an action is opened. */
export default function EnrollmentActions({ memberId, enrollmentId, onClose, onChanged }: {
  memberId: number; enrollmentId: number; onClose: () => void; onChanged: () => void
}) {
  const state = useRead<AdminMemberEnrollments>(`/api/admin/scheduling/members/${memberId}/enrollments`)
  const row = state.data?.rows.find(item => item.id === enrollmentId && item.source === 'scheduling')
  if (row && state.data?.member) return <Suspense fallback={<Loading />}><Actions row={row} member={state.data.member} onClose={onClose} onChanged={onChanged} /></Suspense>
  return <Dialog title="Enrollment actions" onClose={onClose}>{state.loading ? <Loading label="Loading enrollment…" /> : <ErrorNotice message={state.error || 'This enrollment is no longer available. Refresh the account.'} />}</Dialog>
}
