import { useLocation } from 'react-router-dom'
import { getHubSeoForPath } from '../config/hubSeo'
import { getHubSchema } from '../utils/schema'
import SeoHead from './SeoHead'

const HubSeo = () => {
  const { pathname } = useLocation()
  const seo = getHubSeoForPath(pathname)
  // The traditional Athletics page owns the full poster hero after the route swap.
  const preloadImage = pathname === '/vortex-athletics' ? '/main_hero_bg.png' : undefined
  return (
    <SeoHead {...seo} schema={getHubSchema(pathname)} preloadImage={preloadImage} />
  )
}

export default HubSeo
