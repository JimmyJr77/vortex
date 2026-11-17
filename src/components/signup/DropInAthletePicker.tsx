import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getApiUrl } from '../../utils/api'
import { calculateAge, parseDateOnly } from '../../utils/dateUtils'
import type { DropInSession } from '../../utils/dropInApi'
import { clearPortalSession, getMemberSessionToken } from '../../utils/portalSession'

type FamilyMember = {
  id: number | string
  first_name?: string
  last_name?: string
  date_of_birth?: string | null
}

type Athlete = { id: number; name: string; age: number | null }
type FamilyState =
  | { status: 'loading' | 'expired' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; athletes: Athlete[] }

export default function DropInAthletePicker({ token, session, signInUrl, onChoose, onCancel }: {
  token: string
  session: DropInSession
  signInUrl: string
  onChoose: (memberId: number) => void
  onCancel: () => void
}) {
  const { date, ageMin, ageMax } = session
  const [family, setFamily] = useState<FamilyState>({ status: 'loading' })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setFamily({ status: 'loading' })
    setSelectedId(null)
    void (async () => {
      try {
        const response = await fetch(`${getApiUrl()}/api/members/family`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        })
        if (controller.signal.aborted) return
        if (response.status === 401) {
          setFamily({ status: 'expired' })
          return
        }
        const data = await response.json()
        if (!response.ok || !data.success) throw new Error(data.message || 'Could not load your family.')
        const classDate = parseDateOnly(date)
        const athletes = ((data.familyMembers ?? []) as FamilyMember[]).map((member) => ({
          id: Number(member.id),
          name: [member.first_name, member.last_name].filter(Boolean).join(' ').trim(),
          age: classDate ? calculateAge(member.date_of_birth, classDate) : null,
        })).filter(({ id, name, age }) => Number.isSafeInteger(id) && id > 0 && name &&
          (ageMin == null || (age != null && age >= ageMin)) &&
          (ageMax == null || (age != null && age <= ageMax)))
        if (!controller.signal.aborted) setFamily({ status: 'loaded', athletes })
      } catch (error) {
        if (!controller.signal.aborted) setFamily({
          status: 'error', message: error instanceof Error ? error.message : 'Could not load your family.',
        })
      }
    })()
    return () => controller.abort()
  }, [token, date, ageMin, ageMax, attempt])

  const selected = family.status === 'loaded' ? family.athletes.find(({ id }) => id === selectedId) : undefined

  return <section className="space-y-4" aria-labelledby="drop-in-athlete-heading">
    <h2 id="drop-in-athlete-heading" className="text-2xl font-bold">Who’s attending this drop-in?</h2>
    <p className="text-sm text-gray-600">Choose a family member to see their price, trial eligibility, and credits.</p>
    {family.status === 'loading' && <p role="status">Loading your family…</p>}
    {family.status === 'expired' && <>
      <p role="alert" className="text-red-700">Your sign-in expired.</p>
      <Link to={signInUrl} onClick={() => { if (getMemberSessionToken() === token) clearPortalSession() }} className="font-semibold text-vortex-red underline">Sign in again</Link>
    </>}
    {family.status === 'error' && <>
      <p role="alert" className="text-red-700">{family.message}</p>
      <button type="button" className="font-semibold text-vortex-red underline" onClick={() => setAttempt(value => value + 1)}>Try again</button>
    </>}
    {family.status === 'loaded' && (family.athletes.length ? (
      <fieldset className="space-y-2">
        <legend className="mb-2 font-semibold">Select an athlete</legend>
        {family.athletes.map(athlete => (
          <label key={athlete.id} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2">
            <input type="radio" name="drop-in-athlete" checked={selectedId === athlete.id} onChange={() => setSelectedId(athlete.id)} />
            <span><strong>{athlete.name}</strong>{athlete.age != null && <span className="ml-2 text-sm text-gray-600">Age {athlete.age} on class day</span>}</span>
          </label>
        ))}
      </fieldset>
    ) : <p>No family members meet this class’s age requirements. <Link to="/contact" className="font-semibold underline">Contact Vortex</Link> if you need help with your family details.</p>)}
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-3 font-semibold">Back to classes</button>
      {family.status === 'loaded' && family.athletes.length > 0 && (
        <button type="button" disabled={!selected} onClick={() => { if (selected) onChoose(selected.id) }} className="rounded-lg bg-vortex-red px-5 py-3 font-semibold text-white disabled:opacity-60">Review drop-in</button>
      )}
    </div>
  </section>
}
