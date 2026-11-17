import publicArticles from './publicArticles.json'
import guideIndex from './publicGuideIndex.json'

export const loadHomePage = () => import('../components/newpage/NewPage')
export const loadPublicProgramPage = () => import('../components/newpage/PublicProgramPage')

export const publicGuideLoaders = [
  { path: guideIndex.path, load: () => import('../components/newpage/TrainingGuidesIndex') },
  { path: publicArticles.athleticDevelopment.path, load: () => import('../components/newpage/AthleticDevelopmentGuide') },
  { path: publicArticles.bowieYouthSports.path, load: () => import('../components/newpage/BowieYouthSportsGuide') },
  { path: publicArticles.preschoolGymnastics.path, load: () => import('../components/newpage/PreschoolGymnasticsGuide') },
  { path: publicArticles.gymnasticsVsTumbling.path, load: () => import('../components/newpage/GymnasticsVsTumblingGuide') },
  { path: publicArticles.returningToGymnastics.path, load: () => import('../components/newpage/ReturningToGymnasticsGuide') },
]

export type PublicSnapshotPage =
  | { kind: 'home'; Component: Awaited<ReturnType<typeof loadHomePage>>['default'] }
  | { kind: 'program'; Component: Awaited<ReturnType<typeof loadPublicProgramPage>>['default'] }
  | { kind: 'guide'; path: string; Component: Awaited<ReturnType<(typeof publicGuideLoaders)[number]['load']>>['default'] }
