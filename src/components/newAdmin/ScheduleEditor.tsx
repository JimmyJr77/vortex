import { useState } from 'react'
import AdminSchedulingSlots from '../scheduling/AdminSchedulingSlots'
import {
  formatOfferingDateRange,
  type SchedulingFormDetail,
  type SchedulingOffering,
  type SchedulingOrphanedSignup,
  type SchedulingSignup,
} from '../../utils/schedulingApi'
import { useRead } from './api'
import { ErrorNotice, input, Loading } from './shared'

export default function ScheduleEditor({ classId, formId }: { classId: number; formId: number | null }) {
  const [revision, setRevision] = useState(0)
  const resolved = useRead<{ id: number }>(formId == null ? `/api/admin/class-events/${classId}/scheduling-form` : null, revision)
  if (resolved.error) return <ErrorNotice message={resolved.error} onRetry={() => setRevision(value => value + 1)} />
  const selectedFormId = formId ?? resolved.data?.id
  if (!selectedFormId) return <Loading label="Preparing class schedule…" />
  return <FormScheduleEditor formId={selectedFormId} />
}

function FormScheduleEditor({ formId }: { formId: number }) {
  const [revision, setRevision] = useState(0)
  const [offeringId, setOfferingId] = useState<number | null>(null)
  const detail = useRead<SchedulingFormDetail>(`/api/admin/scheduling/forms/${formId}`, revision)
  const offerings = useRead<SchedulingOffering[]>(`/api/admin/scheduling/forms/${formId}/offerings`, revision)
  const signups = useRead<SchedulingSignup[]>(`/api/admin/scheduling/signups?formId=${formId}`, revision)
  const orphaned = useRead<SchedulingOrphanedSignup[]>(`/api/admin/scheduling/orphaned-signups?formId=${formId}`, revision)
  const refresh = async () => { setRevision(value => value + 1) }
  const error = detail.error || offerings.error || signups.error || orphaned.error
  if (error) return <ErrorNotice message={error} onRetry={() => void refresh()} />
  if (detail.loading || offerings.loading || signups.loading || orphaned.loading || !detail.data) return <Loading label="Loading schedule editor…" />

  const selectedOffering = offerings.data?.find(offering => Number(offering.id) === offeringId)
    ?? offerings.data?.find(offering => offering.isSelected)
    ?? offerings.data?.[0]
  const form = detail.data
  return <div className="space-y-5">
    {(offerings.data?.length ?? 0) > 1 ? <label className="block max-w-xl text-sm font-medium">
      Session dates
      <select className={input} value={selectedOffering?.id ?? ''} onChange={event => setOfferingId(Number(event.target.value))}>
        {offerings.data?.map(offering => <option key={offering.id} value={offering.id}>{offering.label || formatOfferingDateRange(offering)}</option>)}
      </select>
    </label> : null}
    <AdminSchedulingSlots
      formId={formId}
      detail={form}
      formStartDate={form.startDate ?? null}
      formEndDate={form.endDate ?? null}
      offeringId={selectedOffering?.id ?? null}
      offeringStartDate={selectedOffering?.startDate ?? form.startDate ?? null}
      offeringEndDate={selectedOffering?.endDate ?? form.endDate ?? null}
      setupContextPrimary={[form.programDisplayName, form.classDisplayName, selectedOffering && formatOfferingDateRange(selectedOffering)].filter(Boolean).join(' · ')}
      canBuild
      existingSlotsPosition="top"
      orphanedSignups={orphaned.data ?? []}
      signups={signups.data ?? []}
      forms={[form]}
      onRefresh={refresh}
    />
  </div>
}
