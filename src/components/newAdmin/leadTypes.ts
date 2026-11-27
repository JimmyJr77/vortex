export interface LeadChild { memberId?: number; firstName?: string; lastName?: string; dateOfBirth?: string; gender?: string }
export interface LeadFreeTrial { id: number; memberId: number; childName: string; childIndex: number | null; date: string; className: string; status: string }
export interface LeadAcquisition { source: string | null; medium: string | null; campaign: string | null; referrerHost: string | null; landingPath: string | null; direct: boolean }
export type LeadParticipationTag = 'inquiry' | 'free_trial' | 'drop_in' | 'recent_drop'
export interface LeadInquiry { submittedBy?: { userId: number | null; name: string } | null; newsletter?: boolean | null; athleteAge?: number; interests?: string[] | string; interest?: string; classTypes?: string[]; childAges?: number[]; campers?: LeadChild[]; submitterRole?: string; source?: string }
export interface Lead { id: number; archived?: boolean; firstName: string; lastName: string; email: string; phone: string | null; status: string; displayStatus?: 'lead' | 'converted'; participationTags?: LeadParticipationTag[]; notes: string | null; convertedMemberId: number | null; matchedMemberId?: number | null; createdAt: string; convertedAt?: string | null; contacted: boolean; followUp: boolean; firstContactedAt: string | null; message: string; inquiry?: LeadInquiry; acquisition?: LeadAcquisition | null; freeTrials?: LeadFreeTrial[]; invitation?: { id: number; status: string; expiresAt: string; username: string; purpose?: 'trial' | 'registration' } | null }

export function leadDisplayName(lead: Pick<Lead, 'id' | 'firstName' | 'lastName' | 'email'>) {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || lead.email || `Lead #${lead.id}`
}

const childName = (child: LeadChild) => [child.firstName, child.lastName].filter(Boolean).join(' ').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
const trialName = (trial: LeadFreeTrial) => trial.childName.trim().toLocaleLowerCase().replace(/\s+/g, ' ')

function sameChild(left: LeadChild, right: LeadChild) {
  if (left.memberId != null && right.memberId != null) return left.memberId === right.memberId
  const name = childName(left)
  return Boolean(name) && name === childName(right) && (!left.dateOfBirth || !right.dateOfBirth || left.dateOfBirth === right.dateOfBirth)
}

function matchingTrialName(child: LeadChild, trial: LeadFreeTrial) {
  const name = childName(child), bookingName = trialName(trial)
  return Boolean(name && bookingName) && (name === bookingName || (!child.lastName && name === bookingName.split(' ')[0]))
}

/** Keep each trial with its member; old child indices are only a fallback for unlinked form children. */
export function leadChildRows(lead: Pick<Lead, 'inquiry' | 'freeTrials'>): Array<{ child: LeadChild | null; trials: LeadFreeTrial[] }> {
  const rows: Array<{ child: LeadChild; trials: LeadFreeTrial[] }> = []
  const originalIndices = new Map<number, number>()
  for (const [index, child] of (lead.inquiry?.campers ?? []).entries()) {
    let rowIndex = rows.findIndex(row => sameChild(row.child, child))
    if (rowIndex === -1) {
      rowIndex = rows.length
      rows.push({ child: { ...child }, trials: [] })
    } else {
      const saved = rows[rowIndex].child
      rows[rowIndex].child = { memberId: saved.memberId ?? child.memberId,
        firstName: saved.firstName || child.firstName, lastName: saved.lastName || child.lastName,
        dateOfBirth: saved.dateOfBirth || child.dateOfBirth, gender: saved.gender || child.gender }
    }
    originalIndices.set(index, rowIndex)
  }
  const seenTrials = new Set<number>()
  for (const trial of lead.freeTrials ?? []) {
    if (seenTrials.has(trial.id)) continue
    seenTrials.add(trial.id)
    let row = rows.find(row => row.child.memberId === trial.memberId)
    if (!row) {
      const named = rows.filter(row => row.child.memberId == null && matchingTrialName(row.child, trial))
      if (named.length === 1) row = named[0]
    }
    if (!row && trial.childIndex != null) {
      const rowIndex = originalIndices.get(trial.childIndex)
      const indexed = rowIndex == null ? null : rows[rowIndex]
      if (indexed && indexed.child.memberId == null && (!trialName(trial) || !childName(indexed.child) || matchingTrialName(indexed.child, trial))) row = indexed
    }
    if (!row) {
      row = { child: { memberId: trial.memberId, firstName: trial.childName }, trials: [] }
      rows.push(row)
    }
    row.child.memberId ??= trial.memberId
    row.trials.push(trial)
  }
  return rows.length ? rows : [{ child: null, trials: [] }]
}
