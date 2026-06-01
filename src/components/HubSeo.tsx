import { useLocation } from 'react-router-dom'
import { getHubSeoForPath } from '../config/hubSeo'
import { getHubSchema } from '../utils/schema'
import SeoHead from './SeoHead'

const HubSeo = () => {
  const { pathname } = useLocation()
  const seo = getHubSeoForPath(pathname)
  // Preload the hero poster (LCP element) only on the home route.
  const preloadImage = pathname === '/' ? '/main_hero_bg.png' : undefined
  return (
    <SeoHead {...seo} schema={getHubSchema(pathname)} preloadImage={preloadImage} />
  )
}

export default HubSeo
