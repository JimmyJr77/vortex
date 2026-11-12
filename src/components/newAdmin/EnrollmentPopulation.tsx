import type { ReactNode } from 'react'
import { number, type EnrollmentTrendData, type Breakdown } from './enrollmentTypes'

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
    {breakdowns && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <BreakdownCard title="Enrollments by class" rows={breakdowns.classes.map(row => ({label:row.name, count:row.count}))} total={total} detail={students ? "Unique students in each class." : "Unique families with a student in each class."} />
      <BreakdownCard title="Boys & girls" rows={breakdowns.genders} total={total} detail={students ? "Counts and percentages of current students" : "Families with a student in each group"} />
      <BreakdownCard title="Ages" rows={breakdowns.ages} total={total} detail={students ? `Student ages as of ${asOf}` : "Families with a student in each age group"} />
      <BreakdownCard title="Team & non-team athletes" rows={breakdowns.teams} total={total} detail={students ? "Students enrolled in team and non-team programs" : "Families with a student in each group"} />
    </div>}
  </div>
}
