import brandLogo from '../../assets/vortex-athletics-gymnastics-logo.webp'
import brandLogo480 from '../../assets/vortex-athletics-gymnastics-logo-480.webp'
import brandLogo640 from '../../assets/vortex-athletics-gymnastics-logo-640.webp'

const headerSizes = [
  '(max-width: 620px) clamp(120px, calc(100vw - 234px), 220px)',
  '(min-width: 861px) and (max-width: 1150px) clamp(176px, calc(100vw - 686px), 300px)',
  '300px',
].join(', ')
const compactSources = `${brandLogo480} 480w, ${brandLogo640} 640w`

export default function PublicBrandImage({ footer = false }: { footer?: boolean }) {
  return (
    <img
      src={footer ? brandLogo640 : brandLogo}
      srcSet={footer ? compactSources : `${compactSources}, ${brandLogo} 1086w`}
      sizes={footer ? 'min(300px, calc(100vw - 44px))' : headerSizes}
      width={1086}
      height={171}
      alt="Vortex Athletics & Gymnastics"
      loading={footer ? 'lazy' : undefined}
    />
  )
}
