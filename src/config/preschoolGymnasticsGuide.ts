import publicArticles from './publicArticles.json'
import searchPhotos from './publicSearchPhotos.json'

export const PRESCHOOL_GYMNASTICS_GUIDE = {
  ...publicArticles.preschoolGymnastics,
  breadcrumbLabel: 'Preschool Gymnastics Guide',
  title: 'What Kids Learn in Preschool Gymnastics | Vortex',
  heading: 'What children learn in preschool gymnastics',
  description:
    'See what ages 2–3 and 4–5 practice in gymnastics, how caregivers help, and what progress can look like at Vortex in Bowie, MD.',
  image: searchPhotos.preschoolGymnastics,
  cardImage: '/campaign_early_dev_hero-720.webp',
  imageAlt: 'A child holding a low gymnastics bar above a padded mat',
} as const
