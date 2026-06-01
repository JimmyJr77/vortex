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
    pathname === '/' ? '/campaign_early_dev_hero.jpg' : undefined
  return (
    <SeoHead
      {...seo}
      schema={getGymnasticsSchema(pathname)}
      preloadImage={preloadImage}
    />
  )
}

export default GymnasticsSeo
