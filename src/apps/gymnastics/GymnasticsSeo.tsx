import { useLocation } from 'react-router-dom'
import SeoHead from '../../components/SeoHead'
import { getGymnasticsSeoForPath } from '../../config/gymnasticsSeo'
import { getGymnasticsSchema } from '../../utils/schema'

interface GymnasticsSeoProps {
  isPreview?: boolean
}

const GymnasticsSeo = ({ isPreview = false }: GymnasticsSeoProps) => {
  const { pathname } = useLocation()
  const seo = getGymnasticsSeoForPath(
    pathname,
    isPreview ? { robots: 'noindex, nofollow' } : undefined,
  )
  // Preload the first hero image (LCP) only on the gymnastics home route.
  const preloadImage =
    pathname === '/'
      ? '/campaign_early_dev_hero-1600.webp'
      : pathname === '/summer-camp-26'
        ? '/summer-camp-2026-flyer-front.png'
        : undefined
  const preloadImageSrcSet =
    pathname === '/'
      ? '/campaign_early_dev_hero-720.webp 720w, /campaign_early_dev_hero-1600.webp 1600w'
      : undefined
  return (
    <SeoHead
      {...seo}
      schema={getGymnasticsSchema(pathname)}
      preloadImage={preloadImage}
      preloadImageSrcSet={preloadImageSrcSet}
      preloadImageSizes={preloadImageSrcSet ? '100vw' : undefined}
    />
  )
}

export default GymnasticsSeo
