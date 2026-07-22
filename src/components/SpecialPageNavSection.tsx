import NavMenuDivider from './NavMenuDivider'
import { specialPagesForPlacement, type SpecialPageConfig } from '../types/specialPages'
import { getSpecialPageHref } from '../utils/specialPageLinks'

interface SpecialPageNavSectionProps {
  pages: SpecialPageConfig[]
  siteKey: string
  onNavigate: () => void
}

const getNavLabel = (page: SpecialPageConfig, siteKey: string) => {
  if (page.key === 'summer-gymnastics-program' && siteKey === 'gymnastics') {
    return 'Summer Camp 2026'
  }
  return page.title
}

export default function SpecialPageNavSection({
  pages,
  siteKey,
  onNavigate,
}: SpecialPageNavSectionProps) {
  const visiblePages = specialPagesForPlacement(pages, siteKey, 'nav')
  if (visiblePages.length === 0) return null

  return (
    <>
      <NavMenuDivider className="my-4" />
      {visiblePages.map((page) => (
        <a
          key={page.key}
          href={getSpecialPageHref(page, siteKey)}
          onClick={onNavigate}
          className="block font-medium text-white transition-colors duration-300 hover:text-vortex-red"
        >
          {getNavLabel(page, siteKey)}
        </a>
      ))}
    </>
  )
}
