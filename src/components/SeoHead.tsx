import { Helmet } from 'react-helmet-async'
import { DEFAULT_OG_IMAGE, SITE_NAME, type SeoMeta } from '../utils/seo'

interface SeoHeadProps extends SeoMeta {}

const SeoHead = ({
  title,
  description,
  canonical,
  ogImage = DEFAULT_OG_IMAGE,
  robots,
}: SeoHeadProps) => {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {robots && <meta name="robots" content={robots} />}

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  )
}

export default SeoHead
