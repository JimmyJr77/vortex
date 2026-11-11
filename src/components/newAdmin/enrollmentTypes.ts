export interface EnrollmentMonth {
  key: string; label: string; openingFamilies: number | null; newFamilies: number | null
  canceledFamilies: number | null; lostFamilies: number | null; lossRate: number | null; partial: boolean
}
export interface Breakdown { label: string; count: number }
export interface AcquisitionMonth { key: string; label: string; partial: boolean; newFamilies: number | null; spendCents: number | null; cacCents: number | null; version: number }
export interface LossRateSummary {
  lastMonthLossRate: number | null; threeMonthLossRate: number | null; threeMonthRateMonths: number
  twelveMonthLossRate: number | null; twelveMonthRateMonths: number
}
export interface EnrollmentTrendData {
  studentMonths?: Array<Omit<EnrollmentMonth, 'openingFamilies' | 'newFamilies' | 'canceledFamilies' | 'lostFamilies'> & {openingStudents: number | null; newStudents: number | null; canceledStudents: number | null; lostStudents: number | null}>; studentNotes?: string[]
  year: number; asOf: string; coverageStart: string | null; months: EnrollmentMonth[]; rollingMonths: EnrollmentMonth[]; notes: string[]
  summary: LossRateSummary & { newFamilies: number | null; averageNewFamilies: number | null; newFamilyMonths: number
    cancellations: number | null; averageCancellations: number | null; cancellationMonths: number }
  studentSummary?: LossRateSummary
  current: { families: number; students: number; studentsPerFamily: number | null
    classes: Array<{id: string; name: string; count: number}>; genders: Breakdown[]; ages: Breakdown[]; teams: Breakdown[]
    membership: { monthlyRevenueCents: number; averageMembershipCents: number | null; averageFamilyMembershipCents?: number | null; pricedStudents: number } | null }
  acquisition: { rows: AcquisitionMonth[]; includedMonths: number; totalSpendCents: number; newFamilies: number; cacCents: number | null
    retentionMonths: number | null; familyLifetimeRevenueCents: number | null; revenuePerDollar: number | null } | null
  permissions: {canViewFinancial: boolean; canEditMarketing: boolean}
}
export const number = (value: number | null | undefined, decimals = 0) => value == null ? 'Unavailable' : value.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })
export const money = (cents: number | null | undefined) => cents == null ? 'Unavailable' : (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
export const monthName = (key: string) => new Date(`${key}-01T12:00:00Z`).toLocaleDateString('en-US', {month:'short', year:'numeric', timeZone:'UTC'})
