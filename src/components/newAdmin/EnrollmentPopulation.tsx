import { useState, type ReactNode } from 'react'
import { number, type EnrollmentTrendData, type Breakdown, type ClassLoadBreakdown, type ClassLoadTotals } from './enrollmentTypes'

export function MetricCard({ label, value, detail, color = 'text-slate-950' }: {label: string; value: ReactNode; detail: ReactNode; color?: string}) {
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-5" aria-label={label}>
    <p className="text-sm font-medium text-slate-600">{label}</p><p className={`mt-2 break-words text-3xl font-bold ${color}`}>{value}</p><div className="mt-2 text-xs leading-relaxed text-slate-500">{detail}</div>
  </article>
}
function BreakdownCard({ title, rows, total, detail }: {title: string; rows: Breakdown[]; total: number; detail: string}) {
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-5" aria-label={title}>
    <h3 className="font-bold">{title}</h3><p className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</p>
    <ul className="mt-5 max-h-80 space-y-4 overflow-y-auto">{rows.map((row, index) => <li key={`${row.label}:${index}`}>
      <div className="flex justify-between gap-3 text-sm"><span className="min-w-0 break-words">{row.label}</span><span className="shrink-0 font-semibold">{number(row.count)} <span className="font-normal text-slate-500">({total ? number(row.count / total * 100, 1) : '0'}%)</span></span></div>
      <div className="mt-1.5 h-1.5 rounded bg-slate-100" aria-hidden="true"><div className="h-full rounded bg-red-600" style={{width:`${total ? Math.min(100, row.count / total * 100) : 0}%`}} /></div>
    </li>)}</ul>
    {!rows.length ? <p className="mt-4 text-sm text-slate-500">No enrollment data for this group.</p> : null}
  </article>
}
export default function EnrollmentPopulation({ current, asOf, students }: Pick<EnrollmentTrendData, 'current' | 'asOf'> & { students: boolean }) {
  const breakdowns = students ? current : current.familyBreakdowns
  const total = students ? current.students : current.families
  return <div className="mt-6 space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <MetricCard label="Current families" value={number(current.families)} detail={`Families with a current enrollment · As of ${asOf}`} />
      <MetricCard label="Current students" value={number(current.students)} detail="Unique enrolled students, including paused enrollments" />
      <MetricCard label="Average students per family" value={number(current.studentsPerFamily, 2)} detail="Current students ÷ current families" />
    </div>
    {current.classLoad && <ClassesPerStudent data={current.classLoad} asOf={asOf} />}
    {breakdowns && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <BreakdownCard title="Enrollments by class" rows={breakdowns.classes.map(row => ({label:row.name, count:row.count}))} total={total} detail={students ? "Unique students in each class." : "Unique families with a student in each class."} />
      <BreakdownCard title="Boys & girls" rows={breakdowns.genders} total={total} detail={students ? "Counts and percentages of current students" : "Families with a student in each group"} />
      <BreakdownCard title="Ages" rows={breakdowns.ages} total={total} detail={students ? `Student ages as of ${asOf}` : "Families with a student in each age group"} />
      <BreakdownCard title="Team & non-team athletes" rows={breakdowns.teams} total={total} detail={students ? "Students enrolled in team and non-team programs" : "Families with a student in each group"} />
    </div>}
  </div>
}

const CLASS_COUNT_BUCKETS = [
  { key: 'one', label: '1 class' },
  { key: 'two', label: '2 classes' },
  { key: 'threePlus', label: '3+ classes' },
] as const

function ClassesPerStudent({ data, asOf }: { data: ClassLoadBreakdown; asOf: string }) {
  const [selectedId, setSelectedId] = useState('')
  const selectedType = data.classTypes.find(type => type.id === selectedId)
  const cohorts = data.cohorts.filter(cohort => cohort.classTypeId === (selectedType?.id ?? null))
  const { overall } = data
  return <section aria-label="Classes per student" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h3 className="text-lg font-bold">Classes per student</h3>
        <p className="mt-1 max-w-xl text-sm text-slate-600">
          Current scheduled class signups divided by enrolled students in each group. Each scheduled section counts once per student, including paused enrollments. As of {asOf}.
        </p>
      </div>
      <div className="rounded-xl bg-blue-50 px-4 py-3">
        <p className="text-xs font-medium text-blue-900">Overall average</p>
        <p className="text-2xl font-bold tabular-nums text-blue-800">{number(overall.averageClasses, 2)}</p>
        <p className="text-xs text-blue-900">{number(overall.classEnrollments)} signups · {number(overall.students)} students</p>
        {overall.distribution && <dl aria-label="Overall student counts by number of classes" className="mt-3 grid grid-cols-3 gap-3 border-t border-blue-200 pt-2 text-blue-900">
          {CLASS_COUNT_BUCKETS.map(({ key, label }) => <div key={key}>
            <dt className="text-xs">{label}</dt>
            <dd className="text-lg font-bold tabular-nums">{number(overall.distribution?.[key])}</dd>
          </div>)}
        </dl>}
      </div>
    </div>
    {overall.distribution && overall.students > 0 && <p className="mt-4 text-xs text-slate-600 sm:hidden">Swipe the tables to see all columns.</p>}
    {overall.students > 0 ? <div className="mt-5 grid gap-6 2xl:grid-cols-2">
      <div className="min-w-0">
        <h4 className="font-semibold">By class type</h4>
        <ClassLoadTable title="Classes per student by class type" rowHeading="Class type" rows={data.classTypes.map(type => ({
          ...type, key: type.id,
        }))} />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">By age group and gender</h4>
          <label className="flex max-w-full items-center gap-2 text-sm font-medium">
            <span className="shrink-0">Class type</span>
            <select value={selectedType?.id ?? ''} onChange={event => setSelectedId(event.target.value)}
              className="min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5">
              <option value="">All class types</option>
              {data.classTypes.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
            </select>
          </label>
        </div>
        <ClassLoadTable title={`Classes per student by age group and gender · ${selectedType?.label ?? 'All class types'}`}
          rowHeading="Age group and gender" rows={cohorts.map(cohort => ({
            ...cohort,
            key: JSON.stringify([cohort.ageGroup, cohort.gender]),
            label: cohort.ageGroup,
            detail: cohort.gender,
          }))} />
      </div>
    </div> : <p className="mt-4 text-sm text-slate-600">No current class signups.</p>}
  </section>
}

function ClassLoadTable({ title, rowHeading, rows }: {
  title: string
  rowHeading: string
  rows: Array<ClassLoadTotals & { key: string; label: string; detail?: string }>
}) {
  if (!rows.length) return <p className="mt-3 text-sm text-slate-600">No current enrollments in this group.</p>
  const hasDistribution = rows.some(row => row.distribution != null)
  return <div className="mt-2 overflow-x-auto focus-visible:outline-blue-600" tabIndex={0} role="region" aria-label={title}>
    <table className={`w-full text-left text-sm${hasDistribution ? ' min-w-[29rem]' : ''}`}>
      <caption className="sr-only">{title}</caption>
      <thead className="border-b border-slate-200 text-xs text-slate-600">
        <tr>
          <th scope="col" className="sticky left-0 bg-white py-2 pr-2 font-semibold">{rowHeading}</th>
          <th scope="col" className="px-2 py-2 text-right font-semibold">Students</th>
          <th scope="col" className="px-2 py-2 text-right font-semibold">Class signups</th>
          <th scope="col" className="px-2 py-2 text-right font-semibold">Avg per student</th>
          {hasDistribution && CLASS_COUNT_BUCKETS.map(({ key, label }) => (
            <th key={key} scope="col" className="px-2 py-2 text-right font-semibold">{label}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map(row => <tr key={row.key}>
          <th scope="row" className="sticky left-0 break-words bg-white py-2.5 pr-2 font-semibold">
            {row.label}
            {row.detail && <span className="block text-xs font-normal text-slate-600">{row.detail}</span>}
          </th>
          <td className="px-2 py-2.5 text-right tabular-nums">{number(row.students)}</td>
          <td className="px-2 py-2.5 text-right tabular-nums">{number(row.classEnrollments)}</td>
          <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-blue-800">{number(row.averageClasses, 2)}</td>
          {hasDistribution && CLASS_COUNT_BUCKETS.map(({ key }) => (
            <td key={key} className="px-2 py-2.5 text-right tabular-nums">
              {row.distribution?.[key] != null ? number(row.distribution[key]) : <><span aria-hidden="true">—</span><span className="sr-only">Unavailable</span></>}
            </td>
          ))}
        </tr>)}
      </tbody>
    </table>
  </div>
}
