import articleDates from './publicArticleDates.json'

export const BOWIE_YOUTH_SPORTS_GUIDE = {
  ...articleDates.bowieYouthSports,
  path: '/blog/youth-sports-bowie',
  title: 'Youth Sports & Athletics in Bowie, MD | A Parent’s Guide',
  heading: 'A parent’s guide to youth sports in Bowie, MD',
  description:
    'Find where to look for Bowie youth sports and athletics, compare local leagues with gymnastics or fitness classes, and know what to check before registering.',
  image: '/fit-and-flip-card.webp',
  imageAlt: 'A young Vortex athlete practicing a flip on a trampoline in Bowie, Maryland',
} as const
