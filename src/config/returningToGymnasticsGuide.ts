import { BUSINESS_FACILITY_PHOTO } from './contact'
import publicArticles from './publicArticles.json'

export const RETURNING_TO_GYMNASTICS_GUIDE = {
  ...publicArticles.returningToGymnastics,
  breadcrumbLabel: 'Returning to Gymnastics as an Adult',
  title: 'Returning to Gymnastics as an Adult | Vortex Athletics',
  heading: 'Returning to gymnastics as an adult',
  description:
    'Compare adult gymnastics classes and open gyms near Bowie, MD. Learn what to tell your coach and how to choose a starting skill after a break.',
  image: BUSINESS_FACILITY_PHOTO.src,
  cardImage: '/gym-DSC02636-768.webp',
  imageAlt: BUSINESS_FACILITY_PHOTO.alt,
} as const
