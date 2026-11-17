import publicArticles from './publicArticles.json'

export const GYMNASTICS_VS_TUMBLING_GUIDE = {
  ...publicArticles.gymnasticsVsTumbling,
  breadcrumbLabel: 'Gymnastics vs. Tumbling',
  title: 'Gymnastics vs. Tumbling for Kids | Vortex Athletics',
  heading: 'Gymnastics vs. tumbling for kids',
  description:
    'Learn how tumbling fits into gymnastics and which Bowie class to try for gymnastics skills, tumbling foundations, or strength and power for sports.',
  image: '/tramp-tumble-hero-1600.webp',
  cardImage: '/tramp-tumble-hero-1600.webp',
  imageAlt: 'A Vortex athlete flipping above a tumble track in Bowie, Maryland',
} as const
