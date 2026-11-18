import { buildCanonical, HUB_ORIGIN, type SeoMeta } from '../utils/seo'
import { BUSINESS_FACILITY_PHOTO, BUSINESS_NAP, TEAM_EMAIL, TEAM_PHONE } from './contact'
import guideIndex from './publicGuideIndex.json'
import { PUBLIC_GUIDES } from './publicGuides'
import { PUBLIC_PROGRAMS } from './publicPrograms'
import searchPhotos from './publicSearchPhotos.json'
import trainingVideo from './publicTrainingVideo.json'

export interface HubRouteSeo {
  path: string
  title: string
  description: string
  ogImage?: string
  ogImageAlt?: string
  ogType?: SeoMeta['ogType']
  robots?: string
}

const LARGE_IMAGE_PREVIEW = 'max-image-preview:large'
const homePreviewPhoto = searchPhotos.homepageGallery.strengthTraining
const previewImageFor = (image: string) => image === searchPhotos.fitAndFlip ? searchPhotos.fitAndFlipPreview : image

export const HUB_HOME_SEO: HubRouteSeo = {
  path: '/',
  title: 'Gymnastics & Youth Athletic Training in Bowie, MD | Vortex',
  description:
    'Find youth gymnastics, Fit & Flip athletic development, and adult gymnastics at Vortex in Bowie, MD. Compare programs and find your first class.',
  ogImage: `${HUB_ORIGIN}${homePreviewPhoto.src}`,
  ogImageAlt: homePreviewPhoto.alt,
  robots: LARGE_IMAGE_PREVIEW,
}

const wideGuideImages = new Set([
  searchPhotos.plyometrics, searchPhotos.fitAndFlipPreview, searchPhotos.preschoolGymnastics,
  searchPhotos.tumbling, BUSINESS_FACILITY_PHOTO.src,
])

export const HUB_ROUTES: HubRouteSeo[] = [
  HUB_HOME_SEO,
  ...Object.values(PUBLIC_PROGRAMS).map(({ path, title, description, image, imageAlt, imageWidth }) => ({
    path, title, description,
    ...(image ? { ogImage: new URL(previewImageFor(image), HUB_ORIGIN).href, ogImageAlt: imageAlt } : {}),
    robots: imageWidth >= 1200 || image === searchPhotos.fitAndFlip ? LARGE_IMAGE_PREVIEW : undefined,
  })),
  {
    path: '/ninja',
    title: 'Vortex Ninja Program Status | Vortex Athletics',
    description:
      'Vortex Ninja classes in Bowie, MD are temporarily on hold. Explore current youth athletic training, gymnastics, and Fit & Flip programs.',
    robots: 'noindex, follow',
  },
  {
    path: '/read-board',
    title: 'Class Schedules, Camps & Events in Bowie, MD | Vortex',
    description:
      'Find youth gymnastics, Fit & Flip youth fitness, and Typhoons adult gymnastics at Vortex in Bowie, MD. See class times, camps, and events.',
  },
  {
    path: '/enroll',
    title: 'Enroll in Gymnastics & Fit & Flip in Bowie, MD | Vortex',
    description:
      'See class times and pricing for youth gymnastics, Fit & Flip, and adult gymnastics in Bowie, MD. Find your program and enroll through Vortex.',
  },
  {
    path: '/drop-in',
    title: 'Drop-In Gymnastics & Fitness Classes in Bowie, MD | Vortex',
    description:
      'Find single-session youth gymnastics, Fit & Flip, and adult gymnastics in Bowie, MD. Compare open drop-in dates, prices, and times that accept free trials.',
  },
  {
    path: '/contact',
    title: 'Contact Vortex Athletics | Bowie, MD Gym & Training',
    description:
      `Get directions to Vortex Athletics at ${BUSINESS_NAP.streetAddress} in Bowie, MD. See gym photos, check hours, and ask about your first class.`,
    ogImage: `${HUB_ORIGIN}${BUSINESS_FACILITY_PHOTO.src}`,
    ogImageAlt: BUSINESS_FACILITY_PHOTO.alt,
    robots: LARGE_IMAGE_PREVIEW,
  },
  {
    path: '/jobs',
    title: 'Coaching Jobs in Bowie, MD | Vortex Athletics',
    description:
      'Apply to coach tumbling, gymnastics, or youth fitness at Vortex Athletics in Bowie, MD. Tell us about your experience training children and your availability.',
  },
  { path: guideIndex.path, title: guideIndex.title, description: guideIndex.description },
  {
    path: trainingVideo.path,
    title: trainingVideo.title,
    description: trainingVideo.description,
    ogImage: new URL(trainingVideo.thumbnail, HUB_ORIGIN).href,
    ogImageAlt: trainingVideo.thumbnailAlt,
  },
  ...PUBLIC_GUIDES.map(({ path, title, description, image, imageAlt }) => {
    const previewImage = previewImageFor(image)
    return {
      path, title, description, ogImage: `${HUB_ORIGIN}${previewImage}`, ogImageAlt: imageAlt,
      ogType: 'article' as const,
      robots: wideGuideImages.has(previewImage) ? LARGE_IMAGE_PREVIEW : undefined,
    }
  }),
  {
    path: '/support',
    title: 'Customer Support | Vortex Athletics',
    description:
      `Contact Vortex Athletics in Bowie, MD for enrollment, billing, and program support. Email ${TEAM_EMAIL} or call ${TEAM_PHONE}.`,
  },
  {
    path: '/store',
    title: 'Vortex Athletics Store | Training Gear in Bowie, MD',
    description:
      'Shop training gear and essentials for Vortex athletes. Order online and pick up at Vortex Athletics and Gymnastics in Bowie, MD.',
  },
  {
    path: '/privacy-policy',
    title: 'Privacy Policy | Vortex Athletics',
    description:
      'How Vortex Athletics collects, uses, discloses, and protects personal information for enrollment, billing, and member services.',
  },
  {
    path: '/terms-of-service',
    title: 'Terms of Service | Vortex Athletics',
    description:
      'Terms governing use of Vortex Athletics websites, enrollment, billing, and program participation in Bowie, MD.',
  },
]

const routeMap = new Map(HUB_ROUTES.map((route) => [route.path, route]))

export const getHubSeoForPath = (pathname: string): SeoMeta => {
  const route = routeMap.get(pathname)
  if (!route) {
    return {
      title: `Vortex Athletics | Bowie, MD`,
      description: HUB_HOME_SEO.description,
      canonical: buildCanonical(HUB_ORIGIN, pathname),
      robots: 'noindex, follow',
    }
  }
  return {
    title: route.title,
    description: route.description,
    canonical: buildCanonical(HUB_ORIGIN, route.path),
    ogImage: route.ogImage,
    ogImageAlt: route.ogImageAlt,
    ogType: route.ogType,
    robots: route.robots,
  }
}
