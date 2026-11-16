import { useLocation } from 'react-router-dom'
import { getHubSeoForPath } from '../config/hubSeo'
import { getHubSchema } from '../utils/schema'
import SeoHead from './SeoHead'

const HubSeo = () => {
  const { pathname } = useLocation()
  const seo = getHubSeoForPath(pathname)
  // Match the unified homepage’s visible hero poster.
  const preloadImage =
    pathname === '/'
      ? '/fit-and-flip-card.webp'
      : pathname === '/vortex-athletics'
        ? '/main_hero_bg-1600.webp'
        : undefined
  return (
    <SeoHead {...seo} schema={getHubSchema(pathname)} preloadImage={preloadImage} />
  )
}

export default HubSeo
