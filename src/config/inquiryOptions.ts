export const SUBMITTER_ROLES = ['Athlete', 'Parent/Guardian', 'Other'] as const
export type SubmitterRole = (typeof SUBMITTER_ROLES)[number]

export const ATHLETICS_TRAINING_INTERESTS = [
  'Speed & Agility',
  'Strength & Explosiveness',
  'Flexibility & Balance',
  'Coordination & Body Control',
  'Tumbling & Flips',
] as const

export const ATHLETICS_SPORT_INTERESTS = [
  'Crossfit',
  'Gymnastics',
  'Ninja Athlete',
  'Baseball',
  'Football',
  'Basketball',
  'Soccer',
  'Wrestling',
  'MMA',
  'Lacrosse',
  'Other',
] as const

export const GYMNASTICS_INTERESTS = [
  'Gymnastics (Artistic)',
  'Acrobatic Gymnastics (Acro)',
  'Rhythmic Gymnastics',
  'Trampoline & Tumbling',
  'Aerobic Gymnastics',
  'Ninja Athlete',
  'Basic Tumbling',
  'Mommy & Me',
  'Fitness',
] as const

/** @deprecated Use GYMNASTICS_INTERESTS or variant-specific lists */
export const INQUIRY_INTERESTS = GYMNASTICS_INTERESTS

export const INQUIRY_CLASS_TYPES = [
  'Adult Classes',
  'Youth Classes',
  'Camps',
  'Homeschool Program',
] as const

/** Legacy class type values still stored on older registrations */
export const LEGACY_INQUIRY_CLASS_TYPES = [
  'Child Classes',
  'Gymnastics Summer Camp',
  'Summer Athletic Development Program',
] as const

/** Class types shown on the camp inquiry form (Camps is auto-included). */
export const CAMP_INQUIRY_OTHER_CLASS_TYPES = [
  'Adult Classes',
  'Youth Classes',
  'Homeschool Program',
] as const

export const CAMP_INQUIRY_AUTO_CLASS = 'Camps' as const

/** @deprecated Use CAMP_INQUIRY_AUTO_CLASS */
export const GYMNASTICS_SUMMER_CAMP_CLASS_TYPE = CAMP_INQUIRY_AUTO_CLASS

export type InquiryInterest =
  | (typeof ATHLETICS_TRAINING_INTERESTS)[number]
  | (typeof ATHLETICS_SPORT_INTERESTS)[number]
  | (typeof GYMNASTICS_INTERESTS)[number]
export type InquiryClassType = (typeof INQUIRY_CLASS_TYPES)[number]

export interface InquiryCamper {
  firstName?: string
  lastName?: string
  dateOfBirth?: string | null
}

export type InquiryVariant = 'athletics' | 'gymnastics'
