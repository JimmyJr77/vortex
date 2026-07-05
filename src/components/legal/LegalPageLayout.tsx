import type { ReactNode } from 'react'

interface LegalPageLayoutProps {
  title: string
  lastUpdated?: string
  children: ReactNode
}

const sectionHeading = 'text-xl font-display font-bold text-gray-900 mt-10 mb-3'
const paragraph = 'text-gray-700 leading-relaxed'
const list = 'list-disc pl-6 space-y-2 text-gray-700'

export { sectionHeading, paragraph, list }

export default function LegalPageLayout({
  title,
  lastUpdated = 'July 5, 2026',
  children,
}: LegalPageLayoutProps) {
  return (
    <main className="bg-white">
      <div className="bg-black text-white py-16 md:py-20">
        <div className="container-custom max-w-4xl">
          <h1 className="text-3xl md:text-4xl font-display font-bold">{title}</h1>
          <p className="text-gray-400 mt-2 text-sm">Last updated: {lastUpdated}</p>
        </div>
      </div>
      <article className="container-custom max-w-4xl py-12 md:py-16 pb-20 space-y-4">
        {children}
      </article>
    </main>
  )
}
