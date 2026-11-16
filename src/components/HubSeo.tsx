import { useLocation } from 'react-router-dom'
import { getHubSeoForPath } from '../config/hubSeo'
import { getHubSchema } from '../utils/schema'
import SeoHead from './SeoHead'

const HubSeo = () => {
  const { pathname } = useLocation()
  const path = pathname.toLowerCase().replace(/\/+$/, '') || '/'
  const seo = getHubSeoForPath(path)
  return <SeoHead {...seo} schema={getHubSchema(path)} />
}

export default HubSeo
