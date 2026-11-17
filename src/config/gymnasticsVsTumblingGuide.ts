import publicArticles from './publicArticles.json'
import searchPhotos from './publicSearchPhotos.json'

export const GYMNASTICS_VS_TUMBLING_GUIDE = {
  ...publicArticles.gymnasticsVsTumbling,
  breadcrumbLabel: 'Gymnastics vs. Tumbling',
  title: 'Gymnastics vs. Tumbling for Kids in Bowie, MD | Vortex',
  heading: 'Gymnastics vs. tumbling for kids',
  description:
    'Compare developmental gymnastics, boys’ apparatus classes, and dedicated tumbling near Bowie, MD. See beginner requirements and where to try a first class.',
  image: searchPhotos.tumbling,
  cardImage: searchPhotos.tumbling,
  imageAlt: 'A Vortex athlete flipping above a tumble track in Bowie, Maryland',
} as const
