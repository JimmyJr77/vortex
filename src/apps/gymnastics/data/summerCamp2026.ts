export type SummerCampWeek = {
  week: number
  dates: string
  dateRange: string
  activities: string[]
  accent: 'red' | 'blue' | 'yellow' | 'emerald' | 'violet'
}

export const SUMMER_CAMP_2026_WEEKS: SummerCampWeek[] = [
  {
    week: 1,
    dates: 'June 29 – July 3',
    dateRange: '2026-06-29/2026-07-03',
    activities: [
      'Acrobatics',
      'Basketball',
      'Hip Hop Dance',
      'Conditioning',
      'Games',
      'Movies',
      'Crafts',
    ],
    accent: 'red',
  },
  {
    week: 2,
    dates: 'July 6 – July 10',
    dateRange: '2026-07-06/2026-07-10',
    activities: [
      'Artistic Gymnastics',
      'Beams, rings, vault & more',
      'Arts & Crafts',
      'Soccer',
      'Salsa Dance',
      'Conditioning',
      'Games',
      'Movies',
    ],
    accent: 'blue',
  },
  {
    week: 3,
    dates: 'July 13 – July 17',
    dateRange: '2026-07-13/2026-07-17',
    activities: [
      'Rhythmic Gymnastics',
      'Volleyball',
      'Ballet & Jazz Dance',
      'Conditioning',
      'Games',
      'Movies',
      'Crafts',
    ],
    accent: 'yellow',
  },
  {
    week: 4,
    dates: 'July 20 – July 24',
    dateRange: '2026-07-20/2026-07-24',
    activities: [
      'Aerobic Gymnastics',
      'Football',
      'Bachata Dance',
      'Conditioning',
      'Games',
      'Movies',
      'Crafts',
    ],
    accent: 'emerald',
  },
  {
    week: 5,
    dates: 'July 27 – July 31',
    dateRange: '2026-07-27/2026-07-31',
    activities: [
      'Trampoline & Tumbling',
      'Baseball & Softball',
      'Reggae Dance',
      'Conditioning',
      'Games',
      'Movies',
      'Crafts',
    ],
    accent: 'violet',
  },
]

export const SUMMER_CAMP_HIGHLIGHTS = [
  'Gymnastics & acrobatics',
  'Team sports',
  'Dance & movement',
  'Arts & crafts',
  'Games & movies',
] as const
