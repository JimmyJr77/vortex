import publicArticles from './publicArticles.json'

export const ATHLETIC_DEVELOPMENT_GUIDE = {
  ...publicArticles.athleticDevelopment,
  breadcrumbLabel: 'Youth Athletic Development Guide',
  title: 'A Parent’s Guide to Youth Athletic Development | Vortex',
  heading: 'Athleticism development for young athletes',
  description:
    'Explore eight qualities of youth athleticism and see how Vortex coaches progress skills from a balanced stop to a quick change of direction on a cue.',
  image: '/plyometrics-1600.webp',
  imageSrcSet: '/plyometrics-768.webp 768w, /plyometrics-1080.webp 1080w, /plyometrics-1600.webp 1536w',
  imageAlt: 'Young athletes practicing jumps on the red training floor at Vortex Athletics',
} as const
