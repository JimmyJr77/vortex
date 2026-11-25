export interface LeadChild { memberId?: number; firstName?: string; lastName?: string; dateOfBirth?: string; gender?: string }
export interface LeadFreeTrial { id: number; memberId: number; childName: string; childIndex: number | null; date: string; className: string; status: string }
export interface LeadAcquisition { source: string | null; medium: string | null; campaign: string | null; referrerHost: string | null; landingPath: string | null; direct: boolean }
export interface LeadInquiry { submittedBy?: { userId: number | null; name: string } | null; newsletter?: boolean | null; athleteAge?: number; interests?: string[] | string; interest?: string; classTypes?: string[]; childAges?: number[]; campers?: LeadChild[]; submitterRole?: string; source?: string }
export interface Lead { id: number; archived?: boolean; firstName: string; lastName: string; email: string; phone: string | null; status: string; notes: string | null; convertedMemberId: number | null; matchedMemberId?: number | null; createdAt: string; contacted: boolean; followUp: boolean; firstContactedAt: string | null; message: string; inquiry?: LeadInquiry; acquisition?: LeadAcquisition | null; freeTrials?: LeadFreeTrial[]; invitation?: { id: number; status: string; expiresAt: string; username: string; purpose?: 'trial' | 'registration' } | null }

export function leadDisplayName(lead: Pick<Lead, 'id' | 'firstName' | 'lastName' | 'email'>) {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || lead.email || `Lead #${lead.id}`
}
