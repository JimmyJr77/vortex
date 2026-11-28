import { input } from './shared'

export function ActiveStatusTag({ active }: { active: boolean }) {
  return <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{active ? 'Active' : 'Inactive'}</span>
}

export function EnrollmentTag({ enrolled }: { enrolled: boolean }) {
  return <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${enrolled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{enrolled ? 'Enrolled' : 'Not enrolled'}</span>
}

export default function AccountStatusTags({ active, enrolled }: { active: boolean; enrolled: boolean }) {
  return <div role="group" aria-label="Active status and enrollment" className="flex flex-wrap items-center gap-1"><ActiveStatusTag active={active} /><EnrollmentTag enrolled={enrolled} /></div>
}

export function AccountStatusFilters({ active, enrolled, onActiveChange, onEnrolledChange }: {
  active: string; enrolled: string; onActiveChange: (value: string) => void; onEnrolledChange: (value: string) => void
}) {
  return <>
    <label className="min-w-40 text-sm font-medium">Active status<select className={input} value={active} onChange={event => onActiveChange(event.target.value)}>
      <option value="">Any active status</option><option value="true">Active</option><option value="false">Inactive</option>
    </select></label>
    <label className="min-w-40 text-sm font-medium">Enrollment<select className={input} value={enrolled} onChange={event => onEnrolledChange(event.target.value)}>
      <option value="">Any enrollment</option><option value="true">Enrolled</option><option value="false">Not enrolled</option>
    </select></label>
  </>
}
