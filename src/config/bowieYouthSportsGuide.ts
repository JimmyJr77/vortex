import publicArticles from './publicArticles.json'
import searchPhotos from './publicSearchPhotos.json'

export const BOWIE_YOUTH_SPORTS_GUIDE = {
  ...publicArticles.bowieYouthSports,
  breadcrumbLabel: 'Bowie Youth Sports Guide',
  title: 'Youth Sports & Athletics in Bowie, MD | A Parent’s Guide',
  heading: 'A parent’s guide to youth sports in Bowie, MD',
  description:
    'Find youth sports in Bowie, MD, and compare local leagues, gymnastics classes, and coached fitness and athletic training before your child’s first visit.',
  image: searchPhotos.fitAndFlip,
  imageSrcSet: searchPhotos.fitAndFlipSrcSet,
  cardImage: searchPhotos.fitAndFlip,
  cardImageSrcSet: searchPhotos.fitAndFlipSrcSet,
  imageAlt: 'A young Vortex athlete practicing a flip on a trampoline in Bowie, Maryland',
} as const
