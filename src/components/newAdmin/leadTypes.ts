export interface LeadChild { firstName?: string; lastName?: string; dateOfBirth?: string; gender?: string }
export interface LeadInquiry { submittedBy?: { userId: number | null; name: string } | null; newsletter?: boolean | null; athleteAge?: number; interests?: string[] | string; interest?: string; classTypes?: string[]; childAges?: number[]; campers?: LeadChild[]; submitterRole?: string; source?: string }
export interface Lead { id: number; archived?: boolean; firstName: string; lastName: string; email: string; phone: string | null; status: string; notes: string | null; convertedMemberId: number | null; matchedMemberId?: number | null; createdAt: string; contacted: boolean; followUp: boolean; firstContactedAt: string | null; message: string; inquiry?: LeadInquiry; invitation?: { id: number; status: string; expiresAt: string; username: string } | null }

export function leadDisplayName(lead: Pick<Lead, 'id' | 'firstName' | 'lastName' | 'email'>) {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || lead.email || `Lead #${lead.id}`
}
