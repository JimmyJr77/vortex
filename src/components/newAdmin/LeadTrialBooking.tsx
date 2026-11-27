import { useState } from 'react'
import { ChildTrialScheduling, type LeadTrialBooking as Booking, type TrialChild } from '../signup/LeadTrialScheduling'
import { request, useRead } from './api'
import { button, Dialog, Empty, ErrorNotice, Loading } from './shared'
import { leadDisplayName, type Lead } from './leadTypes'

interface TrialSetup { facilityId: number; children: TrialChild[]; bookings: Booking[]; matchedContact?: { memberId: number; name: string; email: string } }

export default function LeadTrialBooking({ lead, onClose, onBooked, onOpenMember }: { lead: Lead; onClose: () => void; onBooked: () => void; onOpenMember: (id: number) => void }) {
  const endpoint = `/api/admin/new-admin/leads/${lead.id}/trial-booking`
  const setup = useRead<TrialSetup>(endpoint)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [linked, setLinked] = useState<TrialSetup | null>(null)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const data = linked ?? setup.data
  const memberId = lead.linkedMemberId ?? lead.matchedMemberId ?? lead.convertedMemberId
  const confirmContact = async () => {
    if (!data?.matchedContact || linking) return
    setLinking(true); setError(null)
    try {
      setLinked(await request<TrialSetup>(endpoint, { method: 'POST', body: JSON.stringify({ linkMemberId: data.matchedContact.memberId, confirmContact: true }) }))
      onBooked()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to link this member.') }
    finally { setLinking(false) }
  }
  return <Dialog title={`Add Free trial · ${leadDisplayName(lead)}`} onClose={onClose}>
    <ErrorNotice message={error || setup.error} />
    {setup.loading ? <Loading label="Loading trial athletes…" /> : data?.matchedContact ? <div className="space-y-4">
      <p className="text-sm text-slate-600">This inquiry matches an existing member. Confirm this is the same family before linking their account and adding a trial.</p>
      <p className="font-semibold">{data.matchedContact.name}<span className="block text-sm font-normal text-slate-600">{data.matchedContact.email}</span></p>
      <div className="flex flex-wrap gap-2"><button className={button} onClick={() => onOpenMember(data.matchedContact!.memberId)}>Review member</button><button className={button} disabled={linking} onClick={() => void confirmContact()}>{linking ? 'Linking…' : 'Use this member for this lead'}</button></div>
    </div> : data ? <div className="space-y-4">
      <p className="text-sm text-slate-600">Choose a free trial for this family’s athlete. The family’s required information and current signed waivers must be complete before booking.</p>
      {!data.children.length ? <><Empty>No eligible children are linked to this lead. Complete the family’s athlete details in their member account.</Empty>{memberId != null ? <button className={button} onClick={() => onOpenMember(memberId)}>Member</button> : null}</> : data.children.map(child => <ChildTrialScheduling key={child.memberId} child={child} facilityId={data.facilityId} staff
        booking={[...bookings, ...data.bookings].find(booking => booking.memberId === child.memberId && ['confirmed', 'attended'].includes(booking.status))}
        bookTrial={selection => request<Booking>(endpoint, { method: 'POST', body: JSON.stringify({ memberId: child.memberId, freeTrial: selection }) })}
        onBooked={booking => { setBookings(current => [...current.filter(saved => saved.memberId !== booking.memberId), booking]); onBooked() }} />)}
      <button className={button} onClick={onClose}>Done</button>
    </div> : null}
  </Dialog>
}
