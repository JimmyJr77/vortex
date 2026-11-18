export const JOB_ROLES = [
  { value: 'gymnastics', label: 'Tumbling / gymnastics' },
  { value: 'youth_fitness', label: 'Youth fitness' },
  { value: 'both', label: 'Both' },
] as const

export const JOB_AGE_GROUPS = [
  { value: 'under_5', label: 'Under 5' },
  { value: '5_7', label: '5–7' },
  { value: '8_11', label: '8–11' },
  { value: '12_15', label: '12–15' },
  { value: '16_17', label: '16–17' },
] as const

export const JOB_DISCIPLINES = [
  { value: 'plyometrics', label: 'Plyometrics' },
  { value: 'strengthTraining', label: 'Strength training' },
  { value: 'speedAgility', label: 'Speed & agility' },
  { value: 'hiit', label: 'HIIT' },
  { value: 'tumbling', label: 'Tumbling' },
  { value: 'trampoline', label: 'Trampoline' },
  { value: 'womensArtisticGymnastics', label: 'Women’s artistic gymnastics' },
  { value: 'mensArtisticGymnastics', label: 'Men’s artistic gymnastics' },
  { value: 'acro', label: 'Acro' },
  { value: 'dance', label: 'Dance' },
] as const

export const JOB_EMPLOYMENT_TYPES = [
  { value: 'part_time', label: 'Part time' },
  { value: 'full_time', label: 'Full time' },
  { value: 'either', label: 'Either' },
] as const

export const JOB_CERTIFICATIONS = [
  { value: 'cpr_aed', label: 'CPR/AED' },
  { value: 'first_aid', label: 'First Aid' },
  { value: 'safesport', label: 'U.S. Center for SafeSport training' },
  { value: 'usag_u100', label: 'USA Gymnastics U100: Fundamentals of Gymnastics Instruction' },
  { value: 'usag_u101', label: 'USA Gymnastics U101: Safety and Risk Management' },
  { value: 'usag_coaching', label: 'USA Gymnastics University coaching certificate' },
  { value: 'personal_trainer', label: 'Certified Personal Trainer (CPT)' },
  { value: 'group_fitness', label: 'Certified Group Fitness Instructor' },
  { value: 'youth_fitness', label: 'Youth fitness specialization' },
  { value: 'cscs', label: 'NSCA Certified Strength and Conditioning Specialist (CSCS)' },
] as const

export type JobRole = typeof JOB_ROLES[number]['value']
export type JobAgeGroup = typeof JOB_AGE_GROUPS[number]['value']
export type JobDiscipline = typeof JOB_DISCIPLINES[number]['value']
export type JobEmploymentType = typeof JOB_EMPLOYMENT_TYPES[number]['value']
export type JobCertification = typeof JOB_CERTIFICATIONS[number]['value']
