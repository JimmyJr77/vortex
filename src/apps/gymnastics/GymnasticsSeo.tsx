import { useLocation } from 'react-router-dom'
import SeoHead from '../../components/SeoHead'
import { getGymnasticsSeoForPath } from '../../config/gymnasticsSeo'

interface GymnasticsSeoProps {
  isPreview?: boolean
}

const GymnasticsSeo = ({ isPreview = false }: GymnasticsSeoProps) => {
  const { pathname } = useLocation()
  const seo = getGymnasticsSeoForPath(
    pathname,
    isPreview ? { robots: 'noindex, nofollow' } : undefined,
  )
  return <SeoHead {...seo} />
}

export default GymnasticsSeo
