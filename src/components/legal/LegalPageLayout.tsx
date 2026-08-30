import type { ReactNode } from 'react'

interface LegalPageLayoutProps {
  title: string
  lastUpdated?: string
  children: ReactNode
}

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
