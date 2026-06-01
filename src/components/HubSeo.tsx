import { useLocation } from 'react-router-dom'
import { getHubSeoForPath } from '../config/hubSeo'
import SeoHead from './SeoHead'

const HubSeo = () => {
  const { pathname } = useLocation()
  const seo = getHubSeoForPath(pathname)
  return <SeoHead {...seo} />
}

export default HubSeo
