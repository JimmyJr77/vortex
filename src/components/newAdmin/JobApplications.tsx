import { useState, type FormEvent, type ReactNode } from 'react'
import {
  JOB_AGE_GROUPS, JOB_CERTIFICATIONS, JOB_DISCIPLINES, JOB_EMPLOYMENT_TYPES, JOB_ROLES,
  type JobAgeGroup, type JobCertification, type JobDiscipline, type JobEmploymentType, type JobRole,
} from '../../config/jobApplication'
import { formatDateShort, formatTimestampDate } from '../../utils/dateUtils'
import { formatPhoneForDisplay } from '../../utils/phoneUtils'
import { request, useRead, type Page } from './api'
import { button, Dialog, Empty, ErrorNotice, input, Loading, Pager, primary } from './shared'

const applicationsPath = '/api/admin/new-admin/job-applications'
const reviewStatuses = {
  new: 'New',
  in_review: 'In review',
  interview: 'Interview',
  closed: 'Closed',
} as const

type ReviewStatus = keyof typeof reviewStatuses

interface ApplicationSummary {
  id: number
  firstName: string
  lastName: string
  email: string
  phone: string
  role: JobRole
  status: ReviewStatus
  createdAt: string
}

interface Application extends ApplicationSummary {
  employmentType: JobEmploymentType | null
  availability: string
  earliestStartDate: string | null
  coachedChildren: boolean
  ageGroups: JobAgeGroup[]
  youthCoachingDetails: string | null
  ratings: Record<JobDiscipline, number>
  workExperience: string | null
  certificationKeys: JobCertification[]
  certifications: string | null
  resumeUrl: string | null
  additionalInfo: string | null
}

function applicantName(application: ApplicationSummary) {
  return `${application.firstName} ${application.lastName}`
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0">
    <dt className="text-xs font-semibold text-slate-600">{label}</dt>
    <dd className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{children}</dd>
  </div>
}

function ApplicationDetails({ application }: { application: Application }) {
  const ageGroups = JOB_AGE_GROUPS.filter(({ value }) => application.ageGroups.includes(value))
  const certifications = JOB_CERTIFICATIONS.filter(({ value }) => application.certificationKeys.includes(value))

  return <div className="space-y-6 text-sm">
    <dl className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
      <Detail label="Email">{application.email}</Detail>
      <Detail label="Phone">{formatPhoneForDisplay(application.phone)}</Detail>
      <Detail label="Role interest">{JOB_ROLES.find(({ value }) => value === application.role)?.label}</Detail>
      <Detail label="Submitted">{formatTimestampDate(application.createdAt)}</Detail>
      {application.employmentType ? <Detail label="Employment preference">{JOB_EMPLOYMENT_TYPES.find(({ value }) => value === application.employmentType)?.label}</Detail> : null}
      {application.earliestStartDate ? <Detail label="Earliest start">{formatDateShort(application.earliestStartDate)}</Detail> : null}
      <div className="sm:col-span-2"><Detail label="Availability">{application.availability}</Detail></div>
    </dl>

    <section>
      <h3 className="mb-3 font-semibold">Experience coaching children</h3>
      {application.coachedChildren ? <dl className="space-y-3">
        <Detail label="Ages coached">{ageGroups.map(({ label }) => label).join(', ')}</Detail>
        <Detail label="Types of training and experience">{application.youthCoachingDetails}</Detail>
      </dl> : <p>No prior experience coaching children.</p>}
    </section>

    <section>
      <h3 className="font-semibold">Self ratings</h3>
      <p className="mb-3 mt-1 text-xs text-slate-600">1 means no experience. 5 means expert.</p>
      <dl className="grid gap-x-6 sm:grid-cols-2">
        {JOB_DISCIPLINES.map(({ value, label }) => <div key={value} className="flex justify-between gap-4 border-b border-slate-200 py-2">
          <dt>{label}</dt><dd className="shrink-0 font-semibold">{application.ratings[value]} / 5</dd>
        </div>)}
      </dl>
    </section>

    <section>
      <h3 className="mb-3 font-semibold">Certifications and safety training</h3>
      {certifications.length ? <ul className="list-disc space-y-1 pl-5">
        {certifications.map(({ value, label }) => <li key={value}>{label}</li>)}
      </ul> : <p className="text-slate-600">No checklist items selected.</p>}
      {application.certifications ? <dl className="mt-3"><Detail label="Other certifications">{application.certifications}</Detail></dl> : null}
    </section>

    <dl className="space-y-3">
      {application.workExperience ? <Detail label="Work, coaching, or volunteer experience">{application.workExperience}</Detail> : null}
      {application.resumeUrl ? <Detail label="Résumé or portfolio">
        <a className="font-medium text-red-700 underline" href={application.resumeUrl} target="_blank" rel="noopener noreferrer">Open résumé or portfolio</a>
      </Detail> : null}
      {application.additionalInfo ? <Detail label="Additional information">{application.additionalInfo}</Detail> : null}
    </dl>
  </div>
}

function ReviewApplication({ summary, revision, onClose, onSaved }: {
  summary: ApplicationSummary
  revision: number
  onClose: () => void
  onSaved: () => void
}) {
  const [retry, setRetry] = useState(0)
  const [statusDraft, setStatusDraft] = useState<ReviewStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [savedApplication, setSavedApplication] = useState<{ revision: number; value: Application } | null>(null)
  const path = `${applicationsPath}/${summary.id}`
  const detail = useRead<Application>(path, revision + retry)
  const application = savedApplication?.revision === revision ? savedApplication.value : detail.data
  const status = statusDraft ?? application?.status

  async function updateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!application || !status || status === application.status || busy) return
    setBusy(true)
    setSaveError(null)
    setSaved(false)
    try {
      const updated = await request<Application>(path, { method: 'PATCH', body: JSON.stringify({ status }) })
      setSavedApplication({ revision, value: updated })
      setStatusDraft(null)
      onSaved()
      setSaved(true)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save the review status.')
    } finally {
      setBusy(false)
    }
  }

  return <Dialog title={applicantName(summary)} onClose={onClose}>
    <ErrorNotice message={detail.error} onRetry={() => setRetry(value => value + 1)} />
    {detail.loading ? <Loading label="Loading application…" /> : null}
    {saved ? <p role="status" className="mb-4 text-sm font-medium text-emerald-800">Review status saved.</p> : null}
    {application ? <>
      <form onSubmit={updateStatus} className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block min-w-44 text-sm font-medium">Review status
            <select className={input} value={status} disabled={busy} onChange={event => {
              setStatusDraft(event.target.value as ReviewStatus)
              setSaved(false)
            }}>
              {Object.entries(reviewStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button type="submit" className={primary} disabled={busy || status === application.status}>{busy ? 'Saving…' : 'Save review status'}</button>
        </div>
        <ErrorNotice message={saveError} />
      </form>
      <ApplicationDetails application={application} />
    </> : null}
  </Dialog>
}

export default function JobApplications({ revision }: { revision: number }) {
  const [page, setPage] = useState(1)
  const [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState<ApplicationSummary | null>(null)
  const applications = useRead<Page<ApplicationSummary>>(`${applicationsPath}?page=${page}&pageSize=25`, revision + retry)
  return <section aria-labelledby="job-applications-heading">
    <h2 id="job-applications-heading" className="mb-5 text-2xl font-bold">Job applications</h2>
    <ErrorNotice message={applications.error} onRetry={() => setRetry(value => value + 1)} />
    {applications.loading ? <Loading label="Loading job applications…" /> : null}
    {applications.data ? <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {applications.data.rows.length ? <ul className="divide-y divide-slate-200" aria-label="Applicants">
        {applications.data.rows.map(application => <li key={application.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0 [overflow-wrap:anywhere]">
            <p className="font-semibold">{applicantName(application)}</p>
            <p className="mt-1 text-sm text-slate-700">{JOB_ROLES.find(({ value }) => value === application.role)?.label} · {application.email}</p>
            <p className="mt-1 text-xs text-slate-600">{formatTimestampDate(application.createdAt)} · {reviewStatuses[application.status]}</p>
          </div>
          <button type="button" className={`${button} justify-self-start`} aria-label={`Review ${applicantName(application)}`} onClick={() => setSelected(application)}>Review</button>
        </li>)}
      </ul> : <Empty>No job applications yet.</Empty>}
      <Pager data={applications.data} onPage={setPage} />
    </div> : null}
    {selected ? <ReviewApplication key={selected.id} summary={selected} revision={revision} onClose={() => setSelected(null)} onSaved={() => setRetry(value => value + 1)} /> : null}
  </section>
}
