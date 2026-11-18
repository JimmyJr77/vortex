import publicArticles from './publicArticles.json'
import guideIndex from './publicGuideIndex.json'
import trainingVideo from './publicTrainingVideo.json'

export const loadHomePage = () => import('../components/newpage/NewPage')
export const loadPublicProgramPage = () => import('../components/newpage/PublicProgramPage')
export const loadSiteHeader = () => import('../components/Header')
export const loadSiteFooter = () => import('../components/Footer')
const loadTrainingWatch = () => import('../components/newpage/TrainingWatchPage')

async function loadSiteChrome() {
  const [headerModule, footerModule] = await Promise.all([loadSiteHeader(), loadSiteFooter()])
  return { Header: headerModule.default, Footer: footerModule.default }
}

function publicPage<const Path extends string, Component>(
  path: Path,
  load: () => Promise<{ default: Component }>,
  usesLegacyChrome = false,
) {
  return {
    path,
    load,
    async snapshot() {
      const [module, chrome] = await Promise.all([load(), usesLegacyChrome ? loadSiteChrome() : undefined])
      return { kind: 'page' as const, path, Component: module.default, chrome }
    },
  }
}

export const publicPageLoaders = {
  readBoard: publicPage('/read-board', () => import('../components/ReadBoard')),
  enroll: publicPage('/enroll', () => import('../components/SchedulingPage')),
  dropIn: publicPage('/drop-in', () => import('../components/DropInPage')),
  contact: publicPage('/contact', () => import('../components/ContactLocationPage')),
  store: publicPage('/store', () => import('../components/store/Storefront'), true),
  support: publicPage('/support', () => import('../components/legal/SupportPage'), true),
  privacyPolicy: publicPage('/privacy-policy', () => import('../components/legal/PrivacyPolicyPage'), true),
  termsOfService: publicPage('/terms-of-service', () => import('../components/legal/TermsOfServicePage'), true),
  trainingWatch: {
    path: trainingVideo.path,
    load: loadTrainingWatch,
    async snapshot() {
      return { kind: 'watch' as const, Component: (await loadTrainingWatch()).default }
    },
  },
}

type PublicPageLoader = (typeof publicPageLoaders)[keyof typeof publicPageLoaders]

export const publicGuideLoaders = [
  { path: guideIndex.path, load: () => import('../components/newpage/TrainingGuidesIndex') },
  { path: publicArticles.athleticDevelopment.path, load: () => import('../components/newpage/AthleticDevelopmentGuide') },
  { path: publicArticles.bowieYouthSports.path, load: () => import('../components/newpage/BowieYouthSportsGuide') },
  { path: publicArticles.preschoolGymnastics.path, load: () => import('../components/newpage/PreschoolGymnasticsGuide') },
  { path: publicArticles.gymnasticsVsTumbling.path, load: () => import('../components/newpage/GymnasticsVsTumblingGuide') },
  { path: publicArticles.returningToGymnastics.path, load: () => import('../components/newpage/ReturningToGymnasticsGuide') },
]

export type OpenProgramPricingSnapshot = {
  id: string
  summaryViewportTop: number
  summaryFocused: boolean
}

export type PublicSnapshotPage =
  | { kind: 'home'; Component: Awaited<ReturnType<typeof loadHomePage>>['default'] }
  | { kind: 'program'; path: string; Component: Awaited<ReturnType<typeof loadPublicProgramPage>>['default']; openPricing?: OpenProgramPricingSnapshot }
  | { kind: 'guide'; path: string; Component: Awaited<ReturnType<(typeof publicGuideLoaders)[number]['load']>>['default'] }
  | Awaited<ReturnType<PublicPageLoader['snapshot']>>
